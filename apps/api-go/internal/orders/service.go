// Package orders — service layer.
//
// Phase 2 T13-2: business logic for /api/v1/orders/*. Mirrors
// apps/api/src/modules/orders/orders.service.ts 1:1.
//
// Cross-module dependencies:
//   - certificates: stubbed (IssueCertificateOnPaid). T14 will wire
//     the real impl.
//   - notifications: stubbed (NotifyOrderCreated, NotifyRefund). T16
//     will wire the real impl.
//   - refund eligibility check: stubbed (CheckRefundEligibility).
//     T15 will wire the real impl.
//
// All stubs are no-ops or return safe defaults so the orders flow
// works end-to-end without those modules.
package orders

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the orders business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// APIInput is the API-shaped create-order payload.
type APIInput struct {
	Type          string // "course" | "degree"
	CourseID      string
	DegreeID      string
	PaymentMethod string // "wechat" | "alipay" | "stripe"
}

// OrderWithRefs is the findOne response shape. The course/degree
// summary fields mirror NestJS's `include`.
//
// Note: we expose plain string fields (not sql.NullString structs) and
// camelCase keys to match the OpenAPI spec and the NestJS JSON contract.
// sql.NullString's default JSON shape is `{"String":"x","Valid":true}`
// which breaks the contract.
type OrderWithRefs struct {
	Order  OrderDTO       `json:"order"`
	Course *CourseSummary `json:"course,omitempty"`
	Degree *DegreeSummary `json:"degree,omitempty"`
}

// OrderDTO is the JSON shape we expose for an order. It flattens
// sql.NullString to a plain string (empty for null) and uses
// camelCase to match the NestJS spec.
type OrderDTO struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	Type          string  `json:"type"`
	CourseID      *string `json:"courseId,omitempty"`
	DegreeID      *string `json:"degreeId,omitempty"`
	Amount        string  `json:"amount"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	PaymentMethod *string `json:"paymentMethod,omitempty"`
	TransactionID *string `json:"transactionId,omitempty"`
	PaidAt        *string `json:"paidAt,omitempty"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
}

// toOrderDTO converts a db.Order to the public OrderDTO. The conversion
// flattens sql.NullString to a plain string (or nil) so the response
// matches the OpenAPI spec.
func toOrderDTO(o db.Order) OrderDTO {
	dto := OrderDTO{
		ID:        o.ID,
		UserID:    o.UserID,
		Type:      string(o.Type),
		Amount:    o.Amount,
		Currency:  o.Currency,
		Status:    string(o.Status),
		CreatedAt: o.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: o.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if o.CourseID.Valid {
		s := o.CourseID.String
		dto.CourseID = &s
	}
	if o.DegreeID.Valid {
		s := o.DegreeID.String
		dto.DegreeID = &s
	}
	if o.PaymentMethod.Valid {
		s := string(o.PaymentMethod.OrdersPaymentMethod)
		dto.PaymentMethod = &s
	}
	if o.TransactionID.Valid {
		s := o.TransactionID.String
		dto.TransactionID = &s
	}
	if o.PaidAt.Valid {
		s := o.PaidAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.PaidAt = &s
	}
	return dto
}

type CourseSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
	Level     string `json:"level"`
	CostType  string `json:"costType"`
	Price     string `json:"price"`
}

type DegreeSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
	CostType  string `json:"costType"`
	Price     string `json:"price"`
}

// CreateResult is what the create-order endpoint returns. Mirrors
// NestJS: free → { enrolled: true, enrollment }, paid → { enrolled: false, order }.
type CreateResult struct {
	Enrolled   bool           `json:"enrolled"`
	Enrollment *EnrollmentDTO `json:"enrollment,omitempty"`
	Order      *OrderDTO      `json:"order,omitempty"`
}

// EnrollmentDTO is the JSON shape for the free-path enrollment response.
// Like OrderDTO, it flattens sql.NullString to plain string for the
// OpenAPI contract.
type EnrollmentDTO struct {
	ID         string  `json:"id"`
	UserID     string  `json:"userId"`
	CourseID   *string `json:"courseId,omitempty"`
	DegreeID   *string `json:"degreeId,omitempty"`
	EnrolledAt string  `json:"enrolledAt"`
	ExpiresAt  *string `json:"expiresAt,omitempty"`
	Source     string  `json:"source"`
}

// toEnrollmentDTO converts db.Enrollment to the public EnrollmentDTO.
func toEnrollmentDTO(e db.Enrollment) EnrollmentDTO {
	dto := EnrollmentDTO{
		ID:         e.ID,
		UserID:     e.UserID,
		EnrolledAt: e.EnrolledAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		Source:     string(e.Source),
	}
	if e.CourseID.Valid {
		s := e.CourseID.String
		dto.CourseID = &s
	}
	if e.DegreeID.Valid {
		s := e.DegreeID.String
		dto.DegreeID = &s
	}
	if e.ExpiresAt.Valid {
		s := e.ExpiresAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.ExpiresAt = &s
	}
	return dto
}

// ListByUser returns the user's orders, newest first.
func (s *Service) ListByUser(ctx context.Context, userID string) ([]OrderWithRefs, error) {
	rows, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list orders", err)
	}
	out := make([]OrderWithRefs, 0, len(rows))
	for _, o := range rows {
		out = append(out, s.toOrderWithRefs(ctx, o))
	}
	return out, nil
}

// GetByID returns a single order, with 404 for non-owners (no ID
// enumeration).
func (s *Service) GetByID(ctx context.Context, userID, id string) (OrderWithRefs, error) {
	o, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return OrderWithRefs{}, errs.NotFound("Order not found")
		}
		return OrderWithRefs{}, errs.Internal("get order", err)
	}
	if o.UserID != userID {
		// Prevent ID enumeration: 404 not 403.
		return OrderWithRefs{}, errs.NotFound("Order not found")
	}
	return s.toOrderWithRefs(ctx, o), nil
}

// toOrderWithRefs hydrates the order with its course/degree summary
// (matches NestJS's `include`). Returns the public DTO shape, not the
// raw db model.
func (s *Service) toOrderWithRefs(ctx context.Context, o db.Order) OrderWithRefs {
	out := OrderWithRefs{Order: toOrderDTO(o)}
	if o.CourseID.Valid {
		c, err := s.repo.GetCourseForOrder(ctx, o.CourseID.String)
		if err == nil {
			out.Course = &CourseSummary{
				ID: c.ID, Title: c.Title, CostType: string(c.CostType), Price: c.Price,
			}
		}
	}
	if o.DegreeID.Valid {
		d, err := s.repo.GetDegreeForOrder(ctx, o.DegreeID.String)
		if err == nil {
			out.Degree = &DegreeSummary{
				ID: d.ID, Title: d.Title, CostType: string(d.CostType), Price: d.Price,
			}
		}
	}
	return out
}

// Create creates an order. Free courses/degrees are auto-enrolled;
// paid → returns a pending order.
func (s *Service) Create(ctx context.Context, userID string, in APIInput) (CreateResult, error) {
	switch in.Type {
	case "course":
		return s.createCourseOrder(ctx, userID, in)
	case "degree":
		return s.createDegreeOrder(ctx, userID, in)
	default:
		return CreateResult{}, errs.BadRequest("type must be course or degree")
	}
}

func (s *Service) createCourseOrder(ctx context.Context, userID string, in APIInput) (CreateResult, error) {
	if in.CourseID == "" {
		return CreateResult{}, errs.BadRequest("courseId required")
	}
	c, err := s.repo.GetCourseForOrder(ctx, in.CourseID)
	if err != nil {
		if err == ErrNotFound {
			return CreateResult{}, errs.NotFound("Course not found")
		}
		return CreateResult{}, errs.Internal("get course", err)
	}
	already, err := s.repo.HasActiveEnrollment(ctx, userID, in.CourseID, "")
	if err != nil {
		return CreateResult{}, errs.Internal("check enrollment", err)
	}
	if already {
		return CreateResult{}, errs.Conflict("Already enrolled")
	}

	// Free path: direct upsert.
	if c.CostType == db.CoursesCostTypeFree {
		if err := s.repo.UpsertEnrollment(ctx, userID, in.CourseID, "", "direct"); err != nil {
			return CreateResult{}, errs.Internal("enroll free", err)
		}
		// Return the upserted enrollment.
		rows, err := s.repo.q.GetActiveEnrollmentByCourse(ctx, db.GetActiveEnrollmentByCourseParams{
			UserID:   userID,
			CourseID: sql.NullString{String: in.CourseID, Valid: true},
		})
		if err != nil {
			return CreateResult{}, errs.Internal("reload enrollment", err)
		}
		s.writeAudit(ctx, "order.create.free_enroll", rows.ID, userID)
		IssueCertificateOnPaid(ctx, userID, "course", in.CourseID)
		edto := toEnrollmentDTO(rows)
		return CreateResult{Enrolled: true, Enrollment: &edto}, nil
	}

	// Paid path: create pending order.
	method := db.OrdersPaymentMethod("")
	switch in.PaymentMethod {
	case "wechat":
		method = db.OrdersPaymentMethodWechat
	case "alipay":
		method = db.OrdersPaymentMethodAlipay
	}
	o, err := s.repo.Create(ctx, CreateInput{
		UserID:        userID,
		Type:          db.OrdersTypeCourse,
		CourseID:      sql.NullString{String: in.CourseID, Valid: true},
		Amount:        c.Price,
		Currency:      "CNY",
		PaymentMethod: method,
	})
	if err != nil {
		return CreateResult{}, errs.Internal("create order", err)
	}
	s.writeAudit(ctx, "order.create", o.ID, userID)
	NotifyOrderCreated(ctx, userID, o.ID, c.Price)
	odto := toOrderDTO(o)
	return CreateResult{Enrolled: false, Order: &odto}, nil
}

func (s *Service) createDegreeOrder(ctx context.Context, userID string, in APIInput) (CreateResult, error) {
	if in.DegreeID == "" {
		return CreateResult{}, errs.BadRequest("degreeId required")
	}
	d, err := s.repo.GetDegreeForOrder(ctx, in.DegreeID)
	if err != nil {
		if err == ErrNotFound {
			return CreateResult{}, errs.NotFound("Degree not found")
		}
		return CreateResult{}, errs.Internal("get degree", err)
	}
	already, err := s.repo.HasActiveEnrollment(ctx, userID, "", in.DegreeID)
	if err != nil {
		return CreateResult{}, errs.Internal("check enrollment", err)
	}
	if already {
		return CreateResult{}, errs.Conflict("Already enrolled")
	}

	if d.CostType == db.NanoDegreesCostTypeFree {
		if err := s.repo.UpsertEnrollment(ctx, userID, "", in.DegreeID, "direct"); err != nil {
			return CreateResult{}, errs.Internal("enroll free degree", err)
		}
		// Enroll all degree courses too.
		_ = s.enrollAllDegreeCourses(ctx, userID, in.DegreeID)
		rows, err := s.repo.q.GetActiveEnrollmentByDegree(ctx, db.GetActiveEnrollmentByDegreeParams{
			UserID:   userID,
			DegreeID: sql.NullString{String: in.DegreeID, Valid: true},
		})
		if err != nil {
			return CreateResult{}, errs.Internal("reload enrollment", err)
		}
		s.writeAudit(ctx, "order.create.free_enroll", rows.ID, userID)
		IssueCertificateOnPaid(ctx, userID, "degree", in.DegreeID)
		edto := toEnrollmentDTO(rows)
		return CreateResult{Enrolled: true, Enrollment: &edto}, nil
	}

	method := db.OrdersPaymentMethod("")
	switch in.PaymentMethod {
	case "wechat":
		method = db.OrdersPaymentMethodWechat
	case "alipay":
		method = db.OrdersPaymentMethodAlipay
	}
	o, err := s.repo.Create(ctx, CreateInput{
		UserID:        userID,
		Type:          db.OrdersTypeDegree,
		DegreeID:      sql.NullString{String: in.DegreeID, Valid: true},
		Amount:        d.Price,
		Currency:      "CNY",
		PaymentMethod: method,
	})
	if err != nil {
		return CreateResult{}, errs.Internal("create order", err)
	}
	s.writeAudit(ctx, "order.create", o.ID, userID)
	NotifyOrderCreated(ctx, userID, o.ID, d.Price)
	odto := toOrderDTO(o)
	return CreateResult{Enrolled: false, Order: &odto}, nil
}

// enrollAllDegreeCourses enrolls the user in every course in the
// degree's curriculum. Idempotent.
func (s *Service) enrollAllDegreeCourses(ctx context.Context, userID, degreeID string) error {
	courses, err := s.repo.GetDegreeCourses(ctx, degreeID)
	if err != nil {
		return err
	}
	for _, c := range courses {
		if err := s.repo.UpsertEnrollment(ctx, userID, c, "", "degree"); err != nil {
			return err
		}
	}
	return nil
}

// MockPay marks a pending order as paid and creates the
// enrollment. Mirrors NestJS's mockPay flow. Returns the paid order.
func (s *Service) MockPay(ctx context.Context, userID, orderID, paymentMethod string) (OrderWithRefs, error) {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		if err == ErrNotFound {
			return OrderWithRefs{}, errs.NotFound("Order not found")
		}
		return OrderWithRefs{}, errs.Internal("get order", err)
	}
	if o.UserID != userID {
		return OrderWithRefs{}, errs.BadRequest("Not your order")
	}
	if o.Status == db.OrdersStatusPaid {
		return OrderWithRefs{}, errs.Conflict("Order already paid")
	}
	if o.Status == db.OrdersStatusExpired || o.Status == db.OrdersStatusRefunded {
		return OrderWithRefs{}, errs.BadRequest("Order is no longer payable")
	}

	method := db.OrdersPaymentMethodAlipay
	switch paymentMethod {
	case "wechat":
		method = db.OrdersPaymentMethodWechat
	case "stripe":
		method = db.OrdersPaymentMethodAlipay // stripe falls back to alipay enum (no separate value)
	}

	txnID := "mock_" + randomHex(8)

	// Atomic flip: only pending → paid. If 0 rows, another request beat us.
	n, err := s.repo.MarkPaid(ctx, orderID, txnID, method)
	if err != nil {
		return OrderWithRefs{}, errs.Internal("mark paid", err)
	}
	if n == 0 {
		return OrderWithRefs{}, errs.Conflict("Order already processed")
	}

	// Create enrollment.
	var courseID, degreeID, sourceType string
	if o.CourseID.Valid {
		courseID = o.CourseID.String
		sourceType = "order"
	} else if o.DegreeID.Valid {
		degreeID = o.DegreeID.String
		sourceType = "order"
	}
	if courseID != "" || degreeID != "" {
		if err := s.repo.UpsertEnrollment(ctx, userID, courseID, degreeID, sourceType); err != nil {
			return OrderWithRefs{}, errs.Internal("enrollment", err)
		}
		// For degree orders, also enroll all degree courses.
		if degreeID != "" {
			_ = s.enrollAllDegreeCourses(ctx, userID, degreeID)
		}
	}

	s.writeAudit(ctx, "order.pay", orderID, userID)

	// T14: issue certificate on degree completion (T15 in reality).
	if degreeID != "" {
		IssueCertificateOnPaid(ctx, userID, "degree", degreeID)
	}

	// Reload to return fresh row.
	o, err = s.repo.GetByID(ctx, orderID)
	if err != nil {
		return OrderWithRefs{}, errs.Internal("reload order", err)
	}
	return s.toOrderWithRefs(ctx, o), nil
}

// Cancel marks a pending order as expired.
func (s *Service) Cancel(ctx context.Context, userID, orderID string) error {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Order not found")
		}
		return errs.Internal("get order", err)
	}
	if o.UserID != userID {
		return errs.BadRequest("Not your order")
	}
	if o.Status != db.OrdersStatusPending {
		return errs.BadRequest("Only pending orders can be cancelled")
	}
	n, err := s.repo.Cancel(ctx, orderID)
	if err != nil {
		return errs.Internal("cancel", err)
	}
	if n == 0 {
		return errs.BadRequest("Order is no longer pending")
	}
	s.writeAudit(ctx, "order.cancel", orderID, userID)
	return nil
}

// RefundOrder — implemented in refund.go (T15-final). Replaces the
// T13-2 placeholder.

// RefundEligibility is the structured result of CheckRefundEligibility.
type RefundEligibility struct {
	Allowed bool
	Reason  string
	FeeRate float64
}

// writeAudit appends an audit log entry. Best-effort.
func (s *Service) writeAudit(ctx context.Context, action, entityID, userID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, details, created_at)
		VALUES (UUID(), ?, 'order', ?, JSON_OBJECT('userId', ?), NOW(3))
	`, action, entityID, userID)
	if err != nil {
		s.log.Warn("audit log write failed", zap.String("action", action), zap.Error(err))
	}
}

// ============ cross-module stubs ============
//
// Each of these is a package-level var that the corresponding module
// (certificates, notifications, T15 refund-eligibility) overrides
// at boot. The default is a no-op so this module works without them.

// IssueCertificateOnPaid is called when a free/paid enrollment
// happens. T14 will wire the real impl.
var IssueCertificateOnPaid = func(_ context.Context, _, _, _ string) {}

// NotifyOrderCreated sends a user-facing notification when an
// order is created. T16 will wire the real impl.
var NotifyOrderCreated = func(_ context.Context, _, _, _ string) {}

// CheckRefundEligibility is called by RefundOrder. Wired to the
// progress service by main.go (T15-final). Default returns
// {allowed: false, reason: "refund check not yet wired (T15)"}.
var CheckRefundEligibility = func(_ context.Context, _, _ string) RefundEligibility {
	return RefundEligibility{Allowed: false, Reason: "refund check not yet wired (T15)"}
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "fallback"
	}
	return hex.EncodeToString(b)
}

// silence unused imports
var _ = errors.New
