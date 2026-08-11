// Package e2e — reviews module end-to-end test.
//
// Phase 2 T15-4: covers the 5 /api/v1/reviews/* endpoints.
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
	"github.com/frankfika/ai-academy/api-go/internal/reviews"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type reviewsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupReviewsEnv(t *testing.T) *reviewsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_reviews_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_reviews_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("rv-admin")
	_ = insertUserDirect(t, db, adminEmail, "Admin Reviews", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	reviewsRepo := reviews.NewRepo(db)
	reviewsSvc := reviews.NewService(reviewsRepo, log)
	reviewsH := handler.NewReviewsHandler(reviewsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-reviews",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	reviewsH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &reviewsTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *reviewsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *reviewsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *reviewsTestEnv) insertCourse(t *testing.T, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)
	`, id, title, now, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestReviews_Unauthenticated_401(t *testing.T) {
	env := setupReviewsEnv(t)
	courseID := env.insertCourse(t, "R1")
	// POST requires auth
	status, _ := env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", "", map[string]any{
		"rating": 5, "content": "Great",
	})
	require.Equal(t, 401, status)
	// Admin routes require auth
	status, _ = env.do(t, "GET", "/api/v1/reviews", "", nil)
	require.Equal(t, 401, status)
}

func TestReviews_Create_AndPublicList(t *testing.T) {
	env := setupReviewsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("rv-cr"))
	courseID := env.insertCourse(t, "R1")

	// Create
	status, raw := env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tok, map[string]any{
		"rating":  5,
		"content": "Excellent course!",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		Rating  int32  `json:"rating"`
		Content string `json:"content"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, int32(5), created.Rating)

	// Bad rating
	status, _ = env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tok, map[string]any{
		"rating": 6, "content": "x",
	})
	require.Equal(t, 400, status)

	// Public list (no auth)
	status, raw = env.do(t, "GET", "/api/v1/courses/"+courseID+"/reviews", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
}

func TestReviews_OneReviewPerUserCourse(t *testing.T) {
	env := setupReviewsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("rv-one"))
	courseID := env.insertCourse(t, "R1")

	// First
	status, _ := env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tok, map[string]any{
		"rating": 5, "content": "First",
	})
	require.Equal(t, 201, status)

	// Second (same user, same course) — should return existing
	status, _ = env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tok, map[string]any{
		"rating": 4, "content": "Updated",
	})
	require.Equal(t, 201, status, "idempotent: should return existing")

	// Only 1 review in DB
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?) AND course_id = ?`,
		"user-rv-one-%", courseID).Scan(&n))
	require.Equal(t, 1, n, "should be exactly 1 review row")
}

func TestReviews_MarkHelpful(t *testing.T) {
	env := setupReviewsEnv(t)
	tokA, _ := env.registerStudent(t, makeEmail("rv-help-a"))
	tokB, _ := env.registerStudent(t, makeEmail("rv-help-b"))
	courseID := env.insertCourse(t, "R1")

	// A creates
	status, raw := env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tokA, map[string]any{
		"rating": 5, "content": "Good",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// B marks helpful
	status, raw = env.do(t, "POST", "/api/v1/reviews/"+created.ID+"/helpful", tokB, nil)
	require.Equal(t, 200, status, "helpful: %s", string(raw))
	var helpful struct {
		Helpful int32 `json:"helpful"`
	}
	require.NoError(t, json.Unmarshal(raw, &helpful))
	require.Equal(t, int32(1), helpful.Helpful)
}

func TestReviews_AdminListAndSoftDelete(t *testing.T) {
	env := setupReviewsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("rv-adm"))
	courseID := env.insertCourse(t, "R1")
	env.do(t, "POST", "/api/v1/courses/"+courseID+"/reviews", tok, map[string]any{
		"rating": 4, "content": "Good",
	})

	// Admin list — 1 review
	status, raw := env.do(t, "GET", "/api/v1/reviews", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)

	// Soft-delete
	var reviewID string
	for _, r := range list {
		reviewID = r["id"].(string)
	}
	status, _ = env.do(t, "DELETE", "/api/v1/reviews/"+reviewID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// Public list now returns 0 (soft-deleted hidden)
	status, raw = env.do(t, "GET", "/api/v1/courses/"+courseID+"/reviews", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "soft-deleted review should be hidden from public")

	// Admin list with onlyDeleted=true shows it
	status, raw = env.do(t, "GET", "/api/v1/reviews?onlyDeleted=true", env.adminTok, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "onlyDeleted=true should show soft-deleted")
}
