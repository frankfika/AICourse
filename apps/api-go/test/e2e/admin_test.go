// Package e2e — admin module end-to-end test.
//
// Phase 2 T24: covers the single endpoint
// apps/api/src/modules/admin/admin.controller.ts.
//
//	GET /api/v1/admin/stats   admin
//
// Uses dockertest MySQL + real Prisma-derived schema, same as the
// other T22/T24 modules. The handler fans out 17 aggregations + 1
// 30-day user-growth query; we verify the shape and key numeric
// outputs (totals, DB ping, KPI structure). We don't try to pin
// every value — some are time-relative (today GMV depends on the
// wall clock).
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

	"github.com/frankfika/ai-academy/api-go/internal/admin"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/config"
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
	"golang.org/x/crypto/bcrypt"
)

type adminTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupAdminEnv(t *testing.T) *adminTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	// Bump the default 60s retry deadline — on a busy docker host
	// MySQL can take 90s+ to be ready to accept a TCP ping, and the
	// default deadline flakes TestAdmin_Stats_* on the 2nd+ container.
	pool.MaxWait = 300 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_admin_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_admin_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("adm-admin")
	adminID := insertAdminUserDirect(t, db, adminEmail, "Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")
	_ = adminID

	adminSvc := admin.NewService(db, "test")
	adminH := handler.NewAdminHandler(adminSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-admin",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	adminH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &adminTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *adminTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(raw)
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

// insertAdminUserDirect bootstraps an admin user for the test env.
// Lifted from the instructors pattern so we don't have a hard dep
// on a particular test-file load order.
func insertAdminUserDirect(t *testing.T, db *sql.DB, email, name, role, password string) string {
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

// registerStudent creates a student via /auth/register.
func (e *adminTestEnv) registerStudent(t *testing.T, email string) string {
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
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken
}

// ============ TESTS ============

// T24 #1: unauthenticated → 401.
func TestAdmin_Stats_Unauthenticated_401(t *testing.T) {
	env := setupAdminEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/admin/stats", "", nil)
	require.Equal(t, 401, status)
}

// T24 #2: student → 403.
func TestAdmin_Stats_Student_403(t *testing.T) {
	env := setupAdminEnv(t)
	tok := env.registerStudent(t, makeEmail("adm-stu"))
	status, _ := env.do(t, "GET", "/api/v1/admin/stats", tok, nil)
	require.Equal(t, 403, status, "student must not see admin stats")
}

// T24 #3: empty DB returns 200 with all-zero counts + ok DB status.
func TestAdmin_Stats_EmptyDB(t *testing.T) {
	env := setupAdminEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/admin/stats", env.adminTok, nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))

	var s admin.Stats
	require.NoError(t, json.Unmarshal(raw, &s))

	require.Equal(t, 4, len(s.KPIs), "should have 4 KPIs")
	require.Equal(t, "今日 GMV", s.KPIs[0].Label)
	require.Equal(t, "up", s.KPIs[0].DeltaTone, "zero delta tone is 'up' (NestJS quirk)")
	require.Equal(t, int64(1), s.Totals.Users, "admin user inserted by setup counts as 1")
	require.Equal(t, int64(0), s.Totals.Courses)
	require.Equal(t, int64(0), s.Totals.ActiveEnrollments)
	require.Equal(t, int64(0), s.Totals.CompletedEnrollments)
	require.Equal(t, 0.0, s.Totals.CompletionRate)
	require.Equal(t, "ok", s.System.Database)
	require.Equal(t, "test", s.System.APIVersion)
	require.Equal(t, "—", s.System.LastDeploy)
}

// T24 #4: seeded data — counts pick up the seeded users/courses/etc.
func TestAdmin_Stats_SeededCounts(t *testing.T) {
	env := setupAdminEnv(t)
	// Seed: 1 admin (already in env) + 2 students + 1 instructor
	for i := 0; i < 2; i++ {
		env.registerStudent(t, makeEmail(fmt.Sprintf("adm-u%d", i)))
	}
	insertAdminUserDirect(t, env.db, makeEmail("adm-inst"), "Instructor", "instructor", "Str0ngP@ssw0rd!!")
	// Insert a published course
	_, err := env.db.Exec(`
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Test course', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)
	`, uuid.NewString(), time.Now().UTC(), time.Now().UTC())
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/api/v1/admin/stats", env.adminTok, nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))

	var s admin.Stats
	require.NoError(t, json.Unmarshal(raw, &s))

	// Users = 1 admin + 2 students + 1 instructor = 4
	require.Equal(t, int64(4), s.Totals.Users, "all 4 non-deleted users")
	require.Equal(t, int64(1), s.Totals.Courses, "the 1 published course")
	// New users today is at least 4
	require.GreaterOrEqual(t, s.KPIs[1].Value, fmt.Sprintf("%d", 4))
}
