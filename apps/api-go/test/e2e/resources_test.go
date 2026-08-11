// Package e2e — resources module end-to-end test.
//
// Phase 2 T12-4: covers the 4 resource endpoints. All admin-only.
package e2e

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/chapters"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/courses"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/lessons"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/resources"
	"github.com/frankfika/ai-academy/api-go/internal/users"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type resourcesTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupResourcesEnv(t *testing.T) *resourcesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_resources_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_resources_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}))

	applySchema(t, db)

	cfg, err := config.Load()
	require.NoError(t, err)
	cfg.DatabaseURL = dsn
	cfg.JWTSecret = "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"
	cfg.Env = "test"

	log, err := logger.New("test")
	require.NoError(t, err)

	authRepo := auth.NewAuthRepo(db)
	authCfg, err := auth.LoadAuthConfig()
	require.NoError(t, err)
	authSvc, err := auth.BuildService(authCfg, authRepo)
	require.NoError(t, err)
	tokens := auth.NewJWTTokenIssuer([]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL)

	authH := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env: cfg.Env, AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)

	adminID := bootstrapRsAdmin(t, db)
	adminTok, _ := loginAsRs(t, db, cfg, "admin-resources@example.test", "Str0ngP@ssw0rd!!")
	_ = adminID

	usersRepo := users.NewRepo(db)
	usersSvc := users.NewService(usersRepo, log, 4)
	usersH := handler.NewUsersHandler(usersSvc, tokens, log)
	identitiesH := handler.NewIdentitiesHandler(usersSvc, tokens, log)

	coursesRepo := courses.NewRepo(db)
	coursesSvc := courses.NewService(coursesRepo, log)
	coursesH := handler.NewCoursesHandler(coursesSvc, tokens, log)

	chaptersRepo := chapters.NewRepo(db)
	chaptersSvc := chapters.NewService(chaptersRepo, log)
	chaptersH := handler.NewChaptersHandler(chaptersSvc, tokens, log)

	lessonsRepo := lessons.NewRepo(db)
	lessonsSvc := lessons.NewService(lessonsRepo, log)
	lessonsH := handler.NewLessonsHandler(lessonsSvc, tokens, log)

	// Wire chapters → lessons cascade
	chapters.LessonSoftDeleteByChapter = func(ctx context.Context, _ *sql.DB, chapterID string) (int64, error) {
		return lessonsRepo.SoftDeleteByChapter(ctx, chapterID)
	}

	resourcesRepo := resources.NewRepo(db)
	resourcesSvc := resources.NewService(resourcesRepo, log)

	// Wire lessons → resources cascade
	lessons.ResourceSoftDeleteByLesson = func(ctx context.Context, _ *sql.DB, lessonID string) (int64, error) {
		return resourcesRepo.SoftDeleteByLesson(ctx, lessonID)
	}

	resourcesH := handler.NewResourcesHandler(resourcesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-resources",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	usersH.Mount(v1)
	identitiesH.Mount(v1)
	coursesH.Mount(v1)
	chaptersH.Mount(v1)
	lessonsH.Mount(v1)
	resourcesH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &resourcesTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *resourcesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if raw != nil {
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

// ============ helpers ============

func bootstrapRsAdmin(t *testing.T, db *sql.DB) string {
	t.Helper()
	h, _ := bcrypt.GenerateFromPassword([]byte("Str0ngP@ssw0rd!!"), 4)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, 'admin-resources@example.test', ?, 'Admin Resources', 'admin', 0, 0, 1, ?, ?)`,
		id, string(h), now, now)
	require.NoError(t, err)
	return id
}

func loginAsRs(t *testing.T, db *sql.DB, cfg *config.Config, email, password string) (string, string) {
	t.Helper()
	log, _ := logger.New("test")
	authRepo := auth.NewAuthRepo(db)
	authCfg, _ := auth.LoadAuthConfig()
	authSvc, _ := auth.BuildService(authCfg, authRepo)
	tokens := auth.NewJWTTokenIssuer([]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL)
	authH := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env: cfg.Env, AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)
	app := fiber.New(fiber.Config{ErrorHandler: errs.Handler(log), DisableStartupMessage: true})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{Header: "X-Request-Id", Generator: func() string { return uuid.NewString() }}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)

	body, _ := json.Marshal(map[string]any{"email": email, "password": password})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 200, resp.StatusCode, "login: %s", string(b))
	var out struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken, out.User.ID
}

// insertRsCourse + Chapter + Lesson FK chain.
func insertRsCourse(t *testing.T, db *sql.DB, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)`,
		id, title, now, now)
	require.NoError(t, err)
	return id
}
func insertRsChapter(t *testing.T, db *sql.DB, courseID, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO chapters (id, course_id, title, order_index, created_at) VALUES (?, ?, ?, 0, ?)`,
		id, courseID, title, now)
	require.NoError(t, err)
	return id
}
func insertRsLesson(t *testing.T, db *sql.DB, chapterID, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO lessons (id, chapter_id, title, order_index, created_at) VALUES (?, ?, ?, 0, ?)`,
		id, chapterID, title, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestResources_ListRequiresLesson(t *testing.T) {
	env := setupResourcesEnv(t)
	courseID := insertRsCourse(t, env.db, "C")
	chapterID := insertRsChapter(t, env.db, courseID, "Ch")
	lessonID := insertRsLesson(t, env.db, chapterID, "L")

	// Empty lesson → empty list
	status, raw := env.do(t, "GET", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)

	// Unknown lesson → 404
	status, _ = env.do(t, "GET", "/api/v1/lessons/00000000-0000-0000-0000-000000000000/resources", env.adminTok, nil)
	require.Equal(t, 404, status)
}

func TestResources_CreateAndList_AndBadType(t *testing.T) {
	env := setupResourcesEnv(t)
	courseID := insertRsCourse(t, env.db, "C")
	chapterID := insertRsChapter(t, env.db, courseID, "Ch")
	lessonID := insertRsLesson(t, env.db, chapterID, "L")

	// Create resource
	status, raw := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"title": "Slides",
		"url":   "https://x.test/slides.pdf",
		"type":  "pdf",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var r map[string]any
	require.NoError(t, json.Unmarshal(raw, &r))
	require.Equal(t, "Slides", r["title"])
	require.Equal(t, "pdf", r["type"])
	require.Equal(t, true, r["isLocked"], "isLocked defaults to true")

	// Bad type → 400
	status, raw = env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"title": "X",
		"url":   "https://x.test/x",
		"type":  "exe",
	})
	require.Equal(t, 400, status, "bad type: %s", string(raw))

	// Bad URL → 400
	status, raw = env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"title": "X",
		"url":   "javascript:alert(1)",
		"type":  "pdf",
	})
	require.Equal(t, 400, status, "bad url: %s", string(raw))

	// Missing title → 400
	status, raw = env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"url":  "https://x.test/x",
		"type": "pdf",
	})
	require.Equal(t, 400, status, "missing title: %s", string(raw))

	// Missing url → 400
	status, raw = env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"title": "X",
		"type":  "pdf",
	})
	require.Equal(t, 400, status, "missing url: %s", string(raw))

	// Unknown lesson → 404
	status, raw = env.do(t, "POST", "/api/v1/lessons/00000000-0000-0000-0000-000000000000/resources", env.adminTok, map[string]any{
		"title": "X", "url": "https://x.test/x", "type": "pdf",
	})
	require.Equal(t, 404, status, "unknown lesson: %s", string(raw))
}

func TestResources_UpdateAndDelete(t *testing.T) {
	env := setupResourcesEnv(t)
	courseID := insertRsCourse(t, env.db, "C")
	chapterID := insertRsChapter(t, env.db, courseID, "Ch")
	lessonID := insertRsLesson(t, env.db, chapterID, "L")

	status, raw := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
		"title": "R1", "url": "https://x.test/r1.pdf", "type": "pdf",
	})
	require.Equal(t, 201, status)
	var r map[string]any
	require.NoError(t, json.Unmarshal(raw, &r))
	id := r["id"].(string)

	// PATCH title + unlock
	status, raw = env.do(t, "PATCH", "/api/v1/resources/"+id, env.adminTok, map[string]any{
		"title":    "R1-renamed",
		"isLocked": false,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "R1-renamed", updated["title"])
	require.Equal(t, false, updated["isLocked"])

	// Bad type → 400
	status, raw = env.do(t, "PATCH", "/api/v1/resources/"+id, env.adminTok, map[string]any{
		"type": "lol",
	})
	require.Equal(t, 400, status, "bad type: %s", string(raw))

	// PATCH unknown → 404
	status, _ = env.do(t, "PATCH", "/api/v1/resources/00000000-0000-0000-0000-000000000000", env.adminTok, map[string]any{
		"title": "X",
	})
	require.Equal(t, 404, status)

	// DELETE
	status, raw = env.do(t, "DELETE", "/api/v1/resources/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// List → empty
	status, raw = env.do(t, "GET", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "deleted resource should not appear in list")
}

func TestResources_LessonDelete_CascadesToResources(t *testing.T) {
	env := setupResourcesEnv(t)
	courseID := insertRsCourse(t, env.db, "C-cascade")
	chapterID := insertRsChapter(t, env.db, courseID, "Ch")
	lessonID := insertRsLesson(t, env.db, chapterID, "L")

	// 2 resources
	for _, n := range []string{"R1", "R2"} {
		status, _ := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/resources", env.adminTok, map[string]any{
			"title": n, "url": "https://x.test/" + n + ".pdf", "type": "pdf",
		})
		require.Equal(t, 201, status)
	}

	// Delete lesson
	status, _ := env.do(t, "DELETE", "/api/v1/lessons/"+lessonID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// Verify resources also soft-deleted
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM resources WHERE lesson_id = ? AND deleted_at IS NULL`, lessonID).Scan(&n))
	require.Equal(t, 0, n, "resources should be cascaded")
}
