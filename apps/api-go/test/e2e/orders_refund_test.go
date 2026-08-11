// Package e2e — orders refund flow end-to-end test.
//
// Phase 2 T15-final: covers the POST /api/v1/orders/:id/refund endpoint
// with the 4 NestJS eligibility rules (course not-started, course < 7d
// < 20%, course denied, degree not-started, degree denied).
//
// Tests:
//   - Unauthenticated → 401
//   - Non-paid order → 400
//   - Non-existent order → 404
//   - Other user's order → 404 (ID-enumeration defense)
//   - Course order, no progress → allowed, feeRate=0, full refund
//   - Course order, < 7d + < 20% progress → allowed, feeRate=0.05
//   - Course order, >= 20% progress → denied
//   - Course order, > 7 days → denied
//   - Degree order, no started courses → allowed
//   - Degree order, started course → denied
//   - Successful refund soft-deletes enrollments + fires notification
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

type refundTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupRefundEnv(t *testing.T) *refundTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_refund_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_refund_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	notifRepo := notifications.NewRepo(db)
	notifSvc := notifications.NewService(notifRepo, log)
	// Wire the refund notifier (T15-final cross-module hook)
	orders.SetRefundNotifier(func(ctx context.Context, userID, orderID, refundAmount string) {
		_ = notifSvc.CreateNotification(ctx, notifications.CreateNotificationInput{
			UserID:  userID,
			Type:    "order",
			Title:   "退款申请已完成",
			Body:    "订单退款已处理，退款金额 ¥" + refundAmount + "。",
			LinkURL: "/orders/" + orderID,
		})
	})

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-refund",
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

	return &refundTestEnv{app: app, db: db, log: log}
}

func (e *refundTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
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

func (e *refundTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *refundTestEnv) insertPaidCourse(t *testing.T, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'paid', '99.00', 'published', 'own', ?, ?)
	`, id, title, now, now)
	require.NoError(t, err)
	return id
}

// insertPaidOrder creates a paid order with paid_at=now (so the 7-day
// window applies) for the given user + course.
func (e *refundTestEnv) insertPaidOrder(t *testing.T, userID, courseID string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO orders (id, user_id, type, course_id, amount, currency, status, paid_at, created_at, updated_at)
		VALUES (?, ?, 'course', ?, '99.00', 'CNY', 'paid', ?, ?, ?)
	`, id, userID, courseID, now, now, now)
	require.NoError(t, err)
	return id
}

// insertPaidOrderWithPaidAtDaysAgo creates a paid order with paid_at
// set to N days ago. Used to test the 7-day refund window.
func (e *refundTestEnv) insertPaidOrderWithPaidAtDaysAgo(t *testing.T, userID, courseID string, daysAgo int) string {
	t.Helper()
	id := uuid.NewString()
	paidAt := time.Now().UTC().AddDate(0, 0, -daysAgo)
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO orders (id, user_id, type, course_id, amount, currency, status, paid_at, created_at, updated_at)
		VALUES (?, ?, 'course', ?, '99.00', 'CNY', 'paid', ?, ?, ?)
	`, id, userID, courseID, paidAt, paidAt, now)
	require.NoError(t, err)
	return id
}

func (e *refundTestEnv) insertEnrollment(t *testing.T, userID, courseID, source string) {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO enrollments (id, user_id, course_id, enrolled_at, source)
		VALUES (?, ?, ?, ?, ?)
	`, id, userID, courseID, now, source)
	require.NoError(t, err)
}

func (e *refundTestEnv) insertChapter(t *testing.T, courseID, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO chapters (id, course_id, title, order_index, created_at, deleted_at)
		VALUES (?, ?, ?, 0, ?, NULL)
	`, id, courseID, title, now)
	require.NoError(t, err)
	return id
}

func (e *refundTestEnv) insertLesson(t *testing.T, chapterID, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO lessons (id, chapter_id, title, order_index, created_at, deleted_at)
		VALUES (?, ?, ?, 0, ?, NULL)
	`, id, chapterID, title, now)
	require.NoError(t, err)
	return id
}

func (e *refundTestEnv) insertProgressCompleted(t *testing.T, userID, courseID, lessonID string) {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO progress_records (id, user_id, course_id, lesson_id, status, completed_at, updated_at)
		VALUES (?, ?, ?, ?, 'completed', ?, ?)
	`, id, userID, courseID, lessonID, now, now)
	require.NoError(t, err)
}

// ============ TESTS ============

func TestRefund_Unauthenticated_401(t *testing.T) {
	env := setupRefundEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/orders/abc/refund", "", nil)
	require.Equal(t, 401, status)
}

func TestRefund_NonPaidOrder_400(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-npaid"))
	courseID := env.insertPaidCourse(t, "Test C")
	// Create a PENDING order (not paid)
	orderID := uuid.NewString()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO orders (id, user_id, type, course_id, amount, currency, status, created_at, updated_at)
		VALUES (?, ?, 'course', ?, '99.00', 'CNY', 'pending', NOW(3), NOW(3))
	`, orderID, userID, courseID)
	require.NoError(t, err)

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 400, status, "should reject non-paid: %s", string(raw))
}

func TestRefund_NotFound_404(t *testing.T) {
	env := setupRefundEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("rf-404"))
	status, _ := env.do(t, "POST", "/api/v1/orders/nonexistent-id/refund", tok, nil)
	require.Equal(t, 404, status)
}

func TestRefund_OtherUsersOrder_404(t *testing.T) {
	env := setupRefundEnv(t)
	_, userA := env.registerStudent(t, makeEmail("rf-other-a"))
	tokB, _ := env.registerStudent(t, makeEmail("rf-other-b"))
	courseID := env.insertPaidCourse(t, "Other C")
	orderA := env.insertPaidOrder(t, userA, courseID)

	// B tries to refund A's order — should 404, not 403
	status, _ := env.do(t, "POST", "/api/v1/orders/"+orderA+"/refund", tokB, nil)
	require.Equal(t, 404, status, "should hide existence")
}

func TestRefund_CourseOrder_NoProgress_FullRefund(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-full"))
	courseID := env.insertPaidCourse(t, "Full C")
	orderID := env.insertPaidOrder(t, userID, courseID)
	env.insertEnrollment(t, userID, courseID, "order")

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 200, status, "refund: %s", string(raw))
	var resp struct {
		ID           string  `json:"id"`
		Status       string  `json:"status"`
		RefundAmount string  `json:"refundAmount"`
		FeeRate      float64 `json:"feeRate"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, "refunded", resp.Status)
	require.Equal(t, float64(0), resp.FeeRate)
	require.Equal(t, "99.00", resp.RefundAmount)

	// Verify DB state
	var statusDB string
	require.NoError(t, env.db.QueryRow(`SELECT status FROM orders WHERE id = ?`, orderID).Scan(&statusDB))
	require.Equal(t, "refunded", statusDB)

	var delAt sql.NullTime
	require.NoError(t, env.db.QueryRow(`SELECT deleted_at FROM enrollments WHERE user_id = ? AND course_id = ? AND source = 'order'`,
		userID, courseID).Scan(&delAt))
	require.True(t, delAt.Valid, "order-sourced enrollment should be soft-deleted")
}

func TestRefund_CourseOrder_PartialProgress_5PercentFee(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-partial"))
	courseID := env.insertPaidCourse(t, "Partial C")
	orderID := env.insertPaidOrder(t, userID, courseID)

	// Set up chapters/lessons: 1 chapter with 10 lessons; user has completed 1 (10% < 20%).
	chID := env.insertChapter(t, courseID, "Ch1")
	for i := 0; i < 10; i++ {
		env.insertLesson(t, chID, fmt.Sprintf("L%d", i))
	}
	// Get first lesson
	var firstLessonID string
	require.NoError(t, env.db.QueryRow(`SELECT id FROM lessons WHERE chapter_id = ? LIMIT 1`, chID).Scan(&firstLessonID))
	env.insertProgressCompleted(t, userID, courseID, firstLessonID)
	env.insertEnrollment(t, userID, courseID, "order")

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 200, status, "partial refund: %s", string(raw))
	var resp struct {
		Status       string  `json:"status"`
		RefundAmount string  `json:"refundAmount"`
		FeeRate      float64 `json:"feeRate"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, "refunded", resp.Status)
	require.Equal(t, float64(0.05), resp.FeeRate, "should charge 5% fee")
	require.Equal(t, "94.05", resp.RefundAmount, "99.00 * 0.95 = 94.05")
}

func TestRefund_CourseOrder_HighProgress_Denied(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-high"))
	courseID := env.insertPaidCourse(t, "High C")
	orderID := env.insertPaidOrder(t, userID, courseID)

	// 1 chapter with 5 lessons; user has completed 2 (40% >= 20%)
	chID := env.insertChapter(t, courseID, "Ch1")
	var lessonIDs []string
	for i := 0; i < 5; i++ {
		lessonIDs = append(lessonIDs, env.insertLesson(t, chID, fmt.Sprintf("L%d", i)))
	}
	for i := 0; i < 2; i++ {
		env.insertProgressCompleted(t, userID, courseID, lessonIDs[i])
	}
	env.insertEnrollment(t, userID, courseID, "order")

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 400, status, "high progress should 400: %s", string(raw))
	var env400 errs.Envelope
	require.NoError(t, json.Unmarshal(raw, &env400))
	require.Contains(t, env400.Message, "20%", "reason should mention progress")

	// Order status should still be 'paid' (not refunded)
	var statusDB string
	require.NoError(t, env.db.QueryRow(`SELECT status FROM orders WHERE id = ?`, orderID).Scan(&statusDB))
	require.Equal(t, "paid", statusDB)
}

func TestRefund_CourseOrder_Over7Days_Denied(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-7d"))
	courseID := env.insertPaidCourse(t, "Old C")

	// Set up chapters/lessons: 1 chapter with 5 lessons; user has completed 1 (20% — not over 20% bar)
	// Rule 1 says 0 completed → allowed, regardless of days. So we need at least 1 completed
	// to push the check into the 7-day rule.
	chID := env.insertChapter(t, courseID, "Ch1")
	var lessonIDs []string
	for i := 0; i < 5; i++ {
		lessonIDs = append(lessonIDs, env.insertLesson(t, chID, fmt.Sprintf("L%d", i)))
	}
	env.insertProgressCompleted(t, userID, courseID, lessonIDs[0])

	// Paid 10 days ago — should hit the "已超过 7 天退款窗口" rule.
	orderID := env.insertPaidOrderWithPaidAtDaysAgo(t, userID, courseID, 10)

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 400, status, "over 7d should 400: %s", string(raw))
	var env400 errs.Envelope
	require.NoError(t, json.Unmarshal(raw, &env400))
	require.Contains(t, env400.Message, "7", "reason should mention 7-day window")
}

func TestRefund_DegreeOrder_NoStartedCourses_Allowed(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-dn"))
	// Degree + 2 courses; user has NO progress on either
	degID := uuid.NewString()
	now := time.Now().UTC()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO nano_degrees (id, title, description, learning_points, price, cost_type, updated_at)
		VALUES (?, 'Test D', 'x', 'x', '199.00', 'paid', ?)
	`, degID, now)
	require.NoError(t, err)

	c1 := env.insertPaidCourse(t, "DC1")
	c2 := env.insertPaidCourse(t, "DC2")
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO degree_courses (degree_id, course_id, order_index) VALUES (?, ?, 0), (?, ?, 1)
	`, degID, c1, degID, c2)
	require.NoError(t, err)

	orderID := uuid.NewString()
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO orders (id, user_id, type, degree_id, amount, currency, status, paid_at, created_at, updated_at)
		VALUES (?, ?, 'degree', ?, '199.00', 'CNY', 'paid', ?, ?, ?)
	`, orderID, userID, degID, now, now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 200, status, "degree refund: %s", string(raw))
}

func TestRefund_DegreeOrder_StartedCourse_Denied(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-dy"))
	degID := uuid.NewString()
	now := time.Now().UTC()
	_, err := env.db.ExecContext(context.Background(), `
		INSERT INTO nano_degrees (id, title, description, learning_points, price, cost_type, updated_at)
		VALUES (?, 'Test D', 'x', 'x', '199.00', 'paid', ?)
	`, degID, now)
	require.NoError(t, err)

	c1 := env.insertPaidCourse(t, "DC1")
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO degree_courses (degree_id, course_id, order_index) VALUES (?, ?, 0)
	`, degID, c1)
	require.NoError(t, err)

	// User has in_progress on c1
	chID := env.insertChapter(t, c1, "Ch1")
	lessonID := env.insertLesson(t, chID, "L1")
	id := uuid.NewString()
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO progress_records (id, user_id, course_id, lesson_id, status, updated_at)
		VALUES (?, ?, ?, ?, 'in_progress', ?)
	`, id, userID, c1, lessonID, now)
	require.NoError(t, err)

	orderID := uuid.NewString()
	_, err = env.db.ExecContext(context.Background(), `
		INSERT INTO orders (id, user_id, type, degree_id, amount, currency, status, paid_at, created_at, updated_at)
		VALUES (?, ?, 'degree', ?, '199.00', 'CNY', 'paid', ?, ?, ?)
	`, orderID, userID, degID, now, now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 400, status, "started degree should 400: %s", string(raw))
}

func TestRefund_FiresNotification(t *testing.T) {
	env := setupRefundEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("rf-notif"))
	courseID := env.insertPaidCourse(t, "Notif C")
	orderID := env.insertPaidOrder(t, userID, courseID)
	env.insertEnrollment(t, userID, courseID, "order")

	// Refund
	status, _ := env.do(t, "POST", "/api/v1/orders/"+orderID+"/refund", tok, nil)
	require.Equal(t, 200, status)

	// The cross-module hook should have fired. Wait briefly for the
	// fire-and-forget to complete.
	time.Sleep(50 * time.Millisecond)

	// Verify notification row exists
	var n int
	require.NoError(t, env.db.QueryRow(`
		SELECT COUNT(*) FROM notifications
		WHERE user_id = ? AND type = 'order' AND title = '退款申请已完成'
	`, userID).Scan(&n))
	require.Equal(t, 1, n, "refund should fire exactly 1 'order' notification")
}
