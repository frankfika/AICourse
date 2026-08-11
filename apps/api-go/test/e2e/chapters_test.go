// Package e2e — chapters module end-to-end test.
//
// Phase 2 T12-2: covers the 5 chapter endpoints. All admin-only. Uses
// dockertest MySQL + the same Prisma-derived schema.
package e2e

import (
	"bytes"
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

type chaptersTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupChaptersEnv(t *testing.T) *chaptersTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_chapters_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_chapters_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	// Bootstrap admin user
	adminID := bootstrapChAdmin(t, db)
	adminTok, _ := loginAsCh(t, db, cfg, "admin-chapters@example.test", "Str0ngP@ssw0rd!!")
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

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-chapters",
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

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &chaptersTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *chaptersTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// bootstrapChAdmin writes an admin user directly (no /auth/register
// because that always creates students).
func bootstrapChAdmin(t *testing.T, db *sql.DB) string {
	t.Helper()
	h, _ := bcrypt.GenerateFromPassword([]byte("Str0ngP@ssw0rd!!"), 4)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, 'admin-chapters@example.test', ?, 'Admin Chapters', 'admin', 0, 0, 1, ?, ?)`,
		id, string(h), now, now)
	require.NoError(t, err)
	return id
}

// loginAsCh mirrors loginAs from courses_test.go. The Fiber app is
// short-lived (one request) and the test isolation is the same.
func loginAsCh(t *testing.T, db *sql.DB, cfg *config.Config, email, password string) (string, string) {
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

// insertChCourse writes a course row directly (FK target for chapters).
func insertChCourse(t *testing.T, db *sql.DB, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := db.Exec(`INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)`,
		id, title, now, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestChapters_ListRequiresCourse(t *testing.T) {
	env := setupChaptersEnv(t)
	courseID := insertChCourse(t, env.db, "C-list")

	// Empty course → empty list
	status, raw := env.do(t, "GET", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)

	// 404 for unknown course
	status, _ = env.do(t, "GET", "/api/v1/courses/00000000-0000-0000-0000-000000000000/chapters", env.adminTok, nil)
	require.Equal(t, 404, status)

	// 401 without auth
	status, _ = env.do(t, "GET", "/api/v1/courses/"+courseID+"/chapters", "", nil)
	require.Equal(t, 401, status)
}

func TestChapters_CreateAndList_AndAutoOrderIndex(t *testing.T) {
	env := setupChaptersEnv(t)
	courseID := insertChCourse(t, env.db, "C-create")

	// Create 3 chapters without orderIndex — should auto-assign 0,1,2
	var ids []string
	for _, name := range []string{"Ch1", "Ch2", "Ch3"} {
		status, raw := env.do(t, "POST", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, map[string]any{
			"title": name,
		})
		require.Equal(t, 201, status, "create: %s", string(raw))
		var ch map[string]any
		require.NoError(t, json.Unmarshal(raw, &ch))
		ids = append(ids, ch["id"].(string))
	}

	// List — should be ordered by orderIndex ASC
	status, raw := env.do(t, "GET", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)
	require.Equal(t, "Ch1", list[0]["title"])
	require.Equal(t, float64(0), list[0]["orderIndex"])
	require.Equal(t, "Ch2", list[1]["title"])
	require.Equal(t, float64(1), list[1]["orderIndex"])

	// Missing title → 400
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, map[string]any{})
	require.Equal(t, 400, status, "missing title: %s", string(raw))

	// Unknown course → 404
	status, raw = env.do(t, "POST", "/api/v1/courses/00000000-0000-0000-0000-000000000000/chapters", env.adminTok, map[string]any{
		"title": "X",
	})
	require.Equal(t, 404, status, "unknown course: %s", string(raw))
}

func TestChapters_UpdateAndDelete(t *testing.T) {
	env := setupChaptersEnv(t)
	courseID := insertChCourse(t, env.db, "C-update")
	// Verify the course is visible to the API
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM courses WHERE id = ?`, courseID).Scan(&n))
	t.Logf("DEBUG: course %s exists in DB: %d", courseID, n)
	status, raw := env.do(t, "POST", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, map[string]any{
		"title": "Original",
	})
	require.Equal(t, 201, status, "create failed: %s", string(raw))
	var ch map[string]any
	require.NoError(t, json.Unmarshal(raw, &ch))
	id := ch["id"].(string)

	// PATCH title
	status, raw = env.do(t, "PATCH", "/api/v1/chapters/"+id, env.adminTok, map[string]any{
		"title":       "Updated",
		"description": "new desc",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "Updated", updated["title"])
	require.Equal(t, "new desc", updated["description"])

	// PATCH unknown → 404
	status, _ = env.do(t, "PATCH", "/api/v1/chapters/00000000-0000-0000-0000-000000000000", env.adminTok, map[string]any{
		"title": "X",
	})
	require.Equal(t, 404, status)

	// DELETE
	status, raw = env.do(t, "DELETE", "/api/v1/chapters/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// GET list → empty
	status, raw = env.do(t, "GET", "/api/v1/courses/"+courseID+"/chapters", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "deleted chapter should not appear in list")
}

func TestChapters_Reorder_AndOwnershipGuard(t *testing.T) {
	env := setupChaptersEnv(t)
	courseA := insertChCourse(t, env.db, "CA")
	courseB := insertChCourse(t, env.db, "CB")

	// Create 3 chapters in courseA
	var aIDs []string
	for _, n := range []string{"a1", "a2", "a3"} {
		status, raw := env.do(t, "POST", "/api/v1/courses/"+courseA+"/chapters", env.adminTok, map[string]any{
			"title": n,
		})
		require.Equal(t, 201, status, "create: %s", string(raw))
		var ch map[string]any
		require.NoError(t, json.Unmarshal(raw, &ch))
		aIDs = append(aIDs, ch["id"].(string))
	}
	// Create 1 chapter in courseB
	status, raw := env.do(t, "POST", "/api/v1/courses/"+courseB+"/chapters", env.adminTok, map[string]any{
		"title": "b1",
	})
	require.Equal(t, 201, status)
	var bCh map[string]any
	require.NoError(t, json.Unmarshal(raw, &bCh))
	bID := bCh["id"].(string)

	// Reorder courseA: reverse the IDs
	reversed := []string{aIDs[2], aIDs[0], aIDs[1]}
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseA+"/chapters/reorder", env.adminTok, map[string]any{
		"ids": reversed,
	})
	require.Equal(t, 200, status, "reorder: %s", string(raw))

	// Verify the new order via list
	status, raw = env.do(t, "GET", "/api/v1/courses/"+courseA+"/chapters", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)
	require.Equal(t, aIDs[2], list[0]["id"], "first should be the previously-3rd")
	require.Equal(t, float64(0), list[0]["orderIndex"])
	require.Equal(t, aIDs[0], list[1]["id"])
	require.Equal(t, aIDs[1], list[2]["id"])

	// Try to include a chapter from courseB in courseA's reorder → 403
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseA+"/chapters/reorder", env.adminTok, map[string]any{
		"ids": []string{aIDs[0], bID},
	})
	require.Equal(t, 403, status, "cross-course reorder: %s", string(raw))

	// Unknown id → 400
	status, raw = env.do(t, "POST", "/api/v1/courses/"+courseA+"/chapters/reorder", env.adminTok, map[string]any{
		"ids": []string{aIDs[0], "00000000-0000-0000-0000-000000000000"},
	})
	require.Equal(t, 400, status, "unknown id: %s", string(raw))
}
