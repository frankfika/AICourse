// Package e2e exercises OAuth authentication and identity linking through the
// real Fiber handlers and MySQL repositories. The IdP exchange is replaced by
// auth.OAuthTestMode, so these tests never contact Google.
package e2e

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
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
)

const oauthTestJWTSecret = "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"

type oauthE2EEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupOAuthE2EEnv(t *testing.T) *oauthE2EEnv {
	t.Helper()

	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")
	pool.MaxWait = 180 * time.Second
	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_oauth_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_oauth_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true", resource.GetPort("3306/tcp"))
	var conn *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var openErr error
		conn, openErr = sql.Open("mysql", dsn)
		if openErr != nil {
			return openErr
		}
		return conn.Ping()
	}), "mysql never came up")
	applySchema(t, conn)

	log, err := logger.New("test")
	require.NoError(t, err)
	repo := auth.NewAuthRepo(conn)
	svc, err := auth.BuildService(&auth.AuthConfig{
		EnabledProviders: []auth.ProviderID{"email_password", "oauth.google"},
		ProviderConfigs: map[auth.ProviderID]map[string]any{
			"email_password": {"bcrypt_rounds": 4},
			"oauth.google": {
				"client_id": "oauth-e2e-client", "client_secret": "oauth-e2e-secret",
				"redirect_uri": "https://app.example.test/api/v1/auth/oauth.google/callback",
				"scopes":       []string{"openid", "email", "profile"},
			},
		},
	}, repo)
	require.NoError(t, err)
	svc.SetStateStore(auth.NewMemoryStateStore())

	tokens := auth.NewJWTTokenIssuer([]byte(oauthTestJWTSecret), repo, auth.TokenTTL, auth.RefreshTokenTTL)
	authHandler := handler.NewAuthHandler(svc, repo, tokens, handler.AuthHandlerConfig{
		Env: "test", AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)
	usersSvc := users.NewService(users.NewRepo(conn), log, 4)
	identitiesHandler := handler.NewIdentitiesHandler(usersSvc, tokens, log)

	app := fiber.New(fiber.Config{AppName: "ai-academy-api-go-e2e-oauth", ErrorHandler: errs.Handler(log)})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{Header: "X-Request-Id", Generator: func() string { return uuid.NewString() }}))
	v1 := app.Group("/api/v1")
	authHandler.Mount(v1)
	identitiesHandler.Mount(v1)

	previousMode := auth.OAuthTestMode
	previousIdentity := auth.CurrentOAuthTestIdentity
	auth.OAuthTestMode = true
	t.Cleanup(func() {
		auth.OAuthTestMode = previousMode
		auth.CurrentOAuthTestIdentity = previousIdentity
		_ = conn.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})
	return &oauthE2EEnv{app: app, db: conn, log: log}
}

func (e *oauthE2EEnv) do(t *testing.T, method, path, token string, body any) (int, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, raw
}

func (e *oauthE2EEnv) register(t *testing.T) (token, userID string) {
	t.Helper()
	email := fmt.Sprintf("oauth-owner-%s@example.test", uuid.NewString()[:8])
	status, raw := e.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": "GoodPass!1234", "name": "OAuth Owner",
	})
	require.Equal(t, fiber.StatusCreated, status, "register: %s", raw)
	var response struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(raw, &response))
	require.NotEmpty(t, response.AccessToken)
	require.NotEmpty(t, response.User.ID)
	return response.AccessToken, response.User.ID
}

func setOAuthIdentity(t *testing.T, email string) auth.OAuthTestIdentity {
	t.Helper()
	identity := auth.OAuthTestIdentity{
		ProviderUserID: "google-" + uuid.NewString(), Email: email,
		Name: "OAuth Test User", AvatarURL: "https://example.test/avatar.png", EmailVerified: true,
	}
	auth.CurrentOAuthTestIdentity = identity
	return identity
}

func TestOAuth_ListProviders(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/auth/providers", "", nil)
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	var response struct {
		Providers []map[string]any `json:"providers"`
	}
	require.NoError(t, json.Unmarshal(raw, &response))
	found := false
	for _, provider := range response.Providers {
		id := provider["id"]
		if id == nil { // ProviderDescriptor predates JSON tags.
			id = provider["ID"]
		}
		found = found || id == "oauth.google"
	}
	require.True(t, found, "providers response must advertise oauth.google: %s", raw)
}

func TestOAuth_StartProvider_ReturnsAuthURL(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/auth/oauth.google/start", "", nil)
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	var response auth.Authorization
	require.NoError(t, json.Unmarshal(raw, &response))
	require.NotEmpty(t, response.State)
	u, err := url.Parse(response.URL)
	require.NoError(t, err)
	require.Equal(t, response.State, u.Query().Get("state"))
	require.Equal(t, "S256", u.Query().Get("code_challenge_method"))
	require.NotEmpty(t, u.Query().Get("code_challenge"))
}

func TestOAuth_StartProvider_Unknown(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	status, raw := env.do(t, "GET", "/api/v1/auth/oauth.unknown/start", "", nil)
	require.Equal(t, fiber.StatusUnauthorized, status, "%s", raw)
	require.Contains(t, string(raw), "Provider not available")
}

func TestOAuth_DirectAuthenticate_TestMode(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	identity := setOAuthIdentity(t, fmt.Sprintf("oauth-direct-%s@example.test", uuid.NewString()[:8]))
	status, raw := env.do(t, "POST", "/api/v1/auth/oauth.google", "", map[string]any{"code": "test-code"})
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	assertOAuthLoginResponse(t, raw, identity.Email)
	assertOAuthBinding(t, env.db, identity.ProviderUserID)
}

func TestOAuth_Callback_TestMode(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	identity := setOAuthIdentity(t, fmt.Sprintf("oauth-callback-%s@example.test", uuid.NewString()[:8]))
	status, startRaw := env.do(t, "GET", "/api/v1/auth/oauth.google/start", "", nil)
	require.Equal(t, fiber.StatusOK, status, "%s", startRaw)
	var start auth.Authorization
	require.NoError(t, json.Unmarshal(startRaw, &start))
	status, raw := env.do(t, "POST", "/api/v1/auth/oauth.google/callback", "", map[string]any{
		"code": "test-code", "state": start.State,
	})
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	assertOAuthLoginResponse(t, raw, identity.Email)
	assertOAuthBinding(t, env.db, identity.ProviderUserID)
}

func TestOAuth_LinkStartAndCallback(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	token, userID := env.register(t)
	identity := setOAuthIdentity(t, fmt.Sprintf("oauth-link-%s@example.test", uuid.NewString()[:8]))

	status, startRaw := env.do(t, "GET", "/api/v1/auth/oauth.google/link/start", token, nil)
	require.Equal(t, fiber.StatusOK, status, "%s", startRaw)
	var start auth.Authorization
	require.NoError(t, json.Unmarshal(startRaw, &start))
	require.NotEmpty(t, start.State)

	status, raw := env.do(t, "POST", "/api/v1/auth/oauth.google/link/callback", token, map[string]any{
		"code": "test-code", "state": start.State,
	})
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	require.JSONEq(t, `{"ok":true}`, string(raw))

	status, raw = env.do(t, "GET", "/api/v1/auth/identities", token, nil)
	require.Equal(t, fiber.StatusOK, status, "%s", raw)
	var list struct {
		Identities []map[string]any `json:"identities"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	found := false
	for _, item := range list.Identities {
		if item["provider"] == "oauth.google" {
			found = true
			require.NotContains(t, item, "providerUserId", "identity API must not expose the IdP subject")
		}
	}
	require.True(t, found, "linked identity absent: %s", raw)

	var boundUserID string
	require.NoError(t, env.db.QueryRow(`SELECT user_id FROM user_provider_accounts WHERE provider = 'oauth.google' AND provider_user_id = ? AND deleted_at IS NULL`, identity.ProviderUserID).Scan(&boundUserID))
	require.Equal(t, userID, boundUserID)
}

func TestOAuth_LinkStart_RequiresAuth(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/auth/oauth.google/link/start", "", nil)
	require.Equal(t, fiber.StatusUnauthorized, status)
	status, _ = env.do(t, "POST", "/api/v1/auth/oauth.google/link/callback", "", map[string]any{"code": "test"})
	require.Equal(t, fiber.StatusUnauthorized, status)
}

func TestOAuth_Identities_Unauthenticated_401(t *testing.T) {
	env := setupOAuthE2EEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/auth/identities", "", nil)
	require.Equal(t, fiber.StatusUnauthorized, status)
}

func assertOAuthLoginResponse(t *testing.T, raw []byte, wantEmail string) {
	t.Helper()
	var response struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(raw, &response))
	require.NotEmpty(t, response.AccessToken)
	require.Equal(t, wantEmail, response.User.Email)
}

func assertOAuthBinding(t *testing.T, conn *sql.DB, providerUserID string) {
	t.Helper()
	var count int
	require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM user_provider_accounts WHERE provider = 'oauth.google' AND provider_user_id = ? AND deleted_at IS NULL`, providerUserID).Scan(&count))
	require.Equal(t, 1, count)
}
