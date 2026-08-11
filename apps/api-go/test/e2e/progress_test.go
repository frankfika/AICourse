// Package e2e — progress module end-to-end test.
//
// Phase 2 T15-1: covers the 4 /api/v1/progress/* endpoints.
//
//	GET  /progress/me                       list all my progress
//	GET  /progress/me/stats                 learning stats (dashboard)
//	GET  /progress/courses/:courseId        progress for a specific course
//	POST /progress/lessons/:lessonId/complete  mark lesson done
//
// Mirrors apps/api/src/modules/progress/progress.controller.ts 1:1.
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
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/progress"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type progressTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupProgressEnv(t *testing.T) *progressTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_progress_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_progress_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	progressRepo := progress.NewRepo(db)
	progressSvc := progress.NewService(progressRepo, log)
	progressH := handler.NewProgressHandler(progressSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-progress",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	progressH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &progressTestEnv{app: app, db: db, log: log}
}

func (e *progressTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *progressTestEnv) registerStudent(t *testing.T, email string) (string, string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"email": email, "password": "Str0ngP@ssw0rd!!", "name": "Student",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "register: %s", string(b))
	var out struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken, out.User.ID
}

// insertCourseChapterLesson creates a course + chapter + 2 lessons
// for progress tests. Returns the course ID, chapter ID, and 2 lesson IDs.
func (e *progressTestEnv) insertCourseChapterLesson(t *testing.T) (string, string, string, string) {
	t.Helper()
	now := time.Now().UTC()
	courseID := uuid.NewString()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Test', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)
	`, courseID, now, now)
	require.NoError(t, err)
	chapterID := uuid.NewString()
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO chapters (id, course_id, title, description, order_index, created_at)
		VALUES (?, ?, 'Ch 1', 'x', 0, ?)
	`, chapterID, courseID, now)
	require.NoError(t, err)
	lesson1ID := uuid.NewString()
	lesson2ID := uuid.NewString()
	// Note: lessons table has no `updated_at` column (only `created_at`
	// + `deleted_at`). The lesson+chapter insert below matches the
	// schema in db/migrations/0001_init.sql.
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO lessons (id, chapter_id, title, description, order_index, is_preview, created_at)
		VALUES (?, ?, 'L1', 'x', 0, 0, ?), (?, ?, 'L2', 'x', 1, 0, ?)
	`, lesson1ID, chapterID, now, lesson2ID, chapterID, now)
	require.NoError(t, err)
	return courseID, chapterID, lesson1ID, lesson2ID
}

// ============ TESTS ============

func TestProgress_Unauthenticated_401(t *testing.T) {
	env := setupProgressEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/progress/me", "", nil)
	require.Equal(t, 401, status)

	status, _ = env.do(t, "POST", "/api/v1/progress/lessons/x/complete", "", nil)
	require.Equal(t, 401, status)
}

func TestProgress_Me_EmptyForNewUser(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-empty"))

	status, raw := env.do(t, "GET", "/api/v1/progress/me", tok, nil)
	require.Equal(t, 200, status, "me: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)
}

func TestProgress_CompleteLesson_Success(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-complete"))
	courseID, _, lessonID, _ := env.insertCourseChapterLesson(t)

	status, raw := env.do(t, "POST", "/api/v1/progress/lessons/"+lessonID+"/complete", tok, nil)
	require.Equal(t, 200, status, "complete: %s", string(raw))
	var dto struct {
		Status      string  `json:"status"`
		LessonID    string  `json:"lessonId"`
		CourseID    string  `json:"courseId"`
		CompletedAt *string `json:"completedAt"`
	}
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.Equal(t, "completed", dto.Status)
	require.Equal(t, lessonID, dto.LessonID)
	require.Equal(t, courseID, dto.CourseID, "courseId should be denormalized from lesson")
	require.NotNil(t, dto.CompletedAt)
}

func TestProgress_CompleteLesson_Idempotent(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-twice"))
	_, _, lessonID, _ := env.insertCourseChapterLesson(t)

	// First
	status, raw := env.do(t, "POST", "/api/v1/progress/lessons/"+lessonID+"/complete", tok, nil)
	require.Equal(t, 200, status)
	var first struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &first))

	// Second — should return same ID, no new row
	status, raw = env.do(t, "POST", "/api/v1/progress/lessons/"+lessonID+"/complete", tok, nil)
	require.Equal(t, 200, status)
	var second struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &second))
	require.Equal(t, first.ID, second.ID, "idempotent: same progress ID")

	// Verify only 1 row exists
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM progress_records WHERE lesson_id = ?`, lessonID).Scan(&n))
	require.Equal(t, 1, n, "should be exactly 1 row, not 2")
}

func TestProgress_Me_ListsCompleted(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-list"))
	courseID, _, lesson1, lesson2 := env.insertCourseChapterLesson(t)

	_, _ = env.do(t, "POST", "/api/v1/progress/lessons/"+lesson1+"/complete", tok, nil)
	_, _ = env.do(t, "POST", "/api/v1/progress/lessons/"+lesson2+"/complete", tok, nil)

	status, raw := env.do(t, "GET", "/api/v1/progress/me", tok, nil)
	require.Equal(t, 200, status)
	var list []struct {
		CourseID string `json:"courseId"`
		Status   string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 2)
	for _, p := range list {
		require.Equal(t, courseID, p.CourseID)
		require.Equal(t, "completed", p.Status)
	}
}

func TestProgress_CourseProgress_Filter(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-filter"))
	courseID, _, lesson1, _ := env.insertCourseChapterLesson(t)

	// Complete one lesson in course A
	_, _ = env.do(t, "POST", "/api/v1/progress/lessons/"+lesson1+"/complete", tok, nil)

	// Create another course with a lesson (not completed)
	c2, _, l2, _ := env.insertCourseChapterLesson(t)
	_ = c2
	_ = l2

	status, raw := env.do(t, "GET", "/api/v1/progress/courses/"+courseID, tok, nil)
	require.Equal(t, 200, status, "course progress: %s", string(raw))
	var list []struct {
		CourseID string `json:"courseId"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "should only return records for the requested course")
	require.Equal(t, courseID, list[0].CourseID)
}

func TestProgress_Stats_ForNewUser(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-stats"))

	status, raw := env.do(t, "GET", "/api/v1/progress/me/stats", tok, nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))
	var stats struct {
		TotalLessonsCompleted int64    `json:"totalLessonsCompleted"`
		CompletedCourseIDs    []string `json:"completedCourseIds"`
		StreakDays            int32    `json:"streakDays"`
		EnrollmentsCount      int64    `json:"enrollmentsCount"`
		Points                int32    `json:"points"`
	}
	require.NoError(t, json.Unmarshal(raw, &stats))
	require.Equal(t, int64(0), stats.TotalLessonsCompleted)
	require.Empty(t, stats.CompletedCourseIDs)
	require.Equal(t, int32(0), stats.StreakDays)
}

func TestProgress_Stats_AfterCompletion(t *testing.T) {
	env := setupProgressEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("prog-stats-after"))
	_, _, lesson1, lesson2 := env.insertCourseChapterLesson(t)

	_, _ = env.do(t, "POST", "/api/v1/progress/lessons/"+lesson1+"/complete", tok, nil)
	_, _ = env.do(t, "POST", "/api/v1/progress/lessons/"+lesson2+"/complete", tok, nil)

	status, raw := env.do(t, "GET", "/api/v1/progress/me/stats", tok, nil)
	require.Equal(t, 200, status)
	var stats struct {
		TotalLessonsCompleted int64 `json:"totalLessonsCompleted"`
		StreakDays            int32 `json:"streakDays"`
	}
	require.NoError(t, json.Unmarshal(raw, &stats))
	require.Equal(t, int64(2), stats.TotalLessonsCompleted, "2 lessons completed")
	require.GreaterOrEqual(t, stats.StreakDays, int32(1), "streak should be >= 1 (today)")
}
