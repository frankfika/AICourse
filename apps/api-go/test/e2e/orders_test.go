// Package e2e — orders module end-to-end test.
//
// Phase 2 T13-2: covers the 5 /api/v1/orders/* endpoints.
//
//	GET  /orders/me             list current user's orders
//	GET  /orders/:id            get one (ownership-checked; 404 for non-owner)
//	POST /orders                create (free auto-enrolls; paid returns pending)
//	POST /orders/:id/pay        dev-mode mock payment (503 in production)
//	POST /orders/:id/cancel     cancel pending (deferred T15 refund route)
//
// Mirrors apps/api/src/modules/orders/orders.controller.ts 1:1.
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

type ordersTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupOrdersEnv(t *testing.T) *ordersTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_orders_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_orders_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	ordersRepo := orders.NewRepo(db)
	ordersSvc := orders.NewService(ordersRepo, log)
	ordersH := handler.NewOrdersHandler(ordersSvc, tokens, cfg.Env, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-orders",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	ordersH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &ordersTestEnv{app: app, db: db, log: log}
}

func (e *ordersTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *ordersTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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
	require.NotEmpty(t, out.AccessToken)
	return out.AccessToken, out.User.ID
}

func (e *ordersTestEnv) insertCourse(t *testing.T, title, costType string, price string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', ?, ?, 'published', 'own', ?, ?)
	`, id, title, costType, price, now, now)
	require.NoError(t, err)
	return id
}

func (e *ordersTestEnv) insertDegree(t *testing.T, title, costType string, price string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO nano_degrees (id, title, description, learning_points, price, cost_type, updated_at)
		VALUES (?, ?, 'x', 'x', ?, ?, ?)
	`, id, title, price, costType, now)
	require.NoError(t, err)
	return id
}

// ============ TESTS ============

func TestOrders_Unauthenticated_401(t *testing.T) {
	env := setupOrdersEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/orders/me", "", nil)
	require.Equal(t, 401, status)
}

func TestOrders_ListMe_EmptyForNewUser(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-empty"))

	status, raw := env.do(t, "GET", "/api/v1/orders/me", tok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))

	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Empty(t, listResp, "new user should have 0 orders")
}

func TestOrders_FreeCourse_AutoEnroll(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-free"))
	courseID := env.insertCourse(t, "Free Course O", "free", "0")

	body := map[string]any{
		"type":          "course",
		"courseId":      courseID,
		"paymentMethod": "alipay",
	}
	status, raw := env.do(t, "POST", "/api/v1/orders", tok, body)
	require.Equal(t, 201, status, "create free: %s", string(raw))

	var resp struct {
		Enrolled   bool `json:"enrolled"`
		Enrollment *struct {
			ID       string  `json:"id"`
			CourseID *string `json:"courseId"`
			Source   string  `json:"source"`
		} `json:"enrollment"`
		Order *map[string]any `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.True(t, resp.Enrolled, "free course must set enrolled=true")
	require.NotNil(t, resp.Enrollment)
	require.Nil(t, resp.Order, "free must not return an order")
	// Public DTO: camelCase + plain string. Matches the OpenAPI spec.
	require.Equal(t, courseID, *resp.Enrollment.CourseID)
	require.Equal(t, "direct", resp.Enrollment.Source)

	// List /me — should be 0 (free path doesn't write orders)
	status, raw = env.do(t, "GET", "/api/v1/orders/me", tok, nil)
	require.Equal(t, 200, status)
	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Empty(t, listResp, "free path should not create an order row")
}

func TestOrders_FreeCourse_AlreadyEnrolled_409(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-freedup"))
	courseID := env.insertCourse(t, "Free Dup", "free", "0")

	body := map[string]any{"type": "course", "courseId": courseID}
	// First enrolls
	status, _ := env.do(t, "POST", "/api/v1/orders", tok, body)
	require.Equal(t, 201, status)
	// Second tries — should 409
	status, raw := env.do(t, "POST", "/api/v1/orders", tok, body)
	require.Equal(t, 409, status, "duplicate must be 409: %s", string(raw))
}

func TestOrders_PaidCourse_PendingOrder(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-paid"))
	courseID := env.insertCourse(t, "Paid Course O", "paid", "99.00")

	body := map[string]any{
		"type":          "course",
		"courseId":      courseID,
		"paymentMethod": "alipay",
	}
	status, raw := env.do(t, "POST", "/api/v1/orders", tok, body)
	require.Equal(t, 201, status, "create paid: %s", string(raw))

	var resp struct {
		Enrolled   bool            `json:"enrolled"`
		Enrollment *map[string]any `json:"enrollment"`
		Order      *map[string]any `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.False(t, resp.Enrolled, "paid must set enrolled=false")
	require.Nil(t, resp.Enrollment)
	require.NotNil(t, resp.Order)
	require.Equal(t, "pending", (*resp.Order)["status"])
	require.Equal(t, "alipay", (*resp.Order)["paymentMethod"])
	require.Equal(t, "99.00", fmt.Sprintf("%v", (*resp.Order)["amount"]))

	// List /me — should be 1
	status, raw = env.do(t, "GET", "/api/v1/orders/me", tok, nil)
	require.Equal(t, 200, status)
	var listResp []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listResp))
	require.Len(t, listResp, 1, "paid path should create 1 order row")
}

func TestOrders_PayPending_MockSucceeds(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-pay"))
	courseID := env.insertCourse(t, "Pay Course", "paid", "199.00")

	// Create order
	body := map[string]any{
		"type": "course", "courseId": courseID, "paymentMethod": "alipay",
	}
	status, raw := env.do(t, "POST", "/api/v1/orders", tok, body)
	require.Equal(t, 201, status)
	var createResp struct {
		Order *struct {
			ID string `json:"id"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &createResp))
	require.NotNil(t, createResp.Order)
	orderID := createResp.Order.ID
	require.NotEmpty(t, orderID)

	// Mock pay
	status, raw = env.do(t, "POST", "/api/v1/orders/"+orderID+"/pay", tok, map[string]any{
		"paymentMethod": "wechat",
	})
	require.Equal(t, 200, status, "pay: %s", string(raw))

	// Verify status=paid in response
	var payResp struct {
		Order struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &payResp))
	require.Equal(t, "paid", payResp.Order.Status)

	// And an enrollment row should exist now
	var enrCount int
	err := env.db.QueryRow(`SELECT COUNT(*) FROM enrollments WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)`,
		"user-ord-pay-%").Scan(&enrCount)
	require.NoError(t, err)
	require.Equal(t, 1, enrCount, "mock pay must create 1 enrollment")

	// Re-pay should 409 (already paid)
	status, raw = env.do(t, "POST", "/api/v1/orders/"+orderID+"/pay", tok, map[string]any{
		"paymentMethod": "wechat",
	})
	require.Equal(t, 409, status, "second pay must be 409: %s", string(raw))
}

func TestOrders_CancelPending(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-cancel"))
	courseID := env.insertCourse(t, "Cancel Course", "paid", "50.00")

	status, raw := env.do(t, "POST", "/api/v1/orders", tok, map[string]any{
		"type": "course", "courseId": courseID, "paymentMethod": "alipay",
	})
	require.Equal(t, 201, status)
	var cr struct {
		Order *struct {
			ID string `json:"id"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &cr))
	orderID := cr.Order.ID

	// Cancel
	status, raw = env.do(t, "POST", "/api/v1/orders/"+orderID+"/cancel", tok, nil)
	require.Equal(t, 200, status, "cancel: %s", string(raw))
	var cancelResp map[string]any
	require.NoError(t, json.Unmarshal(raw, &cancelResp))
	require.Equal(t, true, cancelResp["ok"])

	// Status should now be 'expired'
	status, raw = env.do(t, "GET", "/api/v1/orders/"+orderID, tok, nil)
	require.Equal(t, 200, status)
	var getResp struct {
		Order struct {
			Status string `json:"status"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &getResp))
	require.Equal(t, "expired", getResp.Order.Status)

	// Re-cancel should 400 (not pending anymore)
	status, _ = env.do(t, "POST", "/api/v1/orders/"+orderID+"/cancel", tok, nil)
	require.Equal(t, 400, status, "second cancel must be 400")
}

func TestOrders_GetByID_NotOwner_404(t *testing.T) {
	env := setupOrdersEnv(t)
	// Two students
	tokA, _ := env.registerStudent(t, makeEmail("ord-ownA"))
	tokB, _ := env.registerStudent(t, makeEmail("ord-ownB"))
	courseID := env.insertCourse(t, "Owner Course", "paid", "10.00")

	// A creates
	status, raw := env.do(t, "POST", "/api/v1/orders", tokA, map[string]any{
		"type": "course", "courseId": courseID, "paymentMethod": "alipay",
	})
	require.Equal(t, 201, status)
	var cr struct {
		Order *struct {
			ID string `json:"id"`
		} `json:"order"`
	}
	require.NoError(t, json.Unmarshal(raw, &cr))
	orderID := cr.Order.ID

	// B tries to read A's order — must be 404 (no enumeration)
	status, _ = env.do(t, "GET", "/api/v1/orders/"+orderID, tokB, nil)
	require.Equal(t, 404, status, "non-owner must get 404, not 403")

	// A can read their own — must be 200
	status, _ = env.do(t, "GET", "/api/v1/orders/"+orderID, tokA, nil)
	require.Equal(t, 200, status, "owner must be 200")
}

func TestOrders_DegreeOrder_PayAndEnrollAll(t *testing.T) {
	env := setupOrdersEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ord-degree"))
	degreeID := env.insertDegree(t, "Free Degree", "free", "0")

	// Create free degree order — should auto-enroll degree + degree courses
	status, raw := env.do(t, "POST", "/api/v1/orders", tok, map[string]any{
		"type": "degree", "degreeId": degreeID,
	})
	require.Equal(t, 201, status, "free degree: %s", string(raw))

	var resp struct {
		Enrolled   bool `json:"enrolled"`
		Enrollment *struct {
			ID       string  `json:"id"`
			DegreeID *string `json:"degreeId"`
		} `json:"enrollment"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.True(t, resp.Enrolled)
	require.Equal(t, degreeID, *resp.Enrollment.DegreeID)
}
