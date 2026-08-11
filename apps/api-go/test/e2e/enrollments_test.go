// Package e2e — enrollments module end-to-end test.
//
// Phase 2 T13-1: covers the 2 /api/v1/enrollments/* endpoints.
//
//	GET  /enrollments/me                list current user's enrollments
//	POST /enrollments/courses/:id/free  enroll in a free/charity course
//
// Behavior mirrors NestJS enrollments.controller.ts 1:1.
//   - free/charity cost_type → success
//   - paid cost_type          → 400 "This course is not free"
//   - duplicate enroll         → idempotent revive (still 1 row)
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
	"github.com/frankfika/ai-academy/api-go/internal/enrollments"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type enrollTestEnv struct {
	app   *fiber.App
	db    *sql.DB
	log   *zap.Logger
	admin string // admin token (used to seed courses/degrees when needed)
}

func setupEnrollmentsEnv(t *testing.T) *enrollTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_enrollments_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_enrollments_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	enrollmentsRepo := enrollments.NewRepo(db)
	enrollmentsSvc := enrollments.NewService(enrollmentsRepo, log)
	enrollmentsH := handler.NewEnrollmentsHandler(enrollmentsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-enrollments",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	enrollmentsH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &enrollTestEnv{app: app, db: db, log: log}
}

func (e *enrollTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *enrollTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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
	require.NotEmpty(t, out.AccessToken)
	return out.AccessToken, out.User.ID
}

func (e *enrollTestEnv) insertCourse(t *testing.T, title, costType string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', ?, 0, 'published', 'own', ?, ?)
	`, id, title, costType, now, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestEnrollments_Unauthenticated_401(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/enrollments/me", "", nil)
	require.Equal(t, 401, status, "unauthenticated list must be 401")
}

func TestEnrollments_ListMe_EmptyForNewStudent(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("enr-empty"))

	status, raw := env.do(t, "GET", "/api/v1/enrollments/me", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Empty(t, listResp, "new user should have 0 enrollments")
}

func TestEnrollments_FreeCourseEnroll(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("enr-free"))
	courseID := env.insertCourse(t, "Free Course A", "free")

	// Enroll
	status, raw := env.do(t, "POST", "/api/v1/enrollments/courses/"+courseID+"/free", tok, nil)
	require.Equal(t, 201, status, "enroll free: %s", string(raw))

	var enr struct {
		Enrollment struct {
			ID       string  `json:"id"`
			UserID   string  `json:"userId"`
			CourseID *string `json:"courseId"`
			Source   string  `json:"source"`
		} `json:"enrollment"`
		Course struct {
			Title string `json:"title"`
		} `json:"course"`
	}
	require.NoError(t, json.Unmarshal(raw, &enr))
	// Public DTO: camelCase + plain string. Matches the OpenAPI spec.
	require.Equal(t, courseID, *enr.Enrollment.CourseID)
	require.Equal(t, "direct", enr.Enrollment.Source)
	require.Equal(t, "Free Course A", enr.Course.Title)

	// List /me — should be 1
	status, raw = env.do(t, "GET", "/api/v1/enrollments/me", tok, nil)
	require.Equal(t, 200, status)
	var listResp []struct {
		Enrollment struct {
			ID       string  `json:"id"`
			CourseID *string `json:"courseId"`
		} `json:"enrollment"`
	}
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Len(t, listResp, 1, "should have 1 enrollment after enrolling")
	require.Equal(t, courseID, *listResp[0].Enrollment.CourseID)
}

func TestEnrollments_CharityCourseEnroll_Allowed(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("enr-charity"))
	courseID := env.insertCourse(t, "Charity Course", "charity")

	status, raw := env.do(t, "POST", "/api/v1/enrollments/courses/"+courseID+"/free", tok, nil)
	require.Equal(t, 201, status, "charity must be allowed: %s", string(raw))
}

func TestEnrollments_PaidCourseEnroll_400(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("enr-paid"))
	courseID := env.insertCourse(t, "Paid Course", "paid")

	status, raw := env.do(t, "POST", "/api/v1/enrollments/courses/"+courseID+"/free", tok, nil)
	require.Equal(t, 400, status, "paid course must be 400: %s", string(raw))
	var envResp errs.Envelope
	require.NoError(t, json.Unmarshal(raw, &envResp))
	require.Contains(t, envResp.Message, "not free")
}

func TestEnrollments_DoubleEnroll_Idempotent(t *testing.T) {
	env := setupEnrollmentsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("enr-twice"))
	courseID := env.insertCourse(t, "Free Twice", "free")

	// First enroll
	status, _ := env.do(t, "POST", "/api/v1/enrollments/courses/"+courseID+"/free", tok, nil)
	require.Equal(t, 201, status)

	// Second enroll — should still succeed (idempotent revive)
	status, _ = env.do(t, "POST", "/api/v1/enrollments/courses/"+courseID+"/free", tok, nil)
	require.Equal(t, 201, status, "second enroll should be idempotent")

	// List /me — should still be 1
	status, raw := env.do(t, "GET", "/api/v1/enrollments/me", tok, nil)
	require.Equal(t, 200, status)
	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Len(t, listResp, 1, "double-enroll should still be 1 row")
}
