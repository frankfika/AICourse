// Package e2e — notifications module end-to-end test.
//
// Phase 2 T16-1: covers the 6 /api/v1/notifications/* endpoints:
//
//	GET    /notifications                list + unread count
//	GET    /notifications/unread-count    just the count
//	POST   /notifications/:id/read        mark one read
//	POST   /notifications/read-all        mark all read
//	DELETE /notifications/:id             soft-delete one
//	POST   /notifications/clear-read      soft-delete all read
//
// All endpoints require JWT auth (RequireAuth middleware).
//
// Test strategy: insert notification rows directly via SQL to seed
// the inbox, then drive the endpoints. This keeps each test focused
// on a single concern (read / write / bulk). The cross-module hook
// (orders → notification) is exercised in a separate env below.
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
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/notifications"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type notifTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupNotifEnv(t *testing.T) *notifTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_notif_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_notif_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	notifRepo := notifications.NewRepo(db)
	notifSvc := notifications.NewService(notifRepo, log)
	notifH := handler.NewNotificationsHandler(notifSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-notif",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	notifH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &notifTestEnv{app: app, db: db, log: log}
}

func (e *notifTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// insertNotifDirect writes a notification row directly. Used to seed
// the inbox for endpoint tests. The cross-module hook (orders →
// notification) is covered in a separate test below.
func (e *notifTestEnv) insertNotifDirect(t *testing.T, userID, typ, title, body, linkURL string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	// Use NULL when linkURL is empty so we exercise the *string
	// omitempty path. Empty string would persist "" (NOT NULL) and
	// fail the LinkUrl.Valid=true branch — a different code path.
	var linkVal interface{}
	if linkURL == "" {
		linkVal = nil
	} else {
		linkVal = linkURL
	}
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO notifications (id, user_id, type, title, body, link_url, is_read, read_at, deleted_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)
	`, id, userID, typ, title, body, linkVal, now)
	require.NoError(t, err, "insert notif")
	return id
}

func (e *notifTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

// ============ TESTS ============

func TestNotif_Unauthenticated_401(t *testing.T) {
	env := setupNotifEnv(t)
	for _, c := range []struct {
		method, path string
	}{
		{"GET", "/api/v1/notifications"},
		{"GET", "/api/v1/notifications/unread-count"},
		{"POST", "/api/v1/notifications/abc/read"},
		{"POST", "/api/v1/notifications/read-all"},
		{"DELETE", "/api/v1/notifications/abc"},
		{"POST", "/api/v1/notifications/clear-read"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestNotif_EmptyInbox(t *testing.T) {
	env := setupNotifEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("nt-empty"))

	// List — empty
	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list struct {
		Items       []map[string]any `json:"items"`
		UnreadCount int64            `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list.Items)
	require.Equal(t, int64(0), list.UnreadCount)

	// Unread count — 0
	status, raw = env.do(t, "GET", "/api/v1/notifications/unread-count", tok, nil)
	require.Equal(t, 200, status)
	var count struct {
		UnreadCount int64 `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &count))
	require.Equal(t, int64(0), count.UnreadCount)
}

func TestNotif_ListAndUnreadCount(t *testing.T) {
	env := setupNotifEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("nt-list"))

	// Seed 3 notifications: order, comment, announcement
	env.insertNotifDirect(t, userID, "order", "订单已创建", "您有新的订单", "/orders/abc")
	env.insertNotifDirect(t, userID, "comment", "新回复", "讲师回复了您", "/lessons/1")
	env.insertNotifDirect(t, userID, "announcement", "系统通知", "欢迎", "")

	// List
	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status)
	var list struct {
		Items []struct {
			ID        string  `json:"id"`
			UserID    string  `json:"userId"`
			Type      string  `json:"type"`
			Title     string  `json:"title"`
			Body      string  `json:"body"`
			LinkURL   *string `json:"linkUrl"`
			IsRead    bool    `json:"isRead"`
			CreatedAt string  `json:"createdAt"`
		} `json:"items"`
		UnreadCount int64 `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 3)
	require.Equal(t, int64(3), list.UnreadCount, "all 3 unread")

	// First item should be one of them with isRead=false
	first := list.Items[0]
	require.Equal(t, userID, first.UserID)
	require.False(t, first.IsRead)
	require.NotEmpty(t, first.CreatedAt)

	// Unread count endpoint
	status, raw = env.do(t, "GET", "/api/v1/notifications/unread-count", tok, nil)
	require.Equal(t, 200, status)
	var count struct {
		UnreadCount int64 `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &count))
	require.Equal(t, int64(3), count.UnreadCount)
}

func TestNotif_MarkRead_OneAndAll(t *testing.T) {
	env := setupNotifEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("nt-mr"))

	id1 := env.insertNotifDirect(t, userID, "order", "T1", "b1", "")
	id2 := env.insertNotifDirect(t, userID, "comment", "T2", "b2", "")
	id3 := env.insertNotifDirect(t, userID, "announcement", "T3", "b3", "")

	// Mark id1 read
	status, raw := env.do(t, "POST", "/api/v1/notifications/"+id1+"/read", tok, nil)
	require.Equal(t, 200, status, "mark read: %s", string(raw))

	// Verify: 2 unread left
	status, raw = env.do(t, "GET", "/api/v1/notifications/unread-count", tok, nil)
	require.Equal(t, 200, status)
	var count struct {
		UnreadCount int64 `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &count))
	require.Equal(t, int64(2), count.UnreadCount)

	// Mark all read
	status, raw = env.do(t, "POST", "/api/v1/notifications/read-all", tok, nil)
	require.Equal(t, 200, status, "mark all read: %s", string(raw))

	// Verify: 0 unread
	status, raw = env.do(t, "GET", "/api/v1/notifications/unread-count", tok, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &count))
	require.Equal(t, int64(0), count.UnreadCount)

	// Idempotent: mark read again on already-read id1
	status, _ = env.do(t, "POST", "/api/v1/notifications/"+id1+"/read", tok, nil)
	require.Equal(t, 200, status, "idempotent mark read should still 200")

	// read_at is set on id1
	var readAt sql.NullTime
	require.NoError(t, env.db.QueryRow(`SELECT read_at FROM notifications WHERE id = ?`, id1).Scan(&readAt))
	require.True(t, readAt.Valid, "id1 read_at should be set")

	// _ = id2/id3 to silence unused
	_ = id2
	_ = id3
}

func TestNotif_Delete_AndClearRead(t *testing.T) {
	env := setupNotifEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("nt-del"))

	id1 := env.insertNotifDirect(t, userID, "order", "T1", "b1", "")
	id2 := env.insertNotifDirect(t, userID, "comment", "T2", "b2", "")
	_ = env.insertNotifDirect(t, userID, "announcement", "T3", "b3", "")

	// Mark id1 + id2 read
	env.do(t, "POST", "/api/v1/notifications/"+id1+"/read", tok, nil)
	env.do(t, "POST", "/api/v1/notifications/"+id2+"/read", tok, nil)

	// Soft-delete id1
	status, _ := env.do(t, "DELETE", "/api/v1/notifications/"+id1, tok, nil)
	require.Equal(t, 200, status)

	// id1 no longer in list
	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status)
	var list struct {
		Items []map[string]any `json:"items"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 2, "id1 should be hidden after soft-delete")
	for _, item := range list.Items {
		require.NotEqual(t, id1, item["id"])
	}

	// Clear read — soft-deletes id2 (and any other read). The unread
	// announcement remains.
	status, raw = env.do(t, "POST", "/api/v1/notifications/clear-read", tok, nil)
	require.Equal(t, 200, status, "clear read: %s", string(raw))

	// Now only 1 left (the announcement, unread)
	status, raw = env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 1, "only the unread announcement should remain")
}

func TestNotif_DoesNotLeakOtherUsers(t *testing.T) {
	env := setupNotifEnv(t)
	tokA, userA := env.registerStudent(t, makeEmail("nt-iso-a"))
	_, userB := env.registerStudent(t, makeEmail("nt-iso-b"))

	// A has 1 notification, B has 2
	env.insertNotifDirect(t, userA, "order", "A's order", "b", "")
	env.insertNotifDirect(t, userB, "order", "B1", "b", "")
	env.insertNotifDirect(t, userB, "comment", "B2", "b", "")

	// A sees only theirs
	status, raw := env.do(t, "GET", "/api/v1/notifications", tokA, nil)
	require.Equal(t, 200, status)
	var list struct {
		Items       []map[string]any `json:"items"`
		UnreadCount int64            `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 1)
	require.Equal(t, int64(1), list.UnreadCount)
}

func TestNotif_LinkUrlNullable(t *testing.T) {
	env := setupNotifEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("nt-link"))

	// Insert with no linkUrl
	id := env.insertNotifDirect(t, userID, "announcement", "Hi", "Welcome", "")

	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status)
	var list struct {
		Items []map[string]any `json:"items"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 1)
	item := list.Items[0]
	require.Equal(t, id, item["id"])
	// linkUrl is omitted (omitempty) when null
	_, hasLink := item["linkUrl"]
	require.False(t, hasLink, "linkUrl should be omitted when null (omitempty)")
}
