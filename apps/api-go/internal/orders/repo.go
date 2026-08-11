// Package orders — repo layer.
//
// Phase 2 T13-2: thin wrapper around internal/repo/db for the orders
// module. Mirrors apps/api/src/modules/orders/orders.service.ts
// with stubs for the cross-module dependencies that ship in T14/T15/T16
// (certificates, notifications, refund eligibility).
package orders

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("orders: not found")

// Repo is the orders data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUser returns the user's orders, newest first, max 100.
func (r *Repo) ListByUser(ctx context.Context, userID string) ([]db.Order, error) {
	rows, err := r.q.ListOrdersByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("orders.repo: list: %w", err)
	}
	return rows, nil
}

// GetByID looks up an order by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Order, error) {
	o, err := r.q.GetOrderByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Order{}, ErrNotFound
		}
		return db.Order{}, fmt.Errorf("orders.repo: get: %w", err)
	}
	return o, nil
}

// CreateInput is the create-order payload.
type CreateInput struct {
	UserID        string
	Type          db.OrdersType
	CourseID      sql.NullString
	DegreeID      sql.NullString
	Amount        string
	Currency      string
	PaymentMethod db.OrdersPaymentMethod
}

// Create inserts a new order with status='pending'.
func (r *Repo) Create(ctx context.Context, in CreateInput) (db.Order, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	pmNull := db.NullOrdersPaymentMethod{OrdersPaymentMethod: in.PaymentMethod, Valid: true}
	if _, err := r.q.CreateOrder(ctx, db.CreateOrderParams{
		ID: id, UserID: in.UserID, Type: in.Type, CourseID: in.CourseID,
		DegreeID: in.DegreeID, Amount: in.Amount, Currency: in.Currency,
		Status: db.OrdersStatusPending, PaymentMethod: pmNull,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		return db.Order{}, fmt.Errorf("orders.repo: create: %w", err)
	}
	return db.Order{
		ID: id, UserID: in.UserID, Type: in.Type, CourseID: in.CourseID,
		DegreeID: in.DegreeID, Amount: in.Amount, Currency: in.Currency,
		Status: db.OrdersStatusPending, PaymentMethod: pmNull,
		CreatedAt: now, UpdatedAt: now,
	}, nil
}

// MarkPaid atomically flips the order from pending → paid. Returns
// the number of rows affected (1 = success, 0 = already processed
// or not pending).
func (r *Repo) MarkPaid(ctx context.Context, id, transactionID string, method db.OrdersPaymentMethod) (int64, error) {
	now := time.Now().UTC()
	res, err := r.conn.ExecContext(ctx, `
		UPDATE orders
		SET status = 'paid', paid_at = ?, payment_method = ?, transaction_id = ?, updated_at = ?
		WHERE id = ? AND status = 'pending'
	`, now, method, transactionID, now, id)
	if err != nil {
		return 0, fmt.Errorf("orders.repo: mark paid: %w", err)
	}
	return res.RowsAffected()
}

// Cancel sets status='expired' iff status='pending'. Idempotent.
func (r *Repo) Cancel(ctx context.Context, id string) (int64, error) {
	now := time.Now().UTC()
	res, err := r.conn.ExecContext(ctx, `
		UPDATE orders SET status = 'expired', updated_at = ?
		WHERE id = ? AND status = 'pending'
	`, now, id)
	if err != nil {
		return 0, fmt.Errorf("orders.repo: cancel: %w", err)
	}
	return res.RowsAffected()
}

// GetCourseForOrder returns cost_type + price for the course. Used
// to decide free vs paid path in createOrder.
func (r *Repo) GetCourseForOrder(ctx context.Context, courseID string) (db.GetCourseForOrderRow, error) {
	c, err := r.q.GetCourseForOrder(ctx, courseID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetCourseForOrderRow{}, ErrNotFound
		}
		return db.GetCourseForOrderRow{}, fmt.Errorf("orders.repo: get course: %w", err)
	}
	return c, nil
}

// GetDegreeForOrder returns cost_type + price for the degree.
func (r *Repo) GetDegreeForOrder(ctx context.Context, degreeID string) (db.GetDegreeForOrderRow, error) {
	d, err := r.q.GetDegreeForOrder(ctx, degreeID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetDegreeForOrderRow{}, ErrNotFound
		}
		return db.GetDegreeForOrderRow{}, fmt.Errorf("orders.repo: get degree: %w", err)
	}
	return d, nil
}

// HasActiveEnrollment returns true if the user already has a non-
// deleted enrollment for the (course|degree) pair. Used to fail
// fast on duplicate paid orders.
func (r *Repo) HasActiveEnrollment(ctx context.Context, userID, courseID, degreeID string) (bool, error) {
	if courseID != "" {
		_, err := r.q.GetActiveEnrollmentByCourse(ctx, db.GetActiveEnrollmentByCourseParams{
			UserID: userID, CourseID: sql.NullString{String: courseID, Valid: true},
		})
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return false, err
		}
		return false, nil
	}
	if degreeID != "" {
		_, err := r.q.GetActiveEnrollmentByDegree(ctx, db.GetActiveEnrollmentByDegreeParams{
			UserID: userID, DegreeID: sql.NullString{String: degreeID, Valid: true},
		})
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return false, err
		}
		return false, nil
	}
	return false, nil
}

// UpsertEnrollment upserts a non-deleted enrollment row with
// source='order'. Used by mockPay after the order is paid.
func (r *Repo) UpsertEnrollment(ctx context.Context, userID, courseID, degreeID, source string) error {
	now := time.Now().UTC()
	// SELECT-then-INSERT/UPDATE pattern (consistent with enrollments module).
	var existingID string
	var lookupSQL string
	var args []any
	if courseID != "" {
		lookupSQL = `SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1`
		args = []any{userID, courseID}
	} else {
		lookupSQL = `SELECT id FROM enrollments WHERE user_id = ? AND degree_id = ? LIMIT 1`
		args = []any{userID, degreeID}
	}
	err := r.conn.QueryRowContext(ctx, lookupSQL, args...).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("orders.repo: upsert enrollment lookup: %w", err)
	}
	if err == nil {
		_, err = r.conn.ExecContext(ctx, `
			UPDATE enrollments
			SET deleted_at = NULL, expires_at = NULL, enrolled_at = ?, source = ?
			WHERE id = ?
		`, now, source, existingID)
		if err != nil {
			return fmt.Errorf("orders.repo: upsert enrollment update: %w", err)
		}
		return nil
	}
	id := uuid.NewString()
	var cArg, dArg sql.NullString
	if courseID != "" {
		cArg = sql.NullString{String: courseID, Valid: true}
	} else {
		dArg = sql.NullString{String: degreeID, Valid: true}
	}
	_, err = r.conn.ExecContext(ctx, `
		INSERT INTO enrollments (id, user_id, course_id, degree_id, enrolled_at, source)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, userID, cArg, dArg, now, source)
	if err != nil {
		return fmt.Errorf("orders.repo: upsert enrollment insert: %w", err)
	}
	return nil
}

// GetDegreeCourses returns the courses in a degree (for the "enroll
// all degree courses" path on degree order).
func (r *Repo) GetDegreeCourses(ctx context.Context, degreeID string) ([]string, error) {
	ids, err := r.q.GetDegreeCourses(ctx, degreeID)
	if err != nil {
		return nil, fmt.Errorf("orders.repo: get degree courses: %w", err)
	}
	return ids, nil
}

// MarkRefunded sets status='refunded'. Used by the refund flow (T15).
func (r *Repo) MarkRefunded(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.conn.ExecContext(ctx, `
		UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?
	`, now, id)
	if err != nil {
		return fmt.Errorf("orders.repo: mark refunded: %w", err)
	}
	return nil
}
