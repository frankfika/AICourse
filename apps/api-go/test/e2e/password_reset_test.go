package e2e

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type capturePasswordResetNotifier struct {
	mu      sync.Mutex
	token   string
	to      string
	record  string
	deliver int
}

func (n *capturePasswordResetNotifier) Enabled() bool { return true }

func (n *capturePasswordResetNotifier) SendPasswordReset(_ context.Context, to, token, recordID string) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.to, n.token, n.record = to, token, recordID
	n.deliver++
	return nil
}

func (n *capturePasswordResetNotifier) snapshot() (token, to, record string, deliveries int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.token, n.to, n.record, n.deliver
}

// TestPasswordReset_EndToEnd intentionally keeps every phase in one test so
// the package-level environment and OAuth/auth globals remain serial. It uses
// one MySQL container and a notifier that captures (but never sends) the token.
func TestPasswordReset_EndToEnd(t *testing.T) {
	env := setupAuthEnv(t)
	repo := auth.NewAuthRepo(env.db)
	notifier := &capturePasswordResetNotifier{}
	resetSvc := auth.NewPasswordResetService(repo, notifier, 4, env.log)
	handler.NewPasswordResetHandler(resetSvc).Mount(env.app.Group("/api/v1"))

	t.Run("capability disabled and enabled", func(t *testing.T) {
		disabledApp := fiber.New(fiber.Config{ErrorHandler: errs.Handler(env.log)})
		disabledApp.Use(requestid.New(requestid.Config{Header: "X-Request-Id", Generator: func() string { return uuid.NewString() }}))
		disabledSvc := auth.NewPasswordResetService(repo, nil, 4, env.log)
		handler.NewPasswordResetHandler(disabledSvc).Mount(disabledApp.Group("/api/v1"))

		status, raw := do(t, disabledApp, "GET", "/api/v1/auth/password-reset/capability", nil, nil)
		require.Equal(t, fiber.StatusOK, status, "%s", raw)
		require.JSONEq(t, `{"enabled":false}`, string(raw))
		status, _ = do(t, disabledApp, "POST", "/api/v1/auth/password-reset/request", nil, passwordResetJSON(t, map[string]any{"email": "nobody@example.test"}))
		require.Equal(t, fiber.StatusServiceUnavailable, status)

		resp := env.do(t, "GET", "/api/v1/auth/password-reset/capability", "", nil)
		require.Equal(t, fiber.StatusOK, resp.status, "%s", resp.body)
		require.JSONEq(t, `{"enabled":true}`, string(resp.body))
	})

	t.Run("request does not enumerate unknown or OAuth-only accounts", func(t *testing.T) {
		beforeToken, _, _, before := notifier.snapshot()
		resp := env.do(t, "POST", "/api/v1/auth/password-reset/request", "", map[string]any{
			"email": fmt.Sprintf("missing-%s@example.test", uuid.NewString()[:8]),
		})
		require.Equal(t, fiber.StatusAccepted, resp.status, "%s", resp.body)
		require.JSONEq(t, `{"accepted":true}`, string(resp.body))
		afterToken, _, _, after := notifier.snapshot()
		require.Equal(t, before, after)
		require.Equal(t, beforeToken, afterToken)

		oauthEmail := fmt.Sprintf("oauth-only-%s@example.test", uuid.NewString()[:8])
		_, err := env.db.Exec(`INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at) VALUES (?, ?, '', 'OAuth Only', 'student', false, 0, 0, NOW(3), NOW(3))`, uuid.NewString(), oauthEmail)
		require.NoError(t, err)
		resp = env.do(t, "POST", "/api/v1/auth/password-reset/request", "", map[string]any{"email": oauthEmail})
		require.Equal(t, fiber.StatusAccepted, resp.status, "%s", resp.body)
		_, _, _, afterOAuth := notifier.snapshot()
		require.Equal(t, before, afterOAuth, "OAuth-only accounts must not receive password reset mail")
	})

	email := fmt.Sprintf("password-reset-%s@example.test", uuid.NewString()[:8])
	oldPassword := "OldPass!12345"
	newPassword := "NewPass!56789"
	register := env.do(t, "POST", "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": oldPassword, "name": "Password Reset E2E",
	})
	require.Equal(t, fiber.StatusCreated, register.status, "%s", register.body)
	refreshCookie := cookieFromResp(t, &register, "refresh_token")
	require.NotEmpty(t, refreshCookie)
	var registered struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(register.body, &registered))
	require.NotEmpty(t, registered.User.ID)

	t.Run("existing user receives only the plaintext token", func(t *testing.T) {
		resp := env.do(t, "POST", "/api/v1/auth/password-reset/request", "", map[string]any{"email": "  " + strings.ToUpper(email) + "  "})
		require.Equal(t, fiber.StatusAccepted, resp.status, "%s", resp.body)
		token, to, recordID, deliveries := notifier.snapshot()
		require.Len(t, token, 43)
		require.Equal(t, email, to)
		require.NotEmpty(t, recordID)
		require.Equal(t, 1, deliveries)

		var storedHash string
		var expiresAt time.Time
		require.NoError(t, env.db.QueryRow(`SELECT token_hash, expires_at FROM password_reset_tokens WHERE id = ?`, recordID).Scan(&storedHash, &expiresAt))
		sum := sha256.Sum256([]byte(token))
		require.Equal(t, hex.EncodeToString(sum[:]), storedHash)
		require.NotEqual(t, token, storedHash)
		require.WithinDuration(t, time.Now().Add(30*time.Minute), expiresAt, 15*time.Second)
	})

	t.Run("invalid and expired tokens are rejected", func(t *testing.T) {
		resp := env.do(t, "POST", "/api/v1/auth/password-reset/confirm", "", map[string]any{
			"token": strings.Repeat("x", 43), "newPassword": newPassword,
		})
		require.Equal(t, fiber.StatusUnauthorized, resp.status, "%s", resp.body)

		token, _, recordID, _ := notifier.snapshot()
		_, err := env.db.Exec(`UPDATE password_reset_tokens SET expires_at = DATE_SUB(NOW(3), INTERVAL 1 SECOND) WHERE id = ?`, recordID)
		require.NoError(t, err)
		resp = env.do(t, "POST", "/api/v1/auth/password-reset/confirm", "", map[string]any{
			"token": token, "newPassword": newPassword,
		})
		require.Equal(t, fiber.StatusUnauthorized, resp.status, "%s", resp.body)
	})

	t.Run("confirm is one-shot, changes password, and revokes sessions", func(t *testing.T) {
		request := env.do(t, "POST", "/api/v1/auth/password-reset/request", "", map[string]any{"email": email})
		require.Equal(t, fiber.StatusAccepted, request.status, "%s", request.body)
		token, _, _, deliveries := notifier.snapshot()
		require.Equal(t, 2, deliveries)

		confirm := env.do(t, "POST", "/api/v1/auth/password-reset/confirm", "", map[string]any{
			"token": token, "newPassword": newPassword,
		})
		require.Equal(t, fiber.StatusOK, confirm.status, "%s", confirm.body)
		require.JSONEq(t, `{"changed":true}`, string(confirm.body))

		replay := env.do(t, "POST", "/api/v1/auth/password-reset/confirm", "", map[string]any{
			"token": token, "newPassword": newPassword,
		})
		require.Equal(t, fiber.StatusUnauthorized, replay.status, "%s", replay.body)

		oldLogin := env.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": email, "password": oldPassword})
		require.Equal(t, fiber.StatusUnauthorized, oldLogin.status, "%s", oldLogin.body)
		refresh := env.do(t, "POST", "/api/v1/auth/refresh", refreshCookie, nil)
		require.Equal(t, fiber.StatusUnauthorized, refresh.status, "%s", refresh.body)
		var sessions int
		require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ?`, registered.User.ID).Scan(&sessions))
		require.Zero(t, sessions)

		newLogin := env.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": email, "password": newPassword})
		require.Equal(t, fiber.StatusOK, newLogin.status, "%s", newLogin.body)
	})
}

func passwordResetJSON(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	return raw
}
