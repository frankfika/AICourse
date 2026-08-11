// Package e2e — cross-module integration test: orders.NotifyOrderCreated
// → notifications.create.
//
// Phase 2 T16-1 final wiring verification. Confirms that the
// package-level `orders.NotifyOrderCreated` hook stub (declared in
// T13-2) is replaced at boot time by main.go with a real
// implementation that pushes a 'order' notification into the user's
// inbox. This test wires the same hook and verifies the side effect.
//
// We don't call main() — we just override the package var from a test
// env and run an order-create against the orders handler.
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
	"github.com/frankfika/ai-academy/api-go/internal/orders"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// setupNotifOrdersEnv mounts auth + orders + notifications together
// and wires the orders.NotifyOrderCreated cross-module hook. Mirrors
// what mountNotifications in main.go does in production.
func setupNotifOrdersEnv(t *testing.T) *notifTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_ntord_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_ntord_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	env := &notifTestEnv{}

	require.NoError(t, pool.Retry(func() error {
		var oerr error
		env.db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return env.db.Ping()
	}))

	applySchema(t, env.db)

	cfg, err := config.Load()
	require.NoError(t, err)
	cfg.DatabaseURL = dsn
	cfg.JWTSecret = "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"
	cfg.Env = "test"

	env.log, err = logger.New("test")
	require.NoError(t, err)

	authRepo := auth.NewAuthRepo(env.db)
	authCfg, err := auth.LoadAuthConfig()
	require.NoError(t, err)
	authSvc, err := auth.BuildService(authCfg, authRepo)
	require.NoError(t, err)
	tokens := auth.NewJWTTokenIssuer([]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL)

	authH := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env: cfg.Env, AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, env.log)

	ordersRepo := orders.NewRepo(env.db)
	ordersSvc := orders.NewService(ordersRepo, env.log)
	ordersH := handler.NewOrdersHandler(ordersSvc, tokens, cfg.Env, env.log)

	notifRepo := notifications.NewRepo(env.db)
	notifSvc := notifications.NewService(notifRepo, env.log)
	notifH := handler.NewNotificationsHandler(notifSvc, tokens, env.log)

	// Wire the cross-module hook — same as mountNotifications() in
	// main.go. This is the T16-1 deliverable: the orders package stub
	// gets a real impl that pushes a 'order' notification.
	orders.NotifyOrderCreated = func(ctx context.Context, userID, orderID, amount string) {
		err := notifSvc.CreateNotification(ctx, notifications.CreateNotificationInput{
			UserID:  userID,
			Type:    "order",
			Title:   "订单已创建",
			Body:    "您的订单已创建，金额 ¥" + amount + "，请尽快完成支付。",
			LinkURL: "/orders/" + orderID,
		})
		if err != nil {
			env.log.Warn("notify order created failed",
				zap.String("userId", userID),
				zap.String("orderId", orderID),
				zap.Error(err))
		}
	}

	env.app = fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-ntord",
		ErrorHandler: errs.Handler(env.log),
	})
	env.app.Use(recover.New())
	env.app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := env.app.Group("/api/v1")
	authH.Mount(v1)
	ordersH.Mount(v1)
	notifH.Mount(v1)

	t.Cleanup(func() {
		_ = env.db.Close()
		_ = pool.Purge(resource)
		_ = env.log.Sync()
	})

	return env
}

func TestNotifOrders_PaidOrder_FiresNotification(t *testing.T) {
	env := setupNotifOrdersEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("ntord-pc"))

	// Insert a paid course (price > 0, cost_type=paid).
	now := time.Now().UTC()
	courseID := uuid.NewString()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Paid Course', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'paid', '99.00', 'published', 'own', ?, ?)
	`, courseID, now, now)
	require.NoError(t, err)

	// Create order — should fire NotifyOrderCreated.
	body, _ := json.Marshal(map[string]any{
		"type":          "course",
		"courseId":      courseID,
		"paymentMethod": "alipay",
	})
	req := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := env.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "create order: %s", string(b))

	var orderResp struct {
		Enrolled bool `json:"enrolled"`
		Order    *struct {
			ID     string `json:"id"`
			Amount string `json:"amount"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(b, &orderResp))
	require.False(t, orderResp.Enrolled, "paid course should not auto-enroll")
	require.NotNil(t, orderResp.Order)
	orderID := orderResp.Order.ID
	require.NotEmpty(t, orderID)

	// The hook is fire-and-forget; small sleep to let it complete.
	time.Sleep(50 * time.Millisecond)

	// List notifications — should have 1 'order' notification.
	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list struct {
		Items []struct {
			ID      string  `json:"id"`
			UserID  string  `json:"userId"`
			Type    string  `json:"type"`
			Title   string  `json:"title"`
			Body    string  `json:"body"`
			LinkURL *string `json:"linkUrl"`
		} `json:"items"`
		UnreadCount int64 `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list.Items, 1, "expected exactly 1 notification from order hook")
	require.Equal(t, userID, list.Items[0].UserID)
	require.Equal(t, "order", list.Items[0].Type)
	require.Equal(t, "订单已创建", list.Items[0].Title)
	require.Contains(t, list.Items[0].Body, "99.00", "amount should be in body")
	require.NotNil(t, list.Items[0].LinkURL)
	require.Equal(t, "/orders/"+orderID, *list.Items[0].LinkURL)
	require.Equal(t, int64(1), list.UnreadCount)
}

func TestNotifOrders_FreeOrder_NoNotification(t *testing.T) {
	env := setupNotifOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ntord-fr"))

	// Free course — auto-enrolls without firing NotifyOrderCreated.
	now := time.Now().UTC()
	courseID := uuid.NewString()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Free Course', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', '0', 'published', 'own', ?, ?)
	`, courseID, now, now)
	require.NoError(t, err)

	body, _ := json.Marshal(map[string]any{
		"type":     "course",
		"courseId": courseID,
	})
	req := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := env.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "create free: %s", string(b))

	// Free path skips the order/notification.
	time.Sleep(50 * time.Millisecond)

	status, raw := env.do(t, "GET", "/api/v1/notifications", tok, nil)
	require.Equal(t, 200, status)
	var list struct {
		Items       []map[string]any `json:"items"`
		UnreadCount int64            `json:"unreadCount"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list.Items, "free course auto-enroll should not fire notification")
	require.Equal(t, int64(0), list.UnreadCount)
}
