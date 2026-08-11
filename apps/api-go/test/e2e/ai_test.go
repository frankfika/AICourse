// Package e2e — ai module end-to-end test.
//
// Phase 2 T21: covers the AI endpoints, including the NestJS/Web config paths
// and the original Go migration aliases kept for backwards compatibility.
//
// Strategy:
//   - All DB operations hit a real MySQL container (dockertest).
//   - The 2 generate endpoints are stub-only; we only assert status + shape.
//   - The 7 config endpoints (4 admin + 3 user) verify DB persistence,
//     masking of apiKey, and the role gate (admin vs student).
//
// Mirrors apps/api/src/modules/ai/{ai,ai-config,ai-user-config}.controller.ts.
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

	"github.com/frankfika/ai-academy/api-go/internal/ai"
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

type aiTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupAIEnv(t *testing.T) *aiTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_ai_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_ai_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	aiRepo := ai.NewRepo(db)
	aiSvc := ai.NewService(aiRepo, log)
	aiH := handler.NewAIHandler(aiSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-ai",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	aiH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &aiTestEnv{app: app, db: db, log: log}
}

func (e *aiTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// registerStudent / registerAdmin follow the same convention as users_test.go.
func (e *aiTestEnv) registerStudent(t *testing.T, email string) (string, string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"email": email, "password": "Str0ngP@ssw0rd!!", "name": "Student",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "register: %s", string(raw))
	var out struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(raw, &out))
	return out.AccessToken, out.User.ID
}

func (e *aiTestEnv) registerAdmin(t *testing.T, email string) (string, string) {
	t.Helper()
	// Bootstrap admin directly via SQL (the public /auth/register
	// endpoint always creates students). Then login to get a token.
	h, err := bcrypt.GenerateFromPassword([]byte("Str0ngP@ssw0rd!!"), 4)
	require.NoError(t, err)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'admin', 0, 0, 1, ?, ?)
	`, id, email, string(h), "Admin", now, now)
	require.NoError(t, err)

	status, raw := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{
		"email":    email,
		"password": "Str0ngP@ssw0rd!!",
	})
	require.Equal(t, 200, status, "admin login: %s", string(raw))
	var out struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(raw, &out))
	require.NotEmpty(t, out.AccessToken)
	return out.AccessToken, out.User.ID
}

// ============================================================
// Tests
// ============================================================

func TestAI_Unauthenticated_401(t *testing.T) {
	env := setupAIEnv(t)
	for _, c := range []struct{ method, path string }{
		{"GET", "/api/v1/admin/ai/config"},
		{"PUT", "/api/v1/admin/ai/config"},
		{"DELETE", "/api/v1/admin/ai/config/gemini"},
		{"POST", "/api/v1/admin/ai/config/test"},
		{"GET", "/api/v1/admin/ai-config/providers"},
		{"PUT", "/api/v1/admin/ai-config/providers"},
		{"DELETE", "/api/v1/admin/ai-config/providers/gemini"},
		{"POST", "/api/v1/admin/ai-config/test"},
		{"GET", "/api/v1/ai/config/providers"},
		{"PUT", "/api/v1/ai/config/providers"},
		{"DELETE", "/api/v1/ai/config/providers/gemini"},
		{"GET", "/api/v1/ai/user-config/providers"},
		{"PUT", "/api/v1/ai/user-config/providers"},
		{"DELETE", "/api/v1/ai/user-config/providers/gemini"},
		{"POST", "/api/v1/ai/generate-course"},
		{"POST", "/api/v1/ai/generate-degree"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestAI_AdminEndpoints_StudentForbidden_403(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ai-stu"))

	for _, c := range []struct{ method, path string }{
		{"GET", "/api/v1/admin/ai/config"},
		{"PUT", "/api/v1/admin/ai/config"},
		{"DELETE", "/api/v1/admin/ai/config/gemini"},
		{"POST", "/api/v1/admin/ai/config/test"},
		{"GET", "/api/v1/admin/ai-config/providers"},
		{"PUT", "/api/v1/admin/ai-config/providers"},
		{"DELETE", "/api/v1/admin/ai-config/providers/gemini"},
		{"POST", "/api/v1/admin/ai-config/test"},
		{"POST", "/api/v1/ai/generate-course"},
		{"POST", "/api/v1/ai/generate-degree"},
	} {
		status, _ := env.do(t, c.method, c.path, tok, nil)
		require.Equal(t, 403, status, "%s %s should 403 for student", c.method, c.path)
	}
}

func TestAI_AdminList_Empty(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-list"))

	status, raw := env.do(t, "GET", "/api/v1/admin/ai-config/providers", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 0, resp.Total)
	require.Empty(t, resp.Data)
}

func TestAI_AdminUpsert_CreateAndUpdate(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-up"))

	// 1) Create
	status, raw := env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "gemini",
		"apiKey":   "test-1234567890abcdef",
		"model":    "gemini-1.5-flash",
		"baseUrl":  "https://generativelanguage.googleapis.com",
		"isActive": true,
	})
	require.Equal(t, 200, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "gemini", created["provider"])
	require.Equal(t, "gemini-1.5-flash", created["model"])
	require.Equal(t, true, created["isActive"])
	require.Equal(t, true, created["keySet"], "keySet must be true after creating")
	// API key must be masked, never plaintext
	masked, _ := created["apiKeyMasked"].(string)
	require.NotEmpty(t, masked)
	require.NotContains(t, masked, "test-1234567890abcdef", "plaintext key must NEVER appear in response")
	require.Contains(t, masked, "****", "masked must contain **** prefix")
	require.Contains(t, masked, "cdef", "masked must include last 4 chars: %s", masked)

	// Verify DB state
	var n int
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM ai_configs WHERE provider = 'gemini'").Scan(&n))
	require.Equal(t, 1, n)

	// 2) Update (same provider, different model)
	status, raw = env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "gemini",
		"apiKey":   "test-updatedkey9876",
		"model":    "gemini-1.5-pro",
		"isActive": false,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "gemini-1.5-pro", updated["model"])
	require.Equal(t, false, updated["isActive"])
	masked, _ = updated["apiKeyMasked"].(string)
	require.Contains(t, masked, "9876", "masked should reflect the new key tail")

	// Still only 1 row (upsert, not insert)
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM ai_configs WHERE provider = 'gemini'").Scan(&n))
	require.Equal(t, 1, n)
}

func TestAI_AdminUpsert_RejectsBadProvider(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-bad"))

	status, raw := env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "bogus",
		"apiKey":   "test-1234567890",
		"model":    "x",
	})
	require.Equal(t, 400, status, "should reject unsupported provider: %s", string(raw))
}

func TestAI_AdminUpsert_RejectsShortKey(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-short"))

	status, _ := env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "openai",
		"apiKey":   "abc",
		"model":    "gpt-4o",
	})
	require.Equal(t, 400, status)
}

func TestAI_AdminTest_StubOk(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-test"))

	status, raw := env.do(t, "POST", "/api/v1/admin/ai-config/test", tok, nil)
	require.Equal(t, 200, status, "test: %s", string(raw))
	var resp map[string]any
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, true, resp["ok"])
	require.NotEmpty(t, resp["sample"])
}

func TestAI_AdminDelete(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-del"))

	// Seed a row
	_, _ = env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "claude",
		"apiKey":   "test-claudekey1234",
		"model":    "claude-3-5-sonnet",
	})
	var n int
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM ai_configs WHERE provider = 'claude'").Scan(&n))
	require.Equal(t, 1, n)

	// Delete
	status, raw := env.do(t, "DELETE", "/api/v1/admin/ai-config/providers/claude", tok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM ai_configs WHERE provider = 'claude'").Scan(&n))
	require.Equal(t, 0, n)

	// Delete again is idempotent
	status, _ = env.do(t, "DELETE", "/api/v1/admin/ai-config/providers/claude", tok, nil)
	require.Equal(t, 200, status, "idempotent delete should still 200")
}

func TestAI_AdminList_AfterUpserts(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-multi"))

	// Insert two providers
	for _, p := range []string{"gemini", "openai"} {
		_, _ = env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
			"provider": p,
			"apiKey":   "test-" + p + "-key-1234",
			"model":    "m-" + p,
		})
	}

	status, raw := env.do(t, "GET", "/api/v1/admin/ai-config/providers", tok, nil)
	require.Equal(t, 200, status)
	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 2, resp.Total)
	require.Len(t, resp.Data, 2)
	for _, row := range resp.Data {
		require.Equal(t, true, row["keySet"])
		masked, _ := row["apiKeyMasked"].(string)
		require.Contains(t, masked, "****")
	}
}

func TestAI_AdminCompatibilityPathsShareCRUDState(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-compat-admin"))

	// Create through the NestJS/Web path.
	status, raw := env.do(t, "PUT", "/api/v1/admin/ai/config", tok, map[string]any{
		"provider": "openai",
		"apiKey":   "compat-admin-key-1234",
		"model":    "gpt-4o-mini",
		"isActive": true,
	})
	require.Equal(t, 200, status, "create through compatibility path: %s", string(raw))

	// Read the same row through the legacy Go alias.
	status, raw = env.do(t, "GET", "/api/v1/admin/ai-config/providers", tok, nil)
	require.Equal(t, 200, status, "legacy list after compatibility create: %s", string(raw))
	var legacyList struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &legacyList))
	require.Equal(t, 1, legacyList.Total)
	require.Equal(t, "openai", legacyList.Data[0]["provider"])
	require.Equal(t, "gpt-4o-mini", legacyList.Data[0]["model"])

	// Update via the legacy alias, then read through the NestJS/Web path.
	status, raw = env.do(t, "PUT", "/api/v1/admin/ai-config/providers", tok, map[string]any{
		"provider": "openai",
		"apiKey":   "compat-updated-key-5678",
		"model":    "gpt-4.1-mini",
		"isActive": false,
	})
	require.Equal(t, 200, status, "legacy update: %s", string(raw))
	status, raw = env.do(t, "GET", "/api/v1/admin/ai/config", tok, nil)
	require.Equal(t, 200, status, "compatibility list after legacy update: %s", string(raw))
	var compatibilityList struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &compatibilityList))
	require.Equal(t, 1, compatibilityList.Total)
	require.Equal(t, "gpt-4.1-mini", compatibilityList.Data[0]["model"])
	require.Equal(t, false, compatibilityList.Data[0]["isActive"])
	require.Contains(t, compatibilityList.Data[0]["apiKeyMasked"], "5678")

	status, raw = env.do(t, "POST", "/api/v1/admin/ai/config/test", tok, nil)
	require.Equal(t, 200, status, "compatibility test route: %s", string(raw))

	// Delete through the compatibility path and verify through the old alias.
	status, raw = env.do(t, "DELETE", "/api/v1/admin/ai/config/openai", tok, nil)
	require.Equal(t, 200, status, "compatibility delete: %s", string(raw))
	status, raw = env.do(t, "GET", "/api/v1/admin/ai-config/providers", tok, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &legacyList))
	require.Zero(t, legacyList.Total)
	require.Empty(t, legacyList.Data)
}

func TestAI_UserUpsertAndList(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ai-uu"))

	// Create
	status, raw := env.do(t, "PUT", "/api/v1/ai/user-config/providers", tok, map[string]any{
		"provider": "openai",
		"apiKey":   "sk-testuserkey1234",
		"model":    "gpt-4o-mini",
		"baseUrl":  "https://api.openai.com",
	})
	require.Equal(t, 200, status, "user upsert: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, true, created["keySet"])
	masked, _ := created["apiKeyMasked"].(string)
	require.NotContains(t, masked, "sk-testuserkey1234", "plaintext key must NEVER appear")

	// DB sanity
	var n int
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM user_ai_provider_configs WHERE provider = 'openai'").Scan(&n))
	require.Equal(t, 1, n)

	// List
	status, raw = env.do(t, "GET", "/api/v1/ai/user-config/providers", tok, nil)
	require.Equal(t, 200, status)
	var listResp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Equal(t, 1, listResp.Total)
}

func TestAI_UserUpsert_Ollama_NoKeyRequired(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ai-ollama"))

	// ollama should accept an empty key (mirrors NestJS upsertForUser)
	status, raw := env.do(t, "PUT", "/api/v1/ai/user-config/providers", tok, map[string]any{
		"provider": "ollama",
		"model":    "llama3.1",
		"baseUrl":  "http://localhost:11434",
	})
	require.Equal(t, 200, status, "ollama upsert: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "ollama", created["provider"])
	require.Equal(t, false, created["keySet"], "no key was provided")
}

func TestAI_UserUpsert_RejectsHttpForCloudProvider(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ai-http"))

	status, _ := env.do(t, "PUT", "/api/v1/ai/user-config/providers", tok, map[string]any{
		"provider": "openai",
		"apiKey":   "sk-testuserkey1234",
		"model":    "gpt-4o",
		"baseUrl":  "http://api.openai.com",
	})
	require.Equal(t, 400, status, "http baseUrl for cloud provider must be rejected")
}

func TestAI_UserDelete(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ai-ud"))

	// Seed
	_, _ = env.do(t, "PUT", "/api/v1/ai/user-config/providers", tok, map[string]any{
		"provider": "gemini",
		"apiKey":   "user-gemini-key-1234",
		"model":    "gemini-1.5-flash",
	})

	// Delete
	status, raw := env.do(t, "DELETE", "/api/v1/ai/user-config/providers/gemini", tok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	var n int
	require.NoError(t, env.db.QueryRow("SELECT COUNT(*) FROM user_ai_provider_configs WHERE provider = 'gemini'").Scan(&n))
	require.Equal(t, 0, n)
}

func TestAI_UserIsolation_TwoUsers(t *testing.T) {
	env := setupAIEnv(t)
	tokA, _ := env.registerStudent(t, makeEmail("ai-iso-a"))
	tokB, _ := env.registerStudent(t, makeEmail("ai-iso-b"))

	// A creates through the NestJS/Web path.
	status, raw := env.do(t, "PUT", "/api/v1/ai/config/providers", tokA, map[string]any{
		"provider": "openai",
		"apiKey":   "user-A-openai-key-12",
		"model":    "gpt-4o",
	})
	require.Equal(t, 200, status, "A compatibility upsert: %s", string(raw))

	// A can read the same config through the legacy alias.
	status, raw = env.do(t, "GET", "/api/v1/ai/user-config/providers", tokA, nil)
	require.Equal(t, 200, status)
	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 1, resp.Total)
	require.Equal(t, "openai", resp.Data[0]["provider"])

	// B lists through the compatibility path and cannot see A's row.
	status, raw = env.do(t, "GET", "/api/v1/ai/config/providers", tokB, nil)
	require.Equal(t, 200, status)
	resp = struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}{}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 0, resp.Total, "B must not see A's config")

	// B deleting the same provider name is scoped to B and must not affect A.
	status, raw = env.do(t, "DELETE", "/api/v1/ai/config/providers/openai", tokB, nil)
	require.Equal(t, 200, status, "B scoped delete: %s", string(raw))
	status, raw = env.do(t, "GET", "/api/v1/ai/config/providers", tokA, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 1, resp.Total, "B must not delete A's config")

	// A deletes through the old alias; the compatibility list sees it gone.
	status, raw = env.do(t, "DELETE", "/api/v1/ai/user-config/providers/openai", tokA, nil)
	require.Equal(t, 200, status, "A legacy delete: %s", string(raw))
	status, raw = env.do(t, "GET", "/api/v1/ai/config/providers", tokA, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Zero(t, resp.Total)
}

func TestAI_GenerateCourse_Stub(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-gc"))

	status, raw := env.do(t, "POST", "/api/v1/ai/generate-course", tok, map[string]any{
		"topic": "RAG 系统",
		"hint":  "面向开发者",
	})
	require.Equal(t, 200, status, "gen course: %s", string(raw))
	var resp struct {
		Draft struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Outlines    string `json:"outlines"`
			Stub        bool   `json:"stub"`
			Note        string `json:"note"`
		} `json:"draft"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, true, resp.Draft.Stub)
	require.NotEmpty(t, resp.Draft.Title)
	require.Contains(t, resp.Draft.Title, "RAG")
	require.NotEmpty(t, resp.Draft.Note)
}

func TestAI_GenerateCourse_RejectsEmptyTopic(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-gc-empty"))

	status, _ := env.do(t, "POST", "/api/v1/ai/generate-course", tok, map[string]any{
		"topic": "",
	})
	require.Equal(t, 400, status)
}

func TestAI_GenerateDegree_Stub(t *testing.T) {
	env := setupAIEnv(t)
	tok, _ := env.registerAdmin(t, makeEmail("ai-gd"))

	status, raw := env.do(t, "POST", "/api/v1/ai/generate-degree", tok, map[string]any{
		"topic": "AI 工程",
	})
	require.Equal(t, 200, status, "gen degree: %s", string(raw))
	var resp struct {
		Draft struct {
			Name string `json:"name"`
			Stub bool   `json:"stub"`
			Note string `json:"note"`
		} `json:"draft"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, true, resp.Draft.Stub)
	require.NotEmpty(t, resp.Draft.Name)
}
