// Package e2e — chat module end-to-end tests.
//
// Covers the five authenticated /api/v1/chat endpoints, persistence, and
// cross-user session isolation. Send-message uses the Go service's current
// explicit 503 response and never fabricates or persists an assistant reply.
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
	"github.com/frankfika/ai-academy/api-go/internal/chat"
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

type chatTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupChatEnv(t *testing.T) *chatTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_chat_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_chat_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var conn *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var openErr error
		conn, openErr = sql.Open("mysql", dsn)
		if openErr != nil {
			return openErr
		}
		return conn.Ping()
	}))

	applySchema(t, conn)

	cfg, err := config.Load()
	require.NoError(t, err)
	cfg.DatabaseURL = dsn
	cfg.JWTSecret = "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"
	cfg.Env = "test"

	log, err := logger.New("test")
	require.NoError(t, err)

	authRepo := auth.NewAuthRepo(conn)
	authCfg, err := auth.LoadAuthConfig()
	require.NoError(t, err)
	authSvc, err := auth.BuildService(authCfg, authRepo)
	require.NoError(t, err)
	tokens := auth.NewJWTTokenIssuer([]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL)
	authHandler := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env: cfg.Env, AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)

	chatRepo := chat.NewRepo(conn)
	chatService := chat.NewService(chatRepo, log)
	chatHandler := handler.NewChatHandler(chatService, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-chat",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authHandler.Mount(v1)
	chatHandler.Mount(v1)

	t.Cleanup(func() {
		_ = conn.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &chatTestEnv{app: app, db: conn, log: log}
}

func (e *chatTestEnv) do(t *testing.T, method, path, token string, body any) (int, []byte) {
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

func (e *chatTestEnv) registerStudent(t *testing.T, prefix string) string {
	t.Helper()
	status, raw := e.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email":    makeEmail(prefix),
		"password": "Str0ngP@ssw0rd!!",
		"name":     "Chat Student",
	})
	require.Equal(t, fiber.StatusCreated, status, "register: %s", string(raw))
	var out struct {
		AccessToken string `json:"accessToken"`
	}
	require.NoError(t, json.Unmarshal(raw, &out))
	require.NotEmpty(t, out.AccessToken)
	return out.AccessToken
}

func (e *chatTestEnv) createSession(t *testing.T, token, title string) string {
	t.Helper()
	status, raw := e.do(t, "POST", "/api/v1/chat/sessions", token, map[string]any{"title": title})
	require.Equal(t, fiber.StatusCreated, status, "create session: %s", string(raw))
	var out struct {
		SessionID string  `json:"sessionId"`
		Title     *string `json:"title"`
	}
	require.NoError(t, json.Unmarshal(raw, &out))
	require.NotEmpty(t, out.SessionID)
	if title != "" {
		require.NotNil(t, out.Title)
		require.Equal(t, title, *out.Title)
	}
	return out.SessionID
}

func TestChat_AllEndpointsRequireAuthentication(t *testing.T) {
	env := setupChatEnv(t)
	sessionID := uuid.NewString()
	cases := []struct {
		method string
		path   string
		body   any
	}{
		{"POST", "/api/v1/chat/sessions", map[string]any{"title": "private"}},
		{"GET", "/api/v1/chat/sessions", nil},
		{"GET", "/api/v1/chat/sessions/" + sessionID + "/messages", nil},
		{"POST", "/api/v1/chat/sessions/" + sessionID + "/messages", map[string]any{"content": "hello"}},
		{"DELETE", "/api/v1/chat/sessions/" + sessionID, nil},
	}
	for _, tc := range cases {
		status, raw := env.do(t, tc.method, tc.path, "", tc.body)
		require.Equalf(t, fiber.StatusUnauthorized, status, "%s %s: %s", tc.method, tc.path, string(raw))
	}
}

func TestChat_CreateListMessagesAndDelete(t *testing.T) {
	env := setupChatEnv(t)
	token := env.registerStudent(t, "chat-lifecycle")
	sessionID := env.createSession(t, token, "Migration review")

	status, raw := env.do(t, "GET", "/api/v1/chat/sessions", token, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
	var sessions []struct {
		ID           string  `json:"id"`
		Title        *string `json:"title"`
		MessageCount int32   `json:"messageCount"`
		CreatedAt    string  `json:"createdAt"`
		UpdatedAt    string  `json:"updatedAt"`
	}
	require.NoError(t, json.Unmarshal(raw, &sessions))
	require.Len(t, sessions, 1)
	require.Equal(t, sessionID, sessions[0].ID)
	require.Equal(t, "Migration review", *sessions[0].Title)
	require.Zero(t, sessions[0].MessageCount)
	require.NotEmpty(t, sessions[0].CreatedAt)
	require.NotEmpty(t, sessions[0].UpdatedAt)

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions/"+sessionID+"/messages", token, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
	var messages []chat.MessageView
	require.NoError(t, json.Unmarshal(raw, &messages))
	require.Empty(t, messages)

	status, raw = env.do(t, "POST", "/api/v1/chat/sessions/"+sessionID+"/messages", token, map[string]any{
		"content": "Explain retrieval augmented generation",
	})
	require.Equal(t, fiber.StatusServiceUnavailable, status, string(raw))
	require.Contains(t, string(raw), "SERVICE_UNAVAILABLE")

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions/"+sessionID+"/messages", token, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
	require.NoError(t, json.Unmarshal(raw, &messages))
	require.Empty(t, messages, "unavailable chat must not persist a user message or fake assistant reply")

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions", token, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
	require.NoError(t, json.Unmarshal(raw, &sessions))
	require.Len(t, sessions, 1)
	require.Zero(t, sessions[0].MessageCount)

	status, raw = env.do(t, "DELETE", "/api/v1/chat/sessions/"+sessionID, token, nil)
	require.Equal(t, fiber.StatusNoContent, status, string(raw))

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions/"+sessionID+"/messages", token, nil)
	require.Equal(t, fiber.StatusNotFound, status, string(raw))

	var remaining int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE session_id = ?`, sessionID).Scan(&remaining))
	require.Zero(t, remaining, "deleting a session must cascade to its messages")
}

func TestChat_SessionOwnershipIsolation(t *testing.T) {
	env := setupChatEnv(t)
	ownerToken := env.registerStudent(t, "chat-owner")
	otherToken := env.registerStudent(t, "chat-other")
	sessionID := env.createSession(t, ownerToken, "Owner only")

	status, raw := env.do(t, "GET", "/api/v1/chat/sessions", otherToken, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
	var sessions []chat.SessionSummary
	require.NoError(t, json.Unmarshal(raw, &sessions))
	require.Empty(t, sessions, "another user's session must not appear in list")

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions/"+sessionID+"/messages", otherToken, nil)
	require.Equal(t, fiber.StatusNotFound, status, string(raw))

	status, raw = env.do(t, "POST", "/api/v1/chat/sessions/"+sessionID+"/messages", otherToken, map[string]any{"content": "intrusion"})
	require.Equal(t, fiber.StatusNotFound, status, string(raw))

	status, raw = env.do(t, "DELETE", "/api/v1/chat/sessions/"+sessionID, otherToken, nil)
	require.Equal(t, fiber.StatusNotFound, status, string(raw))

	status, raw = env.do(t, "GET", "/api/v1/chat/sessions/"+sessionID+"/messages", ownerToken, nil)
	require.Equal(t, fiber.StatusOK, status, string(raw))
}

func TestChat_SendMessageRejectsEmptyContent(t *testing.T) {
	env := setupChatEnv(t)
	token := env.registerStudent(t, "chat-empty")
	sessionID := env.createSession(t, token, "Validation")

	status, raw := env.do(t, "POST", "/api/v1/chat/sessions/"+sessionID+"/messages", token, map[string]any{"content": ""})
	require.Equal(t, fiber.StatusBadRequest, status, string(raw))
}
