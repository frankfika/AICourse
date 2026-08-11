// Package e2e — courses module end-to-end test.
//
// Phase 2 T12-1: covers the 6 /api/v1/courses/* endpoints. Public list
// + detail are reachable without auth; admin can filter by status / see
// drafts / create / update / delete / link to degrees.
//
// Uses dockertest MySQL + real Prisma-derived schema, same as T11.
package e2e

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/courses"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
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

type coursesTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupCoursesEnv(t *testing.T) *coursesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_courses_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_courses_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	// Bootstrap users: admin (direct SQL) + student (via /auth/register)
	adminID := insertUserDirect(t, db, "admin-courses@example.test", "Admin Courses", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, "admin-courses@example.test", "Str0ngP@ssw0rd!!")
	_ = adminID

	usersRepo := users.NewRepo(db)
	usersSvc := users.NewService(usersRepo, log, 4)
	usersH := handler.NewUsersHandler(usersSvc, tokens, log)
	identitiesH := handler.NewIdentitiesHandler(usersSvc, tokens, log)

	coursesRepo := courses.NewRepo(db)
	coursesSvc := courses.NewService(coursesRepo, log)
	coursesH := handler.NewCoursesHandler(coursesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-courses",
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

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &coursesTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *coursesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// ============ helpers shared with users_test.go ============

// insertUserDirect writes a user row directly. Used to bootstrap admin /
// instructor users in tests.
func insertUserDirect(t *testing.T, db *sql.DB, email, name, role, password string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(password), 4)
	require.NoError(t, err)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err = db.ExecContext(context.Background(), `
		INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)
	`, id, email, string(h), name, role, now, now)
	require.NoError(t, err)
	return id
}

// loginAs calls /auth/login and returns the access token. (We can't use
// the users_test.go registerAndLogin because the courses e2e file lives
// in its own test scope.)
func loginAs(t *testing.T, db *sql.DB, cfg *config.Config, email, password string) (string, string) {
	t.Helper()
	// We need a Fiber app for /auth/login; build a minimal one tied to db.
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

// ============ TESTS ============

// sampleCourse is the minimum valid payload for POST /api/v1/courses.
func sampleCourse(title string) map[string]any {
	return map[string]any{
		"title":          title,
		"description":    "x",
		"learningPoints": "x",
		"instructor":     "x",
		"level":          "Beginner",
		"duration":       "8h",
		"thumbnail":      "https://x.test/t.png",
		"tags":           "x",
		"costType":       "free",
		"price":          "0",
	}
}

func TestCourses_PublicList_OnlyPublished(t *testing.T) {
	env := setupCoursesEnv(t)
	// Create a published + a draft course directly in the DB (admin can
	// also do it via the API, but the test focus is the public filter).
	publishedID := insertCourseDirect(t, env.db, "Published", "published")
	insertCourseDirect(t, env.db, "Draft", "draft")

	// Public list: only published
	status, raw := env.do(t, "GET", "/api/v1/courses", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var listResp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Equal(t, 1, listResp.Total, "public should only see published")
	require.Equal(t, publishedID, listResp.Data[0]["id"])
}

func TestCourses_AdminCanSeeDrafts(t *testing.T) {
	env := setupCoursesEnv(t)
	insertCourseDirect(t, env.db, "P1", "published")
	insertCourseDirect(t, env.db, "D1", "draft")

	// Admin list: see all
	status, raw := env.do(t, "GET", "/api/v1/courses", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var listResp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Equal(t, 2, listResp.Total, "admin should see drafts too")
}

func TestCourses_PublicGetDraftsHidden(t *testing.T) {
	env := setupCoursesEnv(t)
	draftID := insertCourseDirect(t, env.db, "Draft", "draft")

	// Public → 404
	status, _ := env.do(t, "GET", "/api/v1/courses/"+draftID, "", nil)
	require.Equal(t, 404, status, "public must not see drafts")

	// Admin → 200
	status, raw := env.do(t, "GET", "/api/v1/courses/"+draftID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin get: %s", string(raw))
}

func TestCourses_AdminCreate_AndUpdate_AndDelete(t *testing.T) {
	env := setupCoursesEnv(t)

	// Create
	status, raw := env.do(t, "POST", "/api/v1/courses", env.adminTok, sampleCourse("C1"))
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	id := created["id"].(string)
	require.Equal(t, "C1", created["title"])

	// Bad URL
	bad := sampleCourse("C2")
	bad["externalUrl"] = "javascript:alert(1)"
	status, raw = env.do(t, "POST", "/api/v1/courses", env.adminTok, bad)
	require.Equal(t, 400, status, "bad url: %s", string(raw))

	// Bad level
	bad2 := sampleCourse("C3")
	bad2["level"] = "Wizard"
	status, raw = env.do(t, "POST", "/api/v1/courses", env.adminTok, bad2)
	require.Equal(t, 400, status, "bad level: %s", string(raw))

	// Update title
	patch := map[string]any{
		"title":          "C1-renamed",
		"description":    "x",
		"learningPoints": "x",
		"instructor":     "x",
		"level":          "Beginner",
		"duration":       "8h",
		"thumbnail":      "https://x.test/t.png",
		"tags":           "x",
		"costType":       "free",
		"price":          "0",
	}
	status, raw = env.do(t, "PATCH", "/api/v1/courses/"+id, env.adminTok, patch)
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "C1-renamed", updated["title"])

	// Delete
	status, raw = env.do(t, "DELETE", "/api/v1/courses/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// Get → 404
	status, _ = env.do(t, "GET", "/api/v1/courses/"+id, env.adminTok, nil)
	require.Equal(t, 404, status)
}

func TestCourses_AdminOnly_PublicForbidden(t *testing.T) {
	env := setupCoursesEnv(t)
	// No auth header → 401 (requireAuth fails before requireRole)
	status, raw := env.do(t, "POST", "/api/v1/courses", "", sampleCourse("C1"))
	require.Equal(t, 401, status, "no auth: %s", string(raw))

	// Student → register a student, then try to create
	studentTok, _ := registerStudent(t, env.app, env.db, "student-courses@example.test")
	status, raw = env.do(t, "POST", "/api/v1/courses", studentTok, sampleCourse("C1"))
	require.Equal(t, 403, status, "student role: %s", string(raw))
}

func TestCourses_LinkDegrees_AppendAndIdempotent(t *testing.T) {
	env := setupCoursesEnv(t)
	courseID := insertCourseDirect(t, env.db, "C", "published")
	degree1 := insertDegreeDirect(t, env.db, "D1")
	degree2 := insertDegreeDirect(t, env.db, "D2")

	// First link: both appended
	status, raw := env.do(t, "POST", "/api/v1/courses/"+courseID+"/degrees", env.adminTok, map[string]any{
		"degreeIds": []string{degree1, degree2},
	})
	require.Equal(t, 200, status, "link: %s", string(raw))
	var r1 map[string]any
	require.NoError(t, json.Unmarshal(raw, &r1))
	require.Equal(t, float64(2), r1["appended"])
	require.Equal(t, float64(0), r1["skipped"])

	// Re-link: both skipped (idempotent)
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseID+"/degrees", env.adminTok, map[string]any{
		"degreeIds": []string{degree1, degree2},
	})
	require.Equal(t, 200, status)
	var r2 map[string]any
	require.NoError(t, json.Unmarshal(raw, &r2))
	require.Equal(t, float64(0), r2["appended"])
	require.Equal(t, float64(2), r2["skipped"])

	// Verify order indexes
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM degree_courses WHERE course_id = ?`, courseID).Scan(&n))
	require.Equal(t, 2, n, "should have 2 (degree, course) links")

	// Bad UUID → 400
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseID+"/degrees", env.adminTok, map[string]any{
		"degreeIds": []string{"not-a-uuid"},
	})
	require.Equal(t, 400, status, "bad uuid: %s", string(raw))
}

// decodeJWTClaimsPublic reads a JWT and returns the public claim set
// for debug / test assertions. Public so other test files can use it.
func decodeJWTClaimsPublic(token string) (struct {
	Sub  string `json:"sub"`
	Role string `json:"role"`
}, error) {
	var out struct {
		Sub  string `json:"sub"`
		Role string `json:"role"`
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return out, fmt.Errorf("malformed jwt")
	}
	body, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(body, &out)
	return out, err
}

// ============ test-only insert helpers ============

// insertCourseDirect writes a course row in the requested status. Used
// to seed the public/draft filter tests.
func insertCourseDirect(t *testing.T, db *sql.DB, title, status string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, ?, 'own', ?, ?)
	`, id, title, status, now, now)
	require.NoError(t, err)
	return id
}

// insertDegreeDirect writes a nano_degrees row (FK target for linkDegrees).
func insertDegreeDirect(t *testing.T, db *sql.DB, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`
		INSERT INTO nano_degrees (id, title, description, learning_points, price, cost_type, updated_at)
		VALUES (?, ?, 'x', 'x', 0, 'free', ?)
	`, id, title, now)
	require.NoError(t, err)
	return id
}

// registerStudent creates a student user via /auth/register and returns
// the access token.
func registerStudent(t *testing.T, app *fiber.App, db *sql.DB, email string) (string, string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"email": email, "password": "Str0ngP@ssw0rd!!", "name": "Student",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
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
