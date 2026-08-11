// Package e2e — instructor expertises module end-to-end test.
//
// Phase 2 T24: covers the 5 endpoints of
// apps/api/src/modules/instructors/expertises.controller.ts.
//
// Public surface (1): GET /instructors/expertises
// Admin surface  (4): list / create / update / delete
//
// Public and admin both return the same shape (the NestJS controller
// is identical between the two). The admin path is gated by
// RequireRole("admin") in the handler.
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
	"github.com/frankfika/ai-academy/api-go/internal/instructors"
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

type expertiseTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupExpertiseEnv(t *testing.T) *expertiseTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	// Bump the default 60s retry deadline — on a busy docker host
	// MySQL can take 90s+ to be ready to accept a TCP ping, and the
	// default deadline flakes TestExpertise_* on the 2nd+ container.
	pool.MaxWait = 300 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_expertise_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_expertise_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("exp-admin")
	insertExpertiseUserDirect(t, db, adminEmail, "Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	insRepo := instructors.NewRepo(db)
	insSvc := instructors.NewService(insRepo, log)
	insExpertiseSvc := instructors.NewExpertiseService(insRepo, log)
	insH := handler.NewInstructorsHandler(insSvc, insExpertiseSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-expertise",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	insH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &expertiseTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *expertiseTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func insertExpertiseUserDirect(t *testing.T, db *sql.DB, email, name, role, password string) string {
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
func (e *expertiseTestEnv) registerStudent(t *testing.T, email string) string {
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

// insertExpertiseDirect writes an expertise row directly so we can
// seed list-ordering / inactive-flag tests.
func insertExpertiseDirect(t *testing.T, db *sql.DB, key, label string, isActive bool, orderIdx int32) string {
	t.Helper()
	id := "c" + uuid.NewString()[:24]
	now := time.Now().UTC()
	_, err := db.Exec(
		"INSERT INTO instructor_expertises (id, `key`, label, is_active, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, key, label, isActive, orderIdx, now, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

// T24 #1: public list — empty DB returns 200 with items=[].
func TestExpertise_PublicList_Empty(t *testing.T) {
	env := setupExpertiseEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/instructors/expertises", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Items []map[string]any `json:"items"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.NotNil(t, resp.Items, "items should be [] not null")
	require.Equal(t, 0, len(resp.Items))
}

// T24 #2: public list — active rows ordered before inactive, then by orderIndex ASC.
func TestExpertise_PublicList_OrderByActiveThenOrderIndex(t *testing.T) {
	env := setupExpertiseEnv(t)
	// Inactive with low orderIndex — should come AFTER active rows.
	insertExpertiseDirect(t, env.db, "inactive-first", "Inactive first", false, 0)
	insertExpertiseDirect(t, env.db, "active-b", "Active B", true, 10)
	insertExpertiseDirect(t, env.db, "active-a", "Active A", true, 5)

	status, raw := env.do(t, "GET", "/api/v1/instructors/expertises", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Items []struct {
			Key      string `json:"key"`
			IsActive bool   `json:"isActive"`
		} `json:"items"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 3, len(resp.Items))
	// Active first, ordered by orderIndex ASC
	require.Equal(t, "active-a", resp.Items[0].Key, "active + lower orderIndex first")
	require.True(t, resp.Items[0].IsActive)
	require.Equal(t, "active-b", resp.Items[1].Key)
	require.True(t, resp.Items[1].IsActive)
	// Inactive last
	require.Equal(t, "inactive-first", resp.Items[2].Key)
	require.False(t, resp.Items[2].IsActive)
}

// T24 #3: admin unauthenticated → 401.
func TestExpertise_AdminList_Unauthenticated_401(t *testing.T) {
	env := setupExpertiseEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/admin/instructors/expertises", "", nil)
	require.Equal(t, 401, status)
}

// T24 #4: admin student → 403.
func TestExpertise_AdminList_Student_403(t *testing.T) {
	env := setupExpertiseEnv(t)
	tok := env.registerStudent(t, makeEmail("exp-stu"))
	status, _ := env.do(t, "GET", "/api/v1/admin/instructors/expertises", tok, nil)
	require.Equal(t, 403, status)
}

// T24 #5: admin create — happy path; row lands in DB.
func TestExpertise_AdminCreate_Success(t *testing.T) {
	env := setupExpertiseEnv(t)
	body := map[string]any{
		"key":        "ai",
		"label":      "AI",
		"labelEn":    "Artificial Intelligence",
		"orderIndex": 1,
	}
	status, raw := env.do(t, "POST", "/api/v1/admin/instructors/expertises", env.adminTok, body)
	require.Equal(t, 201, status, "create: %s", string(raw))

	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "ai", created["key"])
	require.Equal(t, "AI", created["label"])
	require.Equal(t, "Artificial Intelligence", created["labelEn"])
	require.Equal(t, true, created["isActive"], "default is true")
	require.Equal(t, float64(1), created["orderIndex"])
	id := created["id"].(string)
	require.NotEmpty(t, id)

	// Verify in DB
	var dbKey, dbLabel string
	var isActive bool
	require.NoError(t, env.db.QueryRow(
		`SELECT `+"`key`"+`, label, is_active FROM instructor_expertises WHERE id = ?`, id,
	).Scan(&dbKey, &dbLabel, &isActive))
	require.Equal(t, "ai", dbKey)
	require.Equal(t, "AI", dbLabel)
	require.True(t, isActive)
}

// T24 #6: admin create — duplicate key → 409.
func TestExpertise_AdminCreate_DuplicateKey_409(t *testing.T) {
	env := setupExpertiseEnv(t)
	insertExpertiseDirect(t, env.db, "ai", "AI", true, 0)

	body := map[string]any{"key": "ai", "label": "Different label"}
	status, raw := env.do(t, "POST", "/api/v1/admin/instructors/expertises", env.adminTok, body)
	require.Equal(t, 409, status, "duplicate key: %s", string(raw))
}

// T24 #7: admin create — missing required fields → 400.
func TestExpertise_AdminCreate_MissingFields_400(t *testing.T) {
	env := setupExpertiseEnv(t)
	// Missing key + label
	status, _ := env.do(t, "POST", "/api/v1/admin/instructors/expertises", env.adminTok, map[string]any{})
	require.Equal(t, 400, status)
	// Only key, no label
	status, _ = env.do(t, "POST", "/api/v1/admin/instructors/expertises", env.adminTok, map[string]any{"key": "x"})
	require.Equal(t, 400, status)
}

// T24 #8: admin update — partial fields.
func TestExpertise_AdminUpdate_Partial(t *testing.T) {
	env := setupExpertiseEnv(t)
	id := insertExpertiseDirect(t, env.db, "backend", "Backend", true, 0)

	// Update label + deactivate
	body := map[string]any{
		"label":    "Backend Engineering",
		"isActive": false,
	}
	status, raw := env.do(t, "PATCH", "/api/v1/admin/instructors/expertises/"+id, env.adminTok, body)
	require.Equal(t, 200, status, "update: %s", string(raw))

	var upd map[string]any
	require.NoError(t, json.Unmarshal(raw, &upd))
	require.Equal(t, "Backend Engineering", upd["label"])
	require.Equal(t, false, upd["isActive"])
	// key unchanged
	require.Equal(t, "backend", upd["key"])

	// Verify in DB
	var dbLabel string
	var isActive bool
	require.NoError(t, env.db.QueryRow(
		`SELECT label, is_active FROM instructor_expertises WHERE id = ?`, id,
	).Scan(&dbLabel, &isActive))
	require.Equal(t, "Backend Engineering", dbLabel)
	require.False(t, isActive)
}

// T24 #9: admin update — not found → 404.
func TestExpertise_AdminUpdate_NotFound_404(t *testing.T) {
	env := setupExpertiseEnv(t)
	status, _ := env.do(t, "PATCH", "/api/v1/admin/instructors/expertises/not-a-real-id", env.adminTok,
		map[string]any{"label": "x"})
	require.Equal(t, 404, status)
}

// T24 #10: admin delete — happy path; row gone.
func TestExpertise_AdminDelete_Success(t *testing.T) {
	env := setupExpertiseEnv(t)
	id := insertExpertiseDirect(t, env.db, "frontend", "Frontend", true, 0)

	status, raw := env.do(t, "DELETE", "/api/v1/admin/instructors/expertises/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// DB row gone
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM instructor_expertises WHERE id = ?`, id,
	).Scan(&n))
	require.Equal(t, 0, n)

	// Re-delete → 404
	status, _ = env.do(t, "DELETE", "/api/v1/admin/instructors/expertises/"+id, env.adminTok, nil)
	require.Equal(t, 404, status)
}

// T24 #11: admin delete — cascade-deletes linked expertise_links.
func TestExpertise_AdminDelete_CascadesLinks(t *testing.T) {
	env := setupExpertiseEnv(t)
	// Seed an instructor + a link to the expertise.
	insID := "c" + uuid.NewString()[:24]
	now := time.Now().UTC()
	_, err := env.db.Exec(`
		INSERT INTO instructors (id, slug, name, order_index, created_at, updated_at)
		VALUES (?, ?, 'Test', 0, ?, ?)
	`, insID, "test-"+uuid.NewString()[:8], now, now)
	require.NoError(t, err)

	expID := insertExpertiseDirect(t, env.db, "ml", "ML", true, 0)
	_, err = env.db.Exec(`
		INSERT INTO instructor_expertise_links (instructor_id, expertise_id, order_index)
		VALUES (?, ?, 0)
	`, insID, expID)
	require.NoError(t, err)

	// Delete the expertise
	status, _ := env.do(t, "DELETE", "/api/v1/admin/instructors/expertises/"+expID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// Link should be gone via FK cascade
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM instructor_expertise_links WHERE expertise_id = ?`, expID,
	).Scan(&n))
	require.Equal(t, 0, n, "FK cascade should remove the link")
}
