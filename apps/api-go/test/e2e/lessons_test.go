// Package e2e — lessons module end-to-end test.
//
// Phase 2 T12-3: covers the 5 lesson endpoints. All admin-only.
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

type lessonsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupLessonsEnv(t *testing.T) *lessonsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_lessons_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_lessons_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminID := bootstrapLsAdmin(t, db)
	adminTok, _ := loginAsLs(t, db, cfg, "admin-lessons@example.test", "Str0ngP@ssw0rd!!")
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

	// Wire cascade (chapter delete → lessons delete)
	chapters.LessonSoftDeleteByChapter = func(ctx context.Context, _ *sql.DB, chapterID string) (int64, error) {
		return lessonsRepo.SoftDeleteByChapter(ctx, chapterID)
	}

	lessonsH := handler.NewLessonsHandler(lessonsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-lessons",
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

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &lessonsTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *lessonsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func bootstrapLsAdmin(t *testing.T, db *sql.DB) string {
	t.Helper()
	h, _ := bcrypt.GenerateFromPassword([]byte("Str0ngP@ssw0rd!!"), 4)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, 'admin-lessons@example.test', ?, 'Admin Lessons', 'admin', 0, 0, 1, ?, ?)`,
		id, string(h), now, now)
	require.NoError(t, err)
	return id
}

func loginAsLs(t *testing.T, db *sql.DB, cfg *config.Config, email, password string) (string, string) {
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

// insertLsCourse writes a course row (FK target for chapter).
func insertLsCourse(t *testing.T, db *sql.DB, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)`,
		id, title, now, now)
	require.NoError(t, err)
	return id
}

// insertLsChapter writes a chapter row.
func insertLsChapter(t *testing.T, db *sql.DB, courseID, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO chapters (id, course_id, title, description, order_index, created_at)
		VALUES (?, ?, ?, NULL, 0, ?)`, id, courseID, title, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestLessons_ListRequiresChapter(t *testing.T) {
	env := setupLessonsEnv(t)
	courseID := insertLsCourse(t, env.db, "C-l")
	chapterID := insertLsChapter(t, env.db, courseID, "Ch1")

	// Empty chapter → empty list
	status, raw := env.do(t, "GET", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)

	// Unknown chapter → 404
	status, _ = env.do(t, "GET", "/api/v1/chapters/00000000-0000-0000-0000-000000000000/lessons", env.adminTok, nil)
	require.Equal(t, 404, status)

	// No auth → 401
	status, _ = env.do(t, "GET", "/api/v1/chapters/"+chapterID+"/lessons", "", nil)
	require.Equal(t, 401, status)
}

func TestLessons_CreateAndList_AndAutoOrderIndex(t *testing.T) {
	env := setupLessonsEnv(t)
	courseID := insertLsCourse(t, env.db, "C")
	chapterID := insertLsChapter(t, env.db, courseID, "Ch")

	// Create 3 lessons without orderIndex
	var ids []string
	for _, n := range []string{"L1", "L2", "L3"} {
		status, raw := env.do(t, "POST", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, map[string]any{
			"title":         n,
			"videoUrl":      "https://x.test/v.mp4",
			"videoDuration": 60,
		})
		require.Equal(t, 201, status, "create: %s", string(raw))
		var l map[string]any
		require.NoError(t, json.Unmarshal(raw, &l))
		ids = append(ids, l["id"].(string))
	}

	// List — orderIndex 0,1,2
	status, raw := env.do(t, "GET", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)
	require.Equal(t, "L1", list[0]["title"])
	require.Equal(t, float64(0), list[0]["orderIndex"])

	// Missing title → 400
	status, raw = env.do(t, "POST", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, map[string]any{})
	require.Equal(t, 400, status)

	// Bad videoUrl (javascript:) → 400
	status, raw = env.do(t, "POST", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, map[string]any{
		"title":    "X",
		"videoUrl": "javascript:alert(1)",
	})
	require.Equal(t, 400, status, "bad url: %s", string(raw))

	// Unknown chapter → 404
	status, raw = env.do(t, "POST", "/api/v1/chapters/00000000-0000-0000-0000-000000000000/lessons", env.adminTok, map[string]any{
		"title": "X",
	})
	require.Equal(t, 404, status)
}

func TestLessons_UpdateAndDelete(t *testing.T) {
	env := setupLessonsEnv(t)
	courseID := insertLsCourse(t, env.db, "C")
	chapterID := insertLsChapter(t, env.db, courseID, "Ch")
	status, raw := env.do(t, "POST", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, map[string]any{
		"title": "Original",
	})
	require.Equal(t, 201, status)
	var l map[string]any
	require.NoError(t, json.Unmarshal(raw, &l))
	id := l["id"].(string)

	// PATCH title + isPreview
	status, raw = env.do(t, "PATCH", "/api/v1/lessons/"+id, env.adminTok, map[string]any{
		"title":     "Updated",
		"isPreview": true,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "Updated", updated["title"])
	require.Equal(t, true, updated["isPreview"])

	// PATCH unknown → 404
	status, _ = env.do(t, "PATCH", "/api/v1/lessons/00000000-0000-0000-0000-000000000000", env.adminTok, map[string]any{
		"title": "X",
	})
	require.Equal(t, 404, status)

	// DELETE
	status, raw = env.do(t, "DELETE", "/api/v1/lessons/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// List → empty
	status, raw = env.do(t, "GET", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "deleted lesson should not appear")
}

func TestLessons_Reorder_AndOwnershipGuard(t *testing.T) {
	env := setupLessonsEnv(t)
	courseID := insertLsCourse(t, env.db, "C")
	chA := insertLsChapter(t, env.db, courseID, "ChA")
	chB := insertLsChapter(t, env.db, courseID, "ChB")

	// 3 lessons in chA
	var aIDs []string
	for _, n := range []string{"a1", "a2", "a3"} {
		status, raw := env.do(t, "POST", "/api/v1/chapters/"+chA+"/lessons", env.adminTok, map[string]any{
			"title": n,
		})
		require.Equal(t, 201, status)
		var l map[string]any
		require.NoError(t, json.Unmarshal(raw, &l))
		aIDs = append(aIDs, l["id"].(string))
	}
	// 1 lesson in chB
	status, raw := env.do(t, "POST", "/api/v1/chapters/"+chB+"/lessons", env.adminTok, map[string]any{
		"title": "b1",
	})
	require.Equal(t, 201, status)
	var bL map[string]any
	require.NoError(t, json.Unmarshal(raw, &bL))
	bID := bL["id"].(string)

	// Reorder chA: reverse
	reversed := []string{aIDs[2], aIDs[0], aIDs[1]}
	status, raw = env.do(t, "POST", "/api/v1/chapters/"+chA+"/lessons/reorder", env.adminTok, map[string]any{
		"ids": reversed,
	})
	require.Equal(t, 200, status, "reorder: %s", string(raw))

	// Verify new order
	status, raw = env.do(t, "GET", "/api/v1/chapters/"+chA+"/lessons", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)
	require.Equal(t, aIDs[2], list[0]["id"])
	require.Equal(t, float64(0), list[0]["orderIndex"])

	// Cross-chapter reorder → 403
	status, raw = env.do(t, "POST", "/api/v1/chapters/"+chA+"/lessons/reorder", env.adminTok, map[string]any{
		"ids": []string{aIDs[0], bID},
	})
	require.Equal(t, 403, status, "cross-chapter: %s", string(raw))
}

func TestLessons_ChapterDelete_CascadesToLessons(t *testing.T) {
	env := setupLessonsEnv(t)
	courseID := insertLsCourse(t, env.db, "C-cascade")
	chapterID := insertLsChapter(t, env.db, courseID, "Ch")

	// Create 2 lessons
	for _, n := range []string{"L1", "L2"} {
		status, _ := env.do(t, "POST", "/api/v1/chapters/"+chapterID+"/lessons", env.adminTok, map[string]any{
			"title": n,
		})
		require.Equal(t, 201, status)
	}

	// Delete chapter
	status, _ := env.do(t, "DELETE", "/api/v1/chapters/"+chapterID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// Verify lessons are also soft-deleted
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM lessons WHERE chapter_id = ? AND deleted_at IS NULL`, chapterID).Scan(&n))
	require.Equal(t, 0, n, "lessons should be cascaded")
}
