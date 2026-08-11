// Package e2e — certificates module end-to-end test.
//
// Phase 2 T14-3: covers the 4 /api/v1/certificates/* endpoints.
//
//	GET    /certificates                my certificates (auth)
//	GET    /certificates/verify/:serial public verify (anonymous)
//	GET    /certificates/:id            public detail
//	POST   /certificates/revoke/:id     admin revoke
//
// Mirrors apps/api/src/modules/certificates/certificates.controller.ts 1:1.
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
	"github.com/frankfika/ai-academy/api-go/internal/certificates"
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
)

type certsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupCertsEnv(t *testing.T) *certsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_certs_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_certs_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("cert-admin")
	_ = insertUserDirect(t, db, adminEmail, "Admin Certs", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	certRepo := certificates.NewRepo(db)
	certSvc := certificates.NewService(certRepo, log)
	certH := handler.NewCertificatesHandler(certSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-certs",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	certH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &certsTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *certsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *certsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *certsTestEnv) insertCert(t *testing.T, userID, typ, refID, serial string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO certificates
		  (id, user_id, type, ref_id, title, description, serial_number, issued_at, completed_at, image_url, verify_url, updated_at)
		VALUES (?, ?, ?, ?, 'Test Cert', 'A test cert', ?, ?, ?, NULL, ?, ?)
	`, id, userID, typ, refID, serial, now, now, "/verify/"+serial, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestCerts_ListMine_EmptyForNewUser(t *testing.T) {
	env := setupCertsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("cert-empty"))

	status, raw := env.do(t, "GET", "/api/v1/certificates", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "new user should have 0 certs")
}

func TestCerts_ListMine_ExcludesRevoked(t *testing.T) {
	env := setupCertsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("cert-revoked"))
	env.insertCert(t, userID, "course", "ref1", "OCSG-2026-COURSE-0001")
	revokedID := env.insertCert(t, userID, "course", "ref2", "OCSG-2026-COURSE-0002")
	// Revoke the second
	_, err := env.db.Exec(`UPDATE certificates SET revoked_at = ? WHERE id = ?`, time.Now().UTC(), revokedID)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/api/v1/certificates", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "revoked should be hidden")
}

func TestCerts_ListMine_TypeFilter(t *testing.T) {
	env := setupCertsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("cert-filter"))
	env.insertCert(t, userID, "course", "c1", "OCSG-2026-COURSE-0001")
	env.insertCert(t, userID, "degree", "d1", "OCSG-2026-DEGREE-0001")

	// filter=course
	status, raw := env.do(t, "GET", "/api/v1/certificates?type=course", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "filter should return only course")
	require.Equal(t, "course", list[0]["type"])
}

func TestCerts_Verify_ValidSerial(t *testing.T) {
	env := setupCertsEnv(t)
	_, userID := env.registerStudent(t, makeEmail("cert-verify"))
	env.insertCert(t, userID, "course", "ref1", "OCSG-2026-COURSE-0001")

	// Public verify (no auth)
	status, raw := env.do(t, "GET", "/api/v1/certificates/verify/OCSG-2026-COURSE-0001", "", nil)
	require.Equal(t, 200, status, "verify: %s", string(raw))
	var res struct {
		Valid       bool           `json:"valid"`
		Reason      string         `json:"reason"`
		Certificate map[string]any `json:"certificate"`
	}
	require.NoError(t, json.Unmarshal(raw, &res))
	require.True(t, res.Valid, "valid cert should return valid=true")
	require.Equal(t, "OCSG-2026-COURSE-0001", res.Certificate["serialNumber"])
	require.Equal(t, "Test Cert", res.Certificate["title"])
}

func TestCerts_Verify_NotFound(t *testing.T) {
	env := setupCertsEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/certificates/verify/UNKNOWN-2026-COURSE-9999", "", nil)
	require.Equal(t, 200, status, "verify: %s", string(raw))
	var res struct {
		Valid  bool   `json:"valid"`
		Reason string `json:"reason"`
	}
	require.NoError(t, json.Unmarshal(raw, &res))
	require.False(t, res.Valid)
	require.Equal(t, "not_found", res.Reason)
}

func TestCerts_Verify_RevokedSerial(t *testing.T) {
	env := setupCertsEnv(t)
	_, userID := env.registerStudent(t, makeEmail("cert-rev-serial"))
	env.insertCert(t, userID, "course", "ref1", "OCSG-2026-COURSE-0001")
	_, err := env.db.Exec(`UPDATE certificates SET revoked_at = ? WHERE serial_number = ?`,
		time.Now().UTC(), "OCSG-2026-COURSE-0001")
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/api/v1/certificates/verify/OCSG-2026-COURSE-0001", "", nil)
	require.Equal(t, 200, status, "verify: %s", string(raw))
	var res struct {
		Valid  bool   `json:"valid"`
		Reason string `json:"reason"`
	}
	require.NoError(t, json.Unmarshal(raw, &res))
	require.False(t, res.Valid)
	require.Equal(t, "revoked", res.Reason)
}

func TestCerts_GetByID_Public(t *testing.T) {
	env := setupCertsEnv(t)
	_, userID := env.registerStudent(t, makeEmail("cert-get"))
	certID := env.insertCert(t, userID, "course", "ref1", "OCSG-2026-COURSE-0001")

	// Public (no auth)
	status, raw := env.do(t, "GET", "/api/v1/certificates/"+certID, "", nil)
	require.Equal(t, 200, status, "get: %s", string(raw))
	var dto struct {
		SerialNumber string  `json:"serialNumber"`
		Type         string  `json:"type"`
		Valid        *bool   `json:"valid"`
		HolderName   *string `json:"holderName"`
	}
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.Equal(t, "OCSG-2026-COURSE-0001", dto.SerialNumber)
	require.Equal(t, "course", dto.Type)
	require.NotNil(t, dto.Valid)
	require.True(t, *dto.Valid, "not revoked → valid=true")
	require.NotNil(t, dto.HolderName)
	require.Equal(t, "Student", *dto.HolderName)
}

func TestCerts_Revoke_AdminOnly(t *testing.T) {
	env := setupCertsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("cert-rev-auth"))
	certID := env.insertCert(t, userID, "course", "ref1", "OCSG-2026-COURSE-0001")

	// Student → 403
	status, _ := env.do(t, "POST", "/api/v1/certificates/revoke/"+certID, tok, nil)
	require.Equal(t, 403, status, "non-admin must be 403")

	// Admin → 200
	status, raw := env.do(t, "POST", "/api/v1/certificates/revoke/"+certID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin revoke: %s", string(raw))
	var dto struct {
		RevokedAt *string `json:"revokedAt"`
	}
	require.NoError(t, json.Unmarshal(raw, &dto))
	require.NotNil(t, dto.RevokedAt, "revokedAt should be set after revoke")

	// Re-revoke → 409
	status, raw = env.do(t, "POST", "/api/v1/certificates/revoke/"+certID, env.adminTok, nil)
	require.Equal(t, 409, status, "second revoke: %s", string(raw))
}

func TestCerts_IssueCertificate_Idempotent(t *testing.T) {
	// The orders service hook calls IssueCertificate on degree completion.
	// We can't easily test the full order flow in this file (it requires
	// the orders + enrollments handlers to be mounted). Instead, we
	// directly test the issueCertificate idempotency by inserting a
	// certificate row + trying to insert a duplicate.
	env := setupCertsEnv(t)
	_, userID := env.registerStudent(t, makeEmail("cert-issue"))

	certRepo := certificates.NewRepo(env.db)
	certSvc := certificates.NewService(certRepo, env.log)

	// First issue
	now := time.Now().UTC()
	first, err := certSvc.IssueCertificate(context.Background(), certificates.IssueInput{
		UserID:      userID,
		Type:        "course",
		RefID:       "course-1",
		Title:       "Course Cert",
		Description: "Done",
		CompletedAt: &now,
	})
	require.NoError(t, err)
	require.NotEmpty(t, first.SerialNumber)
	require.Equal(t, "course", first.Type)
	// Serial format: OCSG-{year}-COURSE-0001
	require.Contains(t, first.SerialNumber, "-COURSE-")

	// Second issue (same user, type, ref) — should return existing
	second, err := certSvc.IssueCertificate(context.Background(), certificates.IssueInput{
		UserID:      userID,
		Type:        "course",
		RefID:       "course-1",
		Title:       "Course Cert",
		Description: "Done",
		CompletedAt: &now,
	})
	require.NoError(t, err)
	require.Equal(t, first.ID, second.ID, "idempotent: same cert ID")
	require.Equal(t, first.SerialNumber, second.SerialNumber, "idempotent: same serial")
}

func TestCerts_SerialIncrement_YearType(t *testing.T) {
	env := setupCertsEnv(t)
	_, userID := env.registerStudent(t, makeEmail("cert-serial"))

	certRepo := certificates.NewRepo(env.db)
	certSvc := certificates.NewService(certRepo, env.log)

	now := time.Now().UTC()
	year := time.Now().Year()

	// Issue 2 certs (different refId to bypass idempotency)
	first, err := certSvc.IssueCertificate(context.Background(), certificates.IssueInput{
		UserID: userID, Type: "course", RefID: "c1", Title: "T", CompletedAt: &now,
	})
	require.NoError(t, err)
	second, err := certSvc.IssueCertificate(context.Background(), certificates.IssueInput{
		UserID: userID, Type: "course", RefID: "c2", Title: "T", CompletedAt: &now,
	})
	require.NoError(t, err)

	// Second serial should be 1 higher
	prefix := fmt.Sprintf("OCSG-%d-COURSE-", year)
	require.Equal(t, prefix+"0001", first.SerialNumber, "first serial")
	require.Equal(t, prefix+"0002", second.SerialNumber, "second serial should be +1")
}
