// Package e2e — hackathons module end-to-end test.
//
// Phase 2 T19: covers the 10 user-facing + admin endpoints of
// /api/v1/hackathons/*. Mirrors apps/api/src/modules/hackathons/
// (public list/detail, admin CRUD, registration lifecycle, announcements).
//
// Teams / submissions / judges / sponsors endpoints (~20 routes) are
// deferred to T19.1.
//
// Schema reminders exercised by these tests:
//   - hackathons has NO deleted_at column. Soft-delete is status='cancelled'.
//   - hackathon_registrations has UNIQUE(hackathon_id, user_id) and a
//     deleted_at column.
//   - announcements has no updated_at (only created_at).
//   - status enum: 'upcoming'|'active'|'judging'|'finished'|'cancelled'.
//
// Every test verifies DB state (not just the API response) to keep with
// the T11+ audit discipline (trust DB > API).
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
	"github.com/frankfika/ai-academy/api-go/internal/hackathons"
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

type hackathonTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupHackathonEnv(t *testing.T) *hackathonTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	// dockertest's default MaxWait is 60s; bump to 180s so a transient
	// high-load machine (load avg 10+) does not flake the mysql boot.
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_hackathons_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_hackathons_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	// Bootstrap admin
	adminEmail := makeEmail("hk-admin")
	_ = insertUserDirect(t, db, adminEmail, "Admin Hackathons", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	// Build the hackathon stack
	hRepo := hackathons.NewRepo(db)
	hSvc := hackathons.NewService(hRepo, log)
	hH := handler.NewHackathonsHandler(hSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-hackathons",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	hH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &hackathonTestEnv{
		app: app, db: db, log: log, adminTok: adminTok,
	}
}

func (e *hackathonTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *hackathonTestEnv) registerStudent(t *testing.T, tag string) (string, string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"email": makeEmail(tag), "password": "Str0ngP@ssw0rd!!", "name": "Student",
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

// sampleHackathon is the minimum valid payload for POST /api/v1/hackathons.
// startDate is 7 days in the future, endDate is 14 days, to keep the
// effective-status inference in 'upcoming' territory.
func (e *hackathonTestEnv) sampleHackathon(title string) map[string]any {
	now := time.Now().UTC()
	return map[string]any{
		"title":       title,
		"description": "An exciting hackathon",
		"status":      "upcoming",
		"startDate":   now.Add(7 * 24 * time.Hour).Format(time.RFC3339),
		"endDate":     now.Add(14 * 24 * time.Hour).Format(time.RFC3339),
	}
}

// insertHackathonDirect is a test helper that writes a row directly so
// the test doesn't need to round-trip through the API for every setup.
func (e *hackathonTestEnv) insertHackathonDirect(t *testing.T, title, status string, startIn, endIn time.Duration) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO hackathons
		  (id, title, description, status, start_date, end_date, max_team_size, min_team_size, created_at, updated_at)
		VALUES (?, ?, 'x', ?, ?, ?, 5, 1, ?, ?)
	`, id, title, status, now.Add(startIn), now.Add(endIn), now, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestHackathon_Unauthenticated_401(t *testing.T) {
	env := setupHackathonEnv(t)
	// Create one hackathon so the routes have something to act on.
	id := env.insertHackathonDirect(t, "H1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons"},
		{"PATCH", "/api/v1/hackathons/" + id},
		{"DELETE", "/api/v1/hackathons/" + id},
		{"POST", "/api/v1/hackathons/" + id + "/register"},
		{"POST", "/api/v1/hackathons/" + id + "/cancel"},
		{"GET", "/api/v1/hackathons/" + id + "/my-registration"},
		{"POST", "/api/v1/hackathons/" + id + "/announcements"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestHackathon_PublicList(t *testing.T) {
	env := setupHackathonEnv(t)
	env.insertHackathonDirect(t, "H-upcoming", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	env.insertHackathonDirect(t, "H-active", "active", -1*time.Hour, 1*time.Hour)
	env.insertHackathonDirect(t, "H-cancelled", "cancelled", 7*24*time.Hour, 14*24*time.Hour)

	// Public list (no auth) — all 3 visible
	status, raw := env.do(t, "GET", "/api/v1/hackathons", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)

	// Filter by status (DB-level + service-level re-check)
	status, raw = env.do(t, "GET", "/api/v1/hackathons?status=cancelled", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "H-cancelled", list[0]["title"])

	// Bad status
	status, _ = env.do(t, "GET", "/api/v1/hackathons?status=published", "", nil)
	require.Equal(t, 400, status, "status=published is not in the enum (NestJS parity)")
}

func TestHackathon_PublicDetail(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "H1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id, "", nil)
	require.Equal(t, 200, status, "get: %s", string(raw))
	var dto map[string]any
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.Equal(t, id, dto["id"])
	require.Equal(t, "H1", dto["title"])
	require.Equal(t, "upcoming", dto["status"])
	require.Equal(t, float64(0), dto["registrationCount"])

	// Not found
	status, _ = env.do(t, "GET", "/api/v1/hackathons/"+uuid.NewString(), "", nil)
	require.Equal(t, 404, status)

	// Active hackathon (start_date in past, end_date in future) → effectiveStatus 'active'
	activeID := env.insertHackathonDirect(t, "Active", "upcoming", -1*time.Hour, 1*time.Hour)
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+activeID, "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.Equal(t, "active", dto["status"], "date-based override should flip upcoming→active")
}

func TestHackathon_AdminCreate(t *testing.T) {
	env := setupHackathonEnv(t)

	status, raw := env.do(t, "POST", "/api/v1/hackathons", env.adminTok, env.sampleHackathon("Create-1"))
	require.Equal(t, 201, status, "create: %s", string(raw))
	var dto map[string]any
	require.NoError(t, json.Unmarshal(raw, &dto))
	id := dto["id"].(string)
	require.Equal(t, "Create-1", dto["title"])

	// Verify DB state
	var (
		dbTitle  string
		dbStatus string
	)
	require.NoError(t, env.db.QueryRow(`SELECT title, status FROM hackathons WHERE id = ?`, id).Scan(&dbTitle, &dbStatus))
	require.Equal(t, "Create-1", dbTitle)
	require.Equal(t, "upcoming", dbStatus)

	// Student forbidden
	studentTok, _ := env.registerStudent(t, "hk-crt-stu")
	status, _ = env.do(t, "POST", "/api/v1/hackathons", studentTok, env.sampleHackathon("S"))
	require.Equal(t, 403, status)

	// Bad input: missing title
	bad := env.sampleHackathon("Bad")
	bad["title"] = ""
	status, _ = env.do(t, "POST", "/api/v1/hackathons", env.adminTok, bad)
	require.Equal(t, 400, status)

	// Bad input: endDate before startDate
	bad2 := env.sampleHackathon("Bad2")
	bad2["endDate"] = bad2["startDate"]
	status, _ = env.do(t, "POST", "/api/v1/hackathons", env.adminTok, bad2)
	require.Equal(t, 400, status)
}

func TestHackathon_Register(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Reg-1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, _ := env.registerStudent(t, "hk-reg")

	// First registration → 201
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	require.Equal(t, 201, status, "register: %s", string(raw))
	var reg map[string]any
	require.NoError(t, json.Unmarshal(raw, &reg))
	require.Equal(t, "registered", reg["status"])
	firstID := reg["id"].(string)

	// DB verification
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM hackathon_registrations WHERE hackathon_id = ? AND deleted_at IS NULL`, id).Scan(&n))
	require.Equal(t, 1, n)

	// Re-register (idempotent) → 201, same row
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	require.Equal(t, 201, status, "idempotent: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &reg))
	require.Equal(t, firstID, reg["id"], "should return the existing row, not create a new one")

	// Still only 1 row
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM hackathon_registrations WHERE hackathon_id = ? AND deleted_at IS NULL`, id).Scan(&n))
	require.Equal(t, 1, n)

	// Cannot register for cancelled
	cancelledID := env.insertHackathonDirect(t, "Reg-Cancelled", "cancelled", 7*24*time.Hour, 14*24*time.Hour)
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+cancelledID+"/register", tok, nil)
	require.Equal(t, 403, status)
}

func TestHackathon_CancelAndReRegister(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Cancel-1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, _ := env.registerStudent(t, "hk-can")

	// Register
	status, _ := env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	require.Equal(t, 201, status)

	// Cancel
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/cancel", tok, nil)
	require.Equal(t, 200, status, "cancel: %s", string(raw))
	var reg map[string]any
	require.NoError(t, json.Unmarshal(raw, &reg))
	require.Equal(t, "cancelled", reg["status"])

	// DB verification: row still present but deleted_at + status='cancelled'
	var (
		dbStatus  string
		deletedAt sql.NullTime
	)
	require.NoError(t, env.db.QueryRow(`SELECT status, deleted_at FROM hackathon_registrations WHERE hackathon_id = ?`, id).Scan(&dbStatus, &deletedAt))
	require.Equal(t, "cancelled", dbStatus)
	require.True(t, deletedAt.Valid, "deleted_at should be set on cancel")

	// Re-register should re-activate
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	require.Equal(t, 201, status)
	require.NoError(t, json.Unmarshal(raw, &reg))
	require.Equal(t, "registered", reg["status"])

	// Now deleted_at is NULL again
	require.NoError(t, env.db.QueryRow(`SELECT status, deleted_at FROM hackathon_registrations WHERE hackathon_id = ?`, id).Scan(&dbStatus, &deletedAt))
	require.Equal(t, "registered", dbStatus)
	require.False(t, deletedAt.Valid, "deleted_at should be NULL after re-registration")

	// Cancel without active registration → 400
	tok2, _ := env.registerStudent(t, "hk-can2")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/cancel", tok2, nil)
	require.Equal(t, 400, status)
}

func TestHackathon_MyRegistration(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "MyReg-1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, _ := env.registerStudent(t, "hk-mr")

	// No registration yet → null body
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/my-registration", tok, nil)
	require.Equal(t, 200, status)
	require.Equal(t, "null", string(raw), "no registration should return null, got: %s", string(raw))

	// Register, then fetch → returns the row
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/my-registration", tok, nil)
	require.Equal(t, 200, status)
	var reg map[string]any
	require.NoError(t, json.Unmarshal(raw, &reg))
	require.Equal(t, "registered", reg["status"])

	// Other user isolation: a different user should get null
	tok2, _ := env.registerStudent(t, "hk-mr2")
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/my-registration", tok2, nil)
	require.Equal(t, 200, status)
	require.Equal(t, "null", string(raw), "other user should see null, got: %s", string(raw))
}

func TestHackathon_OtherUserHackathonIsolation(t *testing.T) {
	env := setupHackathonEnv(t)
	// Admin A creates a hackathon
	id := env.insertHackathonDirect(t, "A's hackathon", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	// User B is unrelated
	_, _ = env.registerStudent(t, "hk-iso")

	// B can still see the hackathon via the public detail (no isolation
	// at the public-list level — isolation is on mutations).
	status, _ := env.do(t, "GET", "/api/v1/hackathons/"+id, "", nil)
	require.Equal(t, 200, status)

	// But user B cannot admin-create a new hackathon (role check)
	status, _ = env.do(t, "POST", "/api/v1/hackathons", "", env.sampleHackathon("B-hack"))
	require.Equal(t, 401, status)
}

func TestHackathon_AnnouncementsListAndCreate(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Ann-1", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Empty list
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/announcements", "", nil)
	require.Equal(t, 200, status)
	var anns []map[string]any
	require.NoError(t, json.Unmarshal(raw, &anns))
	require.Empty(t, anns)

	// Create as admin
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/announcements", env.adminTok, map[string]any{
		"title":    "Welcome",
		"content":  "Get ready!",
		"isPinned": true,
	})
	require.Equal(t, 201, status, "create announcement: %s", string(raw))
	var ann map[string]any
	require.NoError(t, json.Unmarshal(raw, &ann))
	annID := ann["id"].(string)
	require.Equal(t, "Welcome", ann["title"])
	require.Equal(t, true, ann["isPinned"])

	// Verify DB state (announcements has no updated_at, only created_at)
	var (
		dbTitle string
		dbPin   bool
	)
	require.NoError(t, env.db.QueryRow(`SELECT title, is_pinned FROM announcements WHERE id = ?`, annID).Scan(&dbTitle, &dbPin))
	require.Equal(t, "Welcome", dbTitle)
	require.True(t, dbPin)

	// List now has 1
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/announcements", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &anns))
	require.Len(t, anns, 1)

	// Student cannot create
	tok, _ := env.registerStudent(t, "hk-ann-stu")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/announcements", tok, map[string]any{
		"title": "x", "content": "y",
	})
	require.Equal(t, 403, status)

	// Bad input: missing title
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/announcements", env.adminTok, map[string]any{
		"title": "", "content": "y",
	})
	require.Equal(t, 400, status)
}

func TestHackathon_AdminSoftDelete(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "ToDelete", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Soft-delete: status flips to 'cancelled' (no deleted_at column)
	status, raw := env.do(t, "DELETE", "/api/v1/hackathons/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// DB verification: status is now 'cancelled', row still present
	var dbStatus string
	require.NoError(t, env.db.QueryRow(`SELECT status FROM hackathons WHERE id = ?`, id).Scan(&dbStatus))
	require.Equal(t, "cancelled", dbStatus)

	// Public list filter status=cancelled now includes it
	status, raw = env.do(t, "GET", "/api/v1/hackathons?status=cancelled", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.NotEmpty(t, list)
	found := false
	for _, h := range list {
		if h["id"] == id {
			found = true
			break
		}
	}
	require.True(t, found, "soft-deleted hackathon should appear under status=cancelled")

	// Public detail still returns the row (cancelled is a real state, not a tombstone)
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id, "", nil)
	require.Equal(t, 200, status, "cancelled hackathon should still be public-readable: %s", string(raw))
	var dto map[string]any
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.Equal(t, "cancelled", dto["status"])

	// Trying to register for a cancelled hackathon → 403
	tok, _ := env.registerStudent(t, "hk-sd")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/register", tok, nil)
	require.Equal(t, 403, status)

	// Student cannot delete
	status, _ = env.do(t, "DELETE", "/api/v1/hackathons/"+id, tok, nil)
	require.Equal(t, 403, status)
}
