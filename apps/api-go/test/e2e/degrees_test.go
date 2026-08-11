// Package e2e — degrees module end-to-end test.
//
// Phase 2 T14-1: covers the 6 /api/v1/degrees/* endpoints.
//
//	GET    /degrees                 list (public; admin sees drafts)
//	GET    /degrees/:id             get one (admin sees drafts)
//	POST   /degrees                 create (admin)
//	PATCH  /degrees/:id             update (admin)
//	DELETE /degrees/:id             delete (admin; refuses if enrollments exist)
//	POST   /degrees/:id/courses     link courses (admin)
//
// Mirrors apps/api/src/modules/degrees/degrees.controller.ts 1:1.
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
	"github.com/frankfika/ai-academy/api-go/internal/degrees"
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

type degreesTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupDegreesEnv(t *testing.T) *degreesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_degrees_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_degrees_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	// Bootstrap admin (single shared email across the test, so insert + login match)
	adminEmail := makeEmail("deg-admin")
	adminID := insertUserDirect(t, db, adminEmail, "Admin Degrees", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")
	_ = adminID

	degreesRepo := degrees.NewRepo(db)
	degreesSvc := degrees.NewService(degreesRepo, log)
	degreesH := handler.NewDegreesHandler(degreesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-degrees",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	degreesH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &degreesTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *degreesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *degreesTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *degreesTestEnv) insertDegree(t *testing.T, title, status string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO nano_degrees (id, title, description, learning_points, price, cost_type, status, updated_at)
		VALUES (?, ?, 'x', 'x', 0, 'free', ?, ?)
	`, id, title, status, now)
	require.NoError(t, err)
	return id
}

func (e *degreesTestEnv) insertCourse(t *testing.T, title, costType string) string {
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

func TestDegrees_Unauthenticated_401(t *testing.T) {
	env := setupDegreesEnv(t)
	// Public list works without auth, but the admin routes must 401.
	status, _ := env.do(t, "POST", "/api/v1/degrees", "", map[string]any{
		"title": "x", "description": "x", "learningPoints": "x", "price": "0", "costType": "free",
	})
	require.Equal(t, 401, status)

	status, _ = env.do(t, "PATCH", "/api/v1/degrees/x", "", map[string]any{})
	require.Equal(t, 401, status)

	status, _ = env.do(t, "DELETE", "/api/v1/degrees/x", "", nil)
	require.Equal(t, 401, status)
}

func TestDegrees_NonAdmin_403(t *testing.T) {
	env := setupDegreesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("deg-stu"))

	// Student → 403
	status, raw := env.do(t, "POST", "/api/v1/degrees", tok, map[string]any{
		"title": "x", "description": "x", "learningPoints": "x", "price": "0", "costType": "free",
	})
	require.Equal(t, 403, status, "student must be 403: %s", string(raw))
}

func TestDegrees_PublicList_OnlyPublished(t *testing.T) {
	env := setupDegreesEnv(t)
	pubID := env.insertDegree(t, "PubD", "published")
	_ = env.insertDegree(t, "DraftD", "draft")

	status, raw := env.do(t, "GET", "/api/v1/degrees", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Len(t, listResp, 1, "public should only see published")
	require.Equal(t, pubID, listResp[0]["id"])
}

func TestDegrees_AdminList_AllStatuses(t *testing.T) {
	env := setupDegreesEnv(t)
	env.insertDegree(t, "PubA", "published")
	env.insertDegree(t, "DraftA", "draft")

	status, raw := env.do(t, "GET", "/api/v1/degrees", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Len(t, listResp, 2, "admin should see all")
}

func TestDegrees_GetDraft_HiddenFromPublic(t *testing.T) {
	env := setupDegreesEnv(t)
	draftID := env.insertDegree(t, "DraftG", "draft")

	// Public → 404
	status, _ := env.do(t, "GET", "/api/v1/degrees/"+draftID, "", nil)
	require.Equal(t, 404, status, "public must not see draft")

	// Admin → 200
	status, raw := env.do(t, "GET", "/api/v1/degrees/"+draftID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin get: %s", string(raw))
}

func TestDegrees_AdminCreate_AndUpdate_AndDelete(t *testing.T) {
	env := setupDegreesEnv(t)

	// Create
	status, raw := env.do(t, "POST", "/api/v1/degrees", env.adminTok, map[string]any{
		"title":          "D1",
		"description":    "x",
		"learningPoints": "x",
		"price":          "0",
		"costType":       "free",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Status string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "D1", created.Title)
	require.Equal(t, "draft", created.Status, "default status is draft")

	// Bad costType
	status, raw = env.do(t, "POST", "/api/v1/degrees", env.adminTok, map[string]any{
		"title": "D2", "description": "x", "learningPoints": "x", "price": "0", "costType": "weird",
	})
	require.Equal(t, 400, status, "bad costType: %s", string(raw))

	// Update
	status, raw = env.do(t, "PATCH", "/api/v1/degrees/"+created.ID, env.adminTok, map[string]any{
		"title": "D1-renamed", "status": "published",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated struct {
		Title  string `json:"title"`
		Status string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "D1-renamed", updated.Title)
	require.Equal(t, "published", updated.Status)

	// Delete
	status, raw = env.do(t, "DELETE", "/api/v1/degrees/"+created.ID, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// Verify gone
	status, _ = env.do(t, "GET", "/api/v1/degrees/"+created.ID, env.adminTok, nil)
	require.Equal(t, 404, status)
}

func TestDegrees_LinkCourses_Bulk(t *testing.T) {
	env := setupDegreesEnv(t)
	degreeID := env.insertDegree(t, "LinkD", "published")
	c1 := env.insertCourse(t, "C1", "free")
	c2 := env.insertCourse(t, "C2", "free")

	status, raw := env.do(t, "POST", "/api/v1/degrees/"+degreeID+"/courses", env.adminTok, map[string]any{
		"courses": []map[string]any{
			{"courseId": c1, "orderIndex": 0},
			{"courseId": c2, "orderIndex": 1},
		},
	})
	require.Equal(t, 200, status, "link: %s", string(raw))

	// Verify via DB
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM degree_courses WHERE degree_id = ?`, degreeID).Scan(&n))
	require.Equal(t, 2, n)

	// Re-link same courses (idempotent — should not duplicate)
	status, _ = env.do(t, "POST", "/api/v1/degrees/"+degreeID+"/courses", env.adminTok, map[string]any{
		"courses": []map[string]any{
			{"courseId": c1, "orderIndex": 0},
		},
	})
	require.Equal(t, 200, status)
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM degree_courses WHERE degree_id = ?`, degreeID).Scan(&n))
	require.Equal(t, 2, n, "duplicate link should not create new rows")
}

func TestDegrees_Delete_WithEnrollments_409(t *testing.T) {
	env := setupDegreesEnv(t)
	degreeID := env.insertDegree(t, "EnrollD", "published")
	tok, userID := env.registerStudent(t, makeEmail("deg-enrolled"))
	_ = tok

	// Insert active enrollment
	_, err := env.db.Exec(`INSERT INTO enrollments (id, user_id, degree_id, enrolled_at, source) VALUES (?, ?, ?, NOW(3), 'direct')`,
		uuid.NewString(), userID, degreeID)
	require.NoError(t, err)

	// Delete → 409 (active enrollments exist)
	status, raw := env.do(t, "DELETE", "/api/v1/degrees/"+degreeID, env.adminTok, nil)
	require.Equal(t, 409, status, "must be 409 with active enrollments: %s", string(raw))
}
