// Package e2e — audit module end-to-end test.
//
// Phase 2 T24: covers the single endpoint
// apps/api/src/modules/audit/audit-log.controller.ts.
//
//	GET /api/v1/audit-logs  admin
//
// Uses dockertest MySQL + real schema. We insert audit rows directly
// via the audit.Service.Write helper (or raw SQL) and verify the
// filter combinations + pagination envelope.
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

	"github.com/frankfika/ai-academy/api-go/internal/audit"
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

type auditTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupAuditEnv(t *testing.T) *auditTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	// Bump the default 60s retry deadline — on a busy docker host
	// MySQL can take 90s+ to be ready to accept a TCP ping, and the
	// default deadline flakes TestAudit_List_* on the 2nd+ container.
	pool.MaxWait = 300 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_audit_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_audit_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("aud-admin")
	insertAuditUserDirect(t, db, adminEmail, "Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	auditSvc := audit.NewService(db)
	auditH := handler.NewAuditHandler(auditSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-audit",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	auditH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &auditTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *auditTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// insertAuditUserDirect bootstraps a user row.
func insertAuditUserDirect(t *testing.T, db *sql.DB, email, name, role, password string) string {
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
func (e *auditTestEnv) registerStudent(t *testing.T, email string) string {
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

// insertAuditLog writes a row directly via the audit service so the
// test exercises the same code path the production services use.
func (e *auditTestEnv) insertAuditLog(t *testing.T, p audit.WriteParams) {
	t.Helper()
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.CreatedAt == nil {
		now := time.Now().UTC()
		p.CreatedAt = &now
	}
	svc := audit.NewService(e.db)
	require.NoError(t, svc.Write(context.Background(), p))
}

// ============ TESTS ============

// T24 #1: unauthenticated → 401.
func TestAudit_List_Unauthenticated_401(t *testing.T) {
	env := setupAuditEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/audit-logs", "", nil)
	require.Equal(t, 401, status)
}

// T24 #2: student → 403.
func TestAudit_List_Student_403(t *testing.T) {
	env := setupAuditEnv(t)
	tok := env.registerStudent(t, makeEmail("aud-stu"))
	status, _ := env.do(t, "GET", "/api/v1/audit-logs", tok, nil)
	require.Equal(t, 403, status, "student must not read audit log")
}

// T24 #3: empty DB → 200, data=[], total=0.
func TestAudit_List_Empty(t *testing.T) {
	env := setupAuditEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/audit-logs", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int64            `json:"total"`
		Page  int              `json:"page"`
		Limit int              `json:"limit"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int64(0), resp.Total)
	require.Equal(t, 0, len(resp.Data))
	require.Equal(t, 1, resp.Page)
	require.Equal(t, 20, resp.Limit)
}

// T24 #4: filter by userId — only matching rows.
func TestAudit_List_FilterByUserID(t *testing.T) {
	env := setupAuditEnv(t)
	uid1 := insertAuditUserDirect(t, env.db, makeEmail("aud-u1"), "U1", "student", "Str0ngP@ssw0rd!!")
	uid2 := insertAuditUserDirect(t, env.db, makeEmail("aud-u2"), "U2", "student", "Str0ngP@ssw0rd!!")
	env.insertAuditLog(t, audit.WriteParams{
		UserID: uid1, Action: "instructor.create", Entity: "instructor",
		EntityID: uuid.NewString(),
		Details:  map[string]any{"key": "u1-row"},
	})
	env.insertAuditLog(t, audit.WriteParams{
		UserID: uid2, Action: "instructor.create", Entity: "instructor",
		EntityID: uuid.NewString(),
		Details:  map[string]any{"key": "u2-row"},
	})
	env.insertAuditLog(t, audit.WriteParams{
		Action: "expertise.create", Entity: "instructor_expertise",
		EntityID: uuid.NewString(),
		Details:  map[string]any{"key": "no-user"},
	})

	status, raw := env.do(t, "GET", "/api/v1/audit-logs?userId="+uid1, env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int64            `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int64(1), resp.Total, "only uid1's row")
	require.Equal(t, 1, len(resp.Data))
	require.Equal(t, uid1, resp.Data[0]["userId"])
}

// T24 #5: filter by entity + action.
func TestAudit_List_FilterByEntityAndAction(t *testing.T) {
	env := setupAuditEnv(t)
	env.insertAuditLog(t, audit.WriteParams{Action: "instructor.create", Entity: "instructor"})
	env.insertAuditLog(t, audit.WriteParams{Action: "instructor.update", Entity: "instructor"})
	env.insertAuditLog(t, audit.WriteParams{Action: "expertise.create", Entity: "instructor_expertise"})

	status, raw := env.do(t, "GET", "/api/v1/audit-logs?entity=instructor&action=instructor.create", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int64            `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int64(1), resp.Total)
}

// T24 #6: relatedUserId — OR-combined: user_id matches OR (entity='user' AND entity_id matches).
func TestAudit_List_FilterByRelatedUserID(t *testing.T) {
	env := setupAuditEnv(t)
	target := insertAuditUserDirect(t, env.db, makeEmail("aud-tgt"), "Tgt", "student", "Str0ngP@ssw0rd!!")
	other := insertAuditUserDirect(t, env.db, makeEmail("aud-oth"), "Oth", "student", "Str0ngP@ssw0rd!!")
	// 1) user_id matches
	env.insertAuditLog(t, audit.WriteParams{UserID: target, Action: "x", Entity: "instructor"})
	// 2) entity='user' + entity_id matches
	env.insertAuditLog(t, audit.WriteParams{Action: "user.update", Entity: "user", EntityID: target})
	// 3) nothing to do with target
	env.insertAuditLog(t, audit.WriteParams{UserID: other, Action: "x", Entity: "instructor"})

	status, raw := env.do(t, "GET", "/api/v1/audit-logs?relatedUserId="+target, env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int64            `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int64(2), resp.Total, "should include both the user_id match and the entity='user' match")
}

// T24 #7: pagination — limit=1, page=2 returns the second row.
func TestAudit_List_Pagination(t *testing.T) {
	env := setupAuditEnv(t)
	// Insert 3 rows with explicit timestamps so ordering is deterministic.
	now := time.Now().UTC()
	earlier := now.Add(-1 * time.Hour)
	earliest := now.Add(-2 * time.Hour)
	env.insertAuditLog(t, audit.WriteParams{Action: "earliest", Entity: "x", CreatedAt: &earliest})
	env.insertAuditLog(t, audit.WriteParams{Action: "earlier", Entity: "x", CreatedAt: &earlier})
	env.insertAuditLog(t, audit.WriteParams{Action: "newest", Entity: "x", CreatedAt: &now})

	status, raw := env.do(t, "GET", "/api/v1/audit-logs?limit=1&page=2", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int64            `json:"total"`
		Page  int              `json:"page"`
		Limit int              `json:"limit"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int64(3), resp.Total)
	require.Equal(t, 1, len(resp.Data))
	require.Equal(t, 2, resp.Page)
	require.Equal(t, "earlier", resp.Data[0]["action"], "page 2 = second-newest by createdAt DESC")
}

// T24 #8: details JSON is parsed into an object, not a string.
func TestAudit_List_DetailsParsedAsJSON(t *testing.T) {
	env := setupAuditEnv(t)
	env.insertAuditLog(t, audit.WriteParams{
		Action:  "x",
		Entity:  "y",
		Details: map[string]any{"foo": "bar", "n": float64(42)},
	})

	status, raw := env.do(t, "GET", "/api/v1/audit-logs", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var resp struct {
		Data []struct {
			Details map[string]any `json:"details"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 1, len(resp.Data))
	require.Equal(t, "bar", resp.Data[0].Details["foo"])
	require.Equal(t, float64(42), resp.Data[0].Details["n"])
}
