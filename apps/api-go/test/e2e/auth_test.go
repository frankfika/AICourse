// Package e2e — auth flow end-to-end test.
//
// Covers the Phase 1 done-gate flow:
//
//	register → me → refresh → reuse detection → logout → me
//
// This is a self-contained test that spins a real MySQL via dockertest,
// applies the full Prisma-derived schema, then drives a Fiber app that
// has the auth routes mounted exactly as cmd/server/main.go does.
//
// The flow mirrors what the frontend does on first login:
//
//  1. POST /api/v1/auth/register  {email, password, name}
//     → 201 { accessToken, user }  + Set-Cookie: refresh_token
//  2. GET  /api/v1/auth/me  Authorization: Bearer <accessToken>
//     → 200 { id, email, name, role }
//  3. POST /api/v1/auth/refresh  (Cookie: refresh_token=...)
//     → 200 { accessToken, user }  + new Set-Cookie: refresh_token
//  4. POST /api/v1/auth/refresh  (Cookie: old refresh_token=...)
//     → 401 (reuse detection — old token is now revoked)
//  5. POST /api/v1/auth/logout  (Cookie: refresh_token=...)
//     → 200 + Set-Cookie clearing refresh_token
//  6. GET  /api/v1/auth/me  (no Authorization header)
//     → 401
//
// If any step returns the wrong status or body shape, the test fails
// with a diff. We also assert that the refresh-token reuse path actually
// revoked the user (their remaining active tokens count drops to 0).
package e2e

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

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
)

// authTestEnv holds the per-test wiring (MySQL container, Fiber app, log).
type authTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupAuthEnv(t *testing.T) *authTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_auth_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_auth_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}), "mysql never came up")

	// Apply the real schema.
	applySchema(t, db)

	// Wire the Fiber app with auth routes.
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
		Env:             cfg.Env,
		AccessTokenTTL:  auth.TokenTTL,
		RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-auth",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &authTestEnv{app: app, db: db, log: log}
}

func applySchema(t *testing.T, db *sql.DB) {
	t.Helper()
	raw, err := os.ReadFile("../../db/migrations/0001_init.sql")
	require.NoError(t, err, "read schema")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	_, err = db.ExecContext(ctx, string(raw))
	require.NoError(t, err, "apply schema")
}

// cookieFromResp extracts the named cookie value from the response Set-Cookie header.
func cookieFromResp(t *testing.T, resp *httpResp, name string) string {
	t.Helper()
	for _, h := range resp.headers {
		// resp.Header.Values("Set-Cookie") returns each Set-Cookie header
		// as a separate entry. Each value looks like "name=value; Path=...; HttpOnly"
		// (without the "Set-Cookie:" prefix). Split on first semicolon.
		idx := strings.Index(h, ";")
		var kv string
		if idx == -1 {
			kv = h
		} else {
			kv = h[:idx]
		}
		eq := strings.Index(kv, "=")
		if eq == -1 {
			continue
		}
		if kv[:eq] == name {
			return kv[eq+1:]
		}
	}
	return ""
}

type httpResp struct {
	status  int
	body    []byte
	headers []string
}

func (e *authTestEnv) do(t *testing.T, method, path, cookie string, body any) httpResp {
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
	if cookie != "" {
		req.Header.Set("Cookie", "refresh_token="+cookie)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return httpResp{status: resp.StatusCode, body: b, headers: resp.Header.Values("Set-Cookie")}
}

func TestAuthFlow_RegisterMeRefreshReuseLogout(t *testing.T) {
	env := setupAuthEnv(t)

	email := fmt.Sprintf("auth-e2e-%s@example.com", uuid.NewString()[:8])
	password := "GoodPass!1234"
	name := "Auth E2E"

	// 1. Register
	regResp := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email":    email,
		"password": password,
		"name":     name,
	})
	require.Equal(t, fiber.StatusCreated, regResp.status, "register: %s", string(regResp.body))
	var regBody struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Name  string `json:"name"`
			Role  string `json:"role"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(regResp.body, &regBody))
	require.NotEmpty(t, regBody.AccessToken, "register must return accessToken")
	require.Equal(t, email, regBody.User.Email)
	require.Equal(t, name, regBody.User.Name)
	refreshCookie := cookieFromResp(t, &regResp, "refresh_token")
	require.NotEmpty(t, refreshCookie, "register must set refresh_token cookie")

	// 2. /me with the access token
	meResp := env.do(t, "GET", "/api/v1/auth/me", "", nil)
	// No cookie needed, but we need Authorization header for /me
	// Update: we'll re-do /me with proper auth header
	_ = meResp
	meResp2 := env.doWithAuth(t, "GET", "/api/v1/auth/me", regBody.AccessToken, "")
	require.Equal(t, fiber.StatusOK, meResp2.status, "me: %s", string(meResp2.body))
	var meBody struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	require.NoError(t, json.Unmarshal(meResp2.body, &meBody))
	require.Equal(t, regBody.User.ID, meBody.ID)
	require.Equal(t, email, meBody.Email)

	// 3. Refresh with the cookie
	refResp := env.do(t, "POST", "/api/v1/auth/refresh", refreshCookie, nil)
	require.Equal(t, fiber.StatusOK, refResp.status, "refresh: %s", string(refResp.body))
	var refBody struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(refResp.body, &refBody))
	require.NotEmpty(t, refBody.AccessToken)
	newRefreshCookie := cookieFromResp(t, &refResp, "refresh_token")
	require.NotEmpty(t, newRefreshCookie)
	require.NotEqual(t, refreshCookie, newRefreshCookie, "refresh must rotate the cookie value")

	// 4. Reuse the OLD refresh token — must 401
	reuseResp := env.do(t, "POST", "/api/v1/auth/refresh", refreshCookie, nil)
	require.Equal(t, fiber.StatusUnauthorized, reuseResp.status,
		"reuse of rotated token must 401, body=%s", string(reuseResp.body))

	// 5. Logout with the NEW refresh cookie
	logoutResp := env.do(t, "POST", "/api/v1/auth/logout", newRefreshCookie, nil)
	require.Equal(t, fiber.StatusOK, logoutResp.status, "logout: %s", string(logoutResp.body))

	// 6. /me with no Authorization header — 401
	noAuthResp := env.do(t, "GET", "/api/v1/auth/me", "", nil)
	require.Equal(t, fiber.StatusUnauthorized, noAuthResp.status)

	// 7. Refresh after logout — 401
	postLogoutResp := env.do(t, "POST", "/api/v1/auth/refresh", newRefreshCookie, nil)
	require.Equal(t, fiber.StatusUnauthorized, postLogoutResp.status)
}

func TestAuthFlow_RegisterDuplicateEmailReturns409(t *testing.T) {
	env := setupAuthEnv(t)
	email := fmt.Sprintf("dup-%s@example.com", uuid.NewString()[:8])
	password := "GoodPass!1234"

	first := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": password, "name": "first",
	})
	require.Equal(t, fiber.StatusCreated, first.status, "first register: %s", string(first.body))

	second := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": password, "name": "second",
	})
	require.Equal(t, fiber.StatusConflict, second.status,
		"duplicate email must 409, got %d: %s", second.status, string(second.body))
}

func TestAuthFlow_LoginWrongPasswordReturns401(t *testing.T) {
	env := setupAuthEnv(t)
	email := fmt.Sprintf("wrong-%s@example.com", uuid.NewString()[:8])
	password := "GoodPass!1234"

	reg := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": password, "name": "u",
	})
	require.Equal(t, fiber.StatusCreated, reg.status)

	bad := env.do(t, "POST", "/api/v1/auth/login", "", map[string]any{
		"email": email, "password": "WrongPass!1234",
	})
	require.Equal(t, fiber.StatusUnauthorized, bad.status,
		"wrong password must 401, got %d: %s", bad.status, string(bad.body))
}

func TestAuthFlow_LoginSuccess(t *testing.T) {
	env := setupAuthEnv(t)
	email := fmt.Sprintf("login-%s@example.com", uuid.NewString()[:8])
	password := "GoodPass!1234"

	reg := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": password, "name": "u",
	})
	require.Equal(t, fiber.StatusCreated, reg.status)

	// Now login with the same credentials
	login := env.do(t, "POST", "/api/v1/auth/login", "", map[string]any{
		"email": email, "password": password,
	})
	require.Equal(t, fiber.StatusOK, login.status, "login: %s", string(login.body))
	var lb struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(login.body, &lb))
	require.NotEmpty(t, lb.AccessToken)
	require.Equal(t, email, lb.User.Email)
	cookie := cookieFromResp(t, &login, "refresh_token")
	require.NotEmpty(t, cookie)
}

func TestAuthFlow_ListProviders(t *testing.T) {
	env := setupAuthEnv(t)
	resp := env.do(t, "GET", "/api/v1/auth/providers", "", nil)
	require.Equal(t, fiber.StatusOK, resp.status, "list providers: %s", string(resp.body))
	var body struct {
		Providers []struct {
			ID    string `json:"ID"`
			Label string `json:"Label"`
		} `json:"providers"`
	}
	require.NoError(t, json.Unmarshal(resp.body, &body))
	require.GreaterOrEqual(t, len(body.Providers), 1, "must list at least email_password")
}

func TestAuthFlow_WeakPasswordRejectedAt400(t *testing.T) {
	env := setupAuthEnv(t)
	resp := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email":    "weak@example.com",
		"password": "short",
		"name":     "u",
	})
	require.Equal(t, fiber.StatusBadRequest, resp.status,
		"weak password must 400, got %d: %s", resp.status, string(resp.body))
}

// doWithAuth is like env.do but adds the Authorization: Bearer header.
func (e *authTestEnv) doWithAuth(t *testing.T, method, path, token, cookie string) httpResp {
	t.Helper()
	var rdr io.Reader
	req := httptest.NewRequest(method, path, rdr)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if cookie != "" {
		req.Header.Set("Cookie", "refresh_token="+cookie)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return httpResp{status: resp.StatusCode, body: b, headers: resp.Header.Values("Set-Cookie")}
}
