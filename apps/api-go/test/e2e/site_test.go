// Package e2e — site module end-to-end test.
//
// Phase 2 T22: covers the single public endpoint /api/v1/site/stats.
// The endpoint is intentionally unauthenticated so we don't bother
// minting tokens; we only need to verify the 7 KPI fields + the
// term-label derivation and the optional featured-course payload.
package e2e

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/site"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type siteTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupSiteEnv(t *testing.T) *siteTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_site_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_site_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}), "mysql never came up")

	applySchema(t, db)

	log, err := zap.NewDevelopment()
	require.NoError(t, err)

	siteSvc := site.NewService(db)
	siteH := handler.NewSiteHandler(siteSvc)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-site",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	siteH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &siteTestEnv{app: app, db: db, log: log}
}

func (e *siteTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = strings.NewReader(string(raw))
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authHeader != "" {
		req.Header.Set("Authorization", "Bearer "+authHeader)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, b
}

// ============ TESTS ============

func TestSite_Stats_EmptyDB(t *testing.T) {
	env := setupSiteEnv(t)
	// Fresh DB: all counts are 0, no featured course, term label
	// falls back to current month.
	status, raw := env.do(t, "GET", "/api/v1/site/stats", "", nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))

	var got struct {
		ActiveLearners       int64  `json:"activeLearners"`
		TotalCourses         int64  `json:"totalCourses"`
		TotalProjects        int64  `json:"totalProjects"`
		TotalDegrees         int64  `json:"totalDegrees"`
		ActiveHackathonCount int64  `json:"activeHackathonCount"`
		CurrentTermLabel     string `json:"currentTermLabel"`
		FeaturedCourse       any    `json:"featuredCourse"`
	}
	require.NoError(t, json.Unmarshal(raw, &got))
	require.Equal(t, int64(0), got.ActiveLearners)
	require.Equal(t, int64(0), got.TotalCourses)
	require.Equal(t, int64(0), got.TotalProjects)
	require.Equal(t, int64(0), got.TotalDegrees)
	require.Equal(t, int64(0), got.ActiveHackathonCount)
	require.NotEmpty(t, got.CurrentTermLabel, "term label should fall back to current month")
	require.Nil(t, got.FeaturedCourse, "no published course → featuredCourse is null")
}

func TestSite_Stats_Aggregations(t *testing.T) {
	env := setupSiteEnv(t)
	now := time.Now().UTC()

	// Seed: 1 admin + 2 students (so activeLearners=2), 1 published +
	// 1 draft course (so totalCourses=1), 1 nano_degree, 1 active
	// hackathon, 1 chapter on the published course (so
	// featuredCourse.chapterCount=1).
	_ = insertUserDirect(t, env.db, makeEmail("site-admin"), "Site Admin", "admin", "Str0ngP@ssw0rd!!")
	_ = insertUserDirect(t, env.db, makeEmail("site-stu1"), "S1", "student", "Str0ngP@ssw0rd!!")
	_ = insertUserDirect(t, env.db, makeEmail("site-stu2"), "S2", "student", "Str0ngP@ssw0rd!!")

	courseID := uuid.NewString()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'AI 101', 'desc', 'points', 'inst', 'Beginner', '8h', 'https://x.test/t.png', 'a,b', 'free', 0, 'published', 'own', ?, ?)
	`, courseID, now, now)
	require.NoError(t, err)
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Draft Course', 'd', 'p', 'i', 'Beginner', '4h', 'https://x.test/d.png', 'x', 'free', 0, 'draft', 'own', ?, ?)
	`, uuid.NewString(), now, now)
	require.NoError(t, err)

	chapterID := uuid.NewString()
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO chapters (id, course_id, title, description, order_index, created_at)
		VALUES (?, ?, 'C1', 'c', 0, ?)
	`, chapterID, courseID, now)
	require.NoError(t, err)

	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO nano_degrees (id, title, description, learning_points, price, icon, cost_type, status, created_at, updated_at)
		VALUES (?, 'ND', 'x', 'x', 0, 'sparkles', 'free', 'published', ?, ?)
	`, uuid.NewString(), now, now)
	require.NoError(t, err)

	// active hackathon — MIN(start_date) drives term label, so pick a
	// month that pins the label: April → 春季.
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO hackathons (id, title, description, status, start_date, end_date, max_team_size, min_team_size, created_at, updated_at)
		VALUES (?, 'HK', 'x', 'active', '2025-04-15 00:00:00', '2025-05-15 00:00:00', 5, 1, ?, ?)
	`, uuid.NewString(), now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/api/v1/site/stats", "", nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))

	var got struct {
		ActiveLearners       int64  `json:"activeLearners"`
		TotalCourses         int64  `json:"totalCourses"`
		TotalProjects        int64  `json:"totalProjects"`
		TotalDegrees         int64  `json:"totalDegrees"`
		ActiveHackathonCount int64  `json:"activeHackathonCount"`
		CurrentTermLabel     string `json:"currentTermLabel"`
		FeaturedCourse       *struct {
			ID           string `json:"id"`
			Title        string `json:"title"`
			ChapterCount int64  `json:"chapterCount"`
			ModuleCount  int64  `json:"moduleCount"`
		} `json:"featuredCourse"`
	}
	require.NoError(t, json.Unmarshal(raw, &got))
	require.Equal(t, int64(2), got.ActiveLearners, "admin excluded")
	require.Equal(t, int64(1), got.TotalCourses, "only published counted")
	require.Equal(t, int64(0), got.TotalProjects, "no practice_completions seeded")
	require.Equal(t, int64(1), got.TotalDegrees)
	require.Equal(t, int64(1), got.ActiveHackathonCount)
	require.Equal(t, "2025 春季", got.CurrentTermLabel, "April → 春季")
	require.NotNil(t, got.FeaturedCourse, "published course exists")
	require.Equal(t, "AI 101", got.FeaturedCourse.Title)
	require.Equal(t, int64(1), got.FeaturedCourse.ChapterCount)
	require.Equal(t, int64(1), got.FeaturedCourse.ModuleCount, "mirrors chapterCount")
}
