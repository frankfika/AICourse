// Package e2e — enterprise module end-to-end test.
//
// Phase 2 T22: covers the 4 endpoints under /api/v1/enterprise/*.
//
//	POST   /inquiries        public (rate-limited at gateway)
//	GET    /inquiries        admin
//	PATCH  /inquiries/:id/status   admin
//	DELETE /inquiries/:id    admin
//
// Phase 2 T22.1: also covers the deferred side effects
//   - audit_logs row written on create / status-update / delete
//   - Resend notifier fires on the user-visible status transitions
//     (pending → contacted, pending → qualified,
//     contacted → qualified)
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
	"github.com/frankfika/ai-academy/api-go/internal/enterprise"
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

type enterpriseTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
	adminID  string
}

func setupEnterpriseEnv(t *testing.T) *enterpriseTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_enterprise_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_enterprise_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	// Slightly bump the dockertest retry window — default is 60s, but
	// on busy CI machines the host port-mapping can take a bit longer
	// when many tests in parallel try to spin up their own MySQL.
	pool.MaxWait = 90 * time.Second
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}), "mysql never came up")

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

	adminEmail := makeEmail("ent-admin")
	adminID := insertUserDirect(t, db, adminEmail, "Ent Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	entRepo := enterprise.NewRepo(db)
	entSvc := enterprise.NewService(entRepo, log)
	entH := handler.NewEnterpriseHandler(entSvc, tokens, log)

	// T22.1: install a fake notifier that records calls. The default
	// is a no-op (no Resend API key in test), so we override to make
	// the assertion in the notifier-fires tests possible.
	prevNotifier := enterprise.ResendNotifier
	enterprise.SetResendNotifier(func(_ context.Context, inquiryID, email, subject, body string) {
		// Recorded in the package-level NotifierCall (see ResendNotifierCall).
	})

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-enterprise",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	entH.Mount(v1)

	t.Cleanup(func() {
		enterprise.SetResendNotifier(prevNotifier)
		enterprise.ResendNotifierCall = nil
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &enterpriseTestEnv{
		app: app, db: db, log: log,
		adminTok: adminTok, adminID: adminID,
	}
}

func (e *enterpriseTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *enterpriseTestEnv) registerStudent(t *testing.T, email string) string {
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

func TestEnterprise_Admin_Unauthenticated_401(t *testing.T) {
	env := setupEnterpriseEnv(t)
	// GET /inquiries requires auth
	status, _ := env.do(t, "GET", "/api/v1/enterprise/inquiries", "", nil)
	require.Equal(t, 401, status)
	// PATCH /inquiries/:id/status requires auth
	status, _ = env.do(t, "PATCH", "/api/v1/enterprise/inquiries/x/status", "", map[string]any{"status": "contacted"})
	require.Equal(t, 401, status)
	// DELETE /inquiries/:id requires auth
	status, _ = env.do(t, "DELETE", "/api/v1/enterprise/inquiries/x", "", nil)
	require.Equal(t, 401, status)
}

func TestEnterprise_Admin_Student_403(t *testing.T) {
	env := setupEnterpriseEnv(t)
	tok := env.registerStudent(t, makeEmail("ent-stu"))

	status, _ := env.do(t, "GET", "/api/v1/enterprise/inquiries", tok, nil)
	require.Equal(t, 403, status, "student must not list inquiries")
}

func TestEnterprise_Create_Public_Succeeds(t *testing.T) {
	env := setupEnterpriseEnv(t)
	body := map[string]any{
		"name":        "Alice",
		"email":       "alice@example.test",
		"company":     "Acme",
		"teamSize":    "11-50",
		"phone":       "+1-555-0100",
		"topic":       "AI training for engineering team",
		"description": "We want a 2-day hands-on workshop.",
	}
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", body)
	require.Equal(t, 201, status, "public create: %s", string(raw))

	var created struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Email       string `json:"email"`
		Company     string `json:"company"`
		TeamSize    string `json:"teamSize"`
		Phone       string `json:"phone"`
		Topic       string `json:"topic"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.NotEmpty(t, created.ID)
	require.Equal(t, "Alice", created.Name)
	require.Equal(t, "11-50", created.TeamSize)
	require.Equal(t, "pending", created.Status)

	// DB verify
	var n int
	require.NoError(t, env.db.QueryRow(
		"SELECT COUNT(*) FROM enterprise_inquiries WHERE id = ?", created.ID,
	).Scan(&n))
	require.Equal(t, 1, n, "row should be persisted")
}

func TestEnterprise_Create_Public_Validation(t *testing.T) {
	env := setupEnterpriseEnv(t)
	// bad email
	status, _ := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "Bob", "email": "not-an-email", "company": "X", "teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 400, status)

	// bad teamSize
	status, _ = env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "Bob", "email": "b@example.test", "company": "X", "teamSize": "huge", "topic": "T",
	})
	require.Equal(t, 400, status)

	// missing required field
	status, _ = env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"email": "b@example.test", "company": "X", "teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 400, status)
}

func TestEnterprise_Admin_List(t *testing.T) {
	env := setupEnterpriseEnv(t)
	// Seed 2 inquiries
	for i := 0; i < 2; i++ {
		status, _ := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
			"name":     "X",
			"email":    makeEmail("ent-list"),
			"company":  "Acme",
			"teamSize": "1-10",
			"topic":    "T",
		})
		require.Equal(t, 201, status)
	}

	status, raw := env.do(t, "GET", "/api/v1/enterprise/inquiries", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 2, "should return both inquiries, newest first")
	for _, inq := range list {
		require.Equal(t, "pending", inq.Status)
	}
}

func TestEnterprise_Admin_UpdateStatus(t *testing.T) {
	env := setupEnterpriseEnv(t)
	// Create one
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "C", "email": makeEmail("ent-up"), "company": "X", "teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// admin flips to qualified
	status, raw = env.do(t, "PATCH",
		"/api/v1/enterprise/inquiries/"+created.ID+"/status",
		env.adminTok,
		map[string]any{"status": "qualified"},
	)
	require.Equal(t, 200, status, "patch: %s", string(raw))
	var upd struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(raw, &upd))
	require.Equal(t, "qualified", upd.Status)

	// DB verify
	var dbStatus string
	require.NoError(t, env.db.QueryRow(
		"SELECT status FROM enterprise_inquiries WHERE id = ?", created.ID,
	).Scan(&dbStatus))
	require.Equal(t, "qualified", dbStatus)

	// Bad status value
	status, _ = env.do(t, "PATCH",
		"/api/v1/enterprise/inquiries/"+created.ID+"/status",
		env.adminTok,
		map[string]any{"status": "wat"},
	)
	require.Equal(t, 400, status)

	// Missing inquiry → 404
	status, _ = env.do(t, "PATCH",
		"/api/v1/enterprise/inquiries/"+uuid.NewString()+"/status",
		env.adminTok,
		map[string]any{"status": "contacted"},
	)
	require.Equal(t, 404, status)
}

func TestEnterprise_Admin_Delete(t *testing.T) {
	env := setupEnterpriseEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "D", "email": makeEmail("ent-del"), "company": "X", "teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// admin deletes
	status, _ = env.do(t, "DELETE",
		"/api/v1/enterprise/inquiries/"+created.ID,
		env.adminTok, nil,
	)
	require.Equal(t, 200, status)

	// DB verify — row should be gone
	var n int
	require.NoError(t, env.db.QueryRow(
		"SELECT COUNT(*) FROM enterprise_inquiries WHERE id = ?", created.ID,
	).Scan(&n))
	require.Equal(t, 0, n, "row should be hard-deleted")

	// Re-delete → 404
	status, _ = env.do(t, "DELETE",
		"/api/v1/enterprise/inquiries/"+created.ID,
		env.adminTok, nil,
	)
	require.Equal(t, 404, status)
}

// ============ T22.1: audit_log + Resend notifier ============

// helper: count audit_logs rows for a given entity_id.
func countAuditLogs(t *testing.T, db *sql.DB, entityID string) int {
	t.Helper()
	var n int
	require.NoError(t, db.QueryRow(
		"SELECT COUNT(*) FROM audit_logs WHERE entity = ? AND entity_id = ?",
		"enterprise_inquiry", entityID,
	).Scan(&n))
	return n
}

// helper: most recent audit_logs row's (action, details).
type auditRow struct {
	Action  string
	Details string
}

func lastAuditLog(t *testing.T, db *sql.DB, entityID string) auditRow {
	t.Helper()
	row := db.QueryRow(
		"SELECT action, COALESCE(details, '') FROM audit_logs WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 1",
		"enterprise_inquiry", entityID,
	)
	var a auditRow
	require.NoError(t, row.Scan(&a.Action, &a.Details))
	return a
}

func TestEnterprise_T221_Create_WritesAuditLog(t *testing.T) {
	env := setupEnterpriseEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "C1", "email": makeEmail("ent-audit"), "company": "Audit Co",
		"teamSize": "1-10", "topic": "Audit me",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// DB verify: 1 audit_logs row, action=enterprise_inquiry_created.
	require.Equal(t, 1, countAuditLogs(t, env.db, created.ID))
	row := lastAuditLog(t, env.db, created.ID)
	require.Equal(t, "enterprise_inquiry_created", row.Action)
	// details JSON should include the new inquiry's identifying fields
	var details map[string]any
	require.NoError(t, json.Unmarshal([]byte(row.Details), &details))
	require.Equal(t, "C1", details["name"])
	require.Equal(t, "Audit Co", details["company"])
}

func TestEnterprise_T221_UpdateStatus_WritesAuditLog_AndFiresNotifier(t *testing.T) {
	env := setupEnterpriseEnv(t)
	// Create
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "U1", "email": makeEmail("ent-up-aud"), "company": "Co",
		"teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// reset the recorded call
	enterprise.ResendNotifierCall = nil

	// admin moves to 'contacted' (the user-visible transition)
	status, raw = env.do(t, "PATCH",
		"/api/v1/enterprise/inquiries/"+created.ID+"/status",
		env.adminTok, map[string]any{"status": "contacted"},
	)
	require.Equal(t, 200, status, "patch: %s", string(raw))

	// audit_log row
	require.Equal(t, 2, countAuditLogs(t, env.db, created.ID), "create + status_update")
	row := lastAuditLog(t, env.db, created.ID)
	require.Equal(t, "enterprise_inquiry_status_update", row.Action)
	var details map[string]any
	require.NoError(t, json.Unmarshal([]byte(row.Details), &details))
	require.Equal(t, "pending", details["from"])
	require.Equal(t, "contacted", details["to"])

	// notifier fired
	require.NotNil(t, enterprise.ResendNotifierCall, "notifier should have fired on pending→contacted")
	require.Equal(t, created.ID, enterprise.ResendNotifierCall.InquiryID)
	require.Equal(t, created.Email, enterprise.ResendNotifierCall.Email)
	require.Equal(t, "Your inquiry has been updated", enterprise.ResendNotifierCall.Subject)
	require.Contains(t, enterprise.ResendNotifierCall.Body, "U1")
}

func TestEnterprise_T221_Delete_WritesAuditLog(t *testing.T) {
	env := setupEnterpriseEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "D1", "email": makeEmail("ent-del-aud"), "company": "Co",
		"teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// delete
	status, _ = env.do(t, "DELETE",
		"/api/v1/enterprise/inquiries/"+created.ID,
		env.adminTok, nil,
	)
	require.Equal(t, 200, status)

	// audit_logs is NOT deleted with the inquiry — it's a permanent
	// audit trail. We filter by entity_id to find the row.
	row := lastAuditLog(t, env.db, created.ID)
	require.Equal(t, "enterprise_inquiry_deleted", row.Action)
}

// Internal status transitions (closed/archived) should NOT fire the
// notifier — only the two user-visible ones (contacted, qualified) do.
func TestEnterprise_T221_InternalStatusUpdate_NoNotifier(t *testing.T) {
	env := setupEnterpriseEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/enterprise/inquiries", "", map[string]any{
		"name": "I1", "email": makeEmail("ent-internal"), "company": "Co",
		"teamSize": "1-10", "topic": "T",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	enterprise.ResendNotifierCall = nil

	status, _ = env.do(t, "PATCH",
		"/api/v1/enterprise/inquiries/"+created.ID+"/status",
		env.adminTok, map[string]any{"status": "closed"},
	)
	require.Equal(t, 200, status)
	require.Nil(t, enterprise.ResendNotifierCall,
		"notifier should NOT fire on closed (admin-internal transition)")

	// still gets an audit row though
	row := lastAuditLog(t, env.db, created.ID)
	require.Equal(t, "enterprise_inquiry_status_update", row.Action)
}
