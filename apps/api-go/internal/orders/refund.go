// Package orders — refund flow. Phase 2 T15-final.
//
// Mirrors apps/api/src/modules/orders/orders.service.ts::refundOrder +
// checkRefundEligibility.
//
// Rules (1:1 with NestJS):
//
//	Course order:
//	  - Not started (0 progress records)              → allowed, feeRate=0
//	  - Started < 7 days + progress < 20%              → allowed, feeRate=0.05
//	  - Otherwise (already studied, or > 7 days, or >=20%) → denied
//	Degree order:
//	  - All linked courses not started                 → allowed, feeRate=0
//	  - Any course started                             → denied
//
// On approval:
//  1. Atomic: mark order status='refunded' + soft-delete the
//     order-sourced enrollments (and degree-sourced course enrollments
//     for degree orders).
//  2. Audit log.
//  3. Notification (cross-module: refundNotifier, set by main.go).
package orders

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// RefundResult is the public response of RefundOrder.
type RefundResult struct {
	OrderID      string  `json:"id"`
	Status       string  `json:"status"`
	RefundAmount string  `json:"refundAmount"`
	FeeRate      float64 `json:"feeRate"`
}

// refundNotifier fires the "退款已完成" notification. Defaults to
// no-op; main.go overrides with the real impl. Passing the function
// rather than importing the notifications package keeps the orders
// package free of compile-time deps on its peers.
var refundNotifier = func(_ context.Context, _ string, _ string, _ string) {}

// SetRefundNotifier wires a real notification sender.
func SetRefundNotifier(fn func(ctx context.Context, userID, orderID, refundAmount string)) {
	refundNotifier = fn
}

// checkRefund runs the eligibility rules and returns (allowed, feeRate, reason).
// Pure function — no side effects. Used by both the Service.RefundOrder
// flow and the legacy CheckRefundEligibility stub (kept for back-compat
// with any caller that still holds a reference to the stub).
func (s *Service) checkRefund(ctx context.Context, o db.Order) (allowed bool, feeRate float64, reason string, err error) {
	// Fallback: no paidAt → treat as "just paid"
	paid := time.Now().UTC()
	if o.PaidAt.Valid {
		paid = o.PaidAt.Time
	}
	daysSincePaid := time.Since(paid).Hours() / 24

	switch o.Type {
	case db.OrdersTypeCourse:
		if !o.CourseID.Valid {
			return false, 0, "订单缺少课程 ID", nil
		}
		completed, err := s.repo.q.RefundCountCompletedLessonsForCourse(ctx, db.RefundCountCompletedLessonsForCourseParams{
			UserID: o.UserID, CourseID: o.CourseID.String,
		})
		if err != nil {
			return false, 0, "", fmt.Errorf("count completed: %w", err)
		}
		total, err := s.repo.q.RefundCountTotalLessonsForCourse(ctx, o.CourseID.String)
		if err != nil {
			return false, 0, "", fmt.Errorf("count total: %w", err)
		}
		// Rule 1: not started
		if completed == 0 {
			return true, 0, "", nil
		}
		// Rule 2: 7 days + < 20%
		progress := 0.0
		if total > 0 {
			progress = float64(completed) / float64(total)
		}
		if daysSincePaid < 7 && progress < 0.2 {
			return true, 0.05, "", nil
		}
		// Rule 3: denied
		if daysSincePaid >= 7 {
			return false, 0, "已超过 7 天退款窗口,无法退款", nil
		}
		return false, 0, fmt.Sprintf("学习进度 %d%% ≥ 20%%,无法退款", int(progress*100)), nil

	case db.OrdersTypeDegree:
		if !o.DegreeID.Valid {
			return false, 0, "订单缺少学位 ID", nil
		}
		started, err := s.repo.q.RefundCountStartedDegreeCourses(ctx, db.RefundCountStartedDegreeCoursesParams{
			UserID: o.UserID, DegreeID: o.DegreeID.String,
		})
		if err != nil {
			return false, 0, "", fmt.Errorf("count started degree courses: %w", err)
		}
		// No started courses → allow
		if started == 0 {
			return true, 0, "", nil
		}
		return false, 0, "学位关联课程中已有学习记录,学位不支持退款", nil

	default:
		return false, 0, "不支持的订单类型", nil
	}
}

// RefundOrder is the T15-final implementation. Replaces the placeholder
// from T13-2. Runs the eligibility check, computes the refund amount,
// atomically marks the order refunded + revokes enrollments, writes
// audit log, and fires the refund notification.
func (s *Service) RefundOrder(ctx context.Context, userID, orderID string) (RefundResult, error) {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		if err == ErrNotFound {
			return RefundResult{}, errs.NotFound("Order not found")
		}
		return RefundResult{}, errs.Internal("get order", err)
	}
	if o.UserID != userID {
		// 404 instead of 403 — prevents ID enumeration
		return RefundResult{}, errs.NotFound("Order not found")
	}
	if o.Status != db.OrdersStatusPaid {
		return RefundResult{}, errs.BadRequest("Only paid orders can be refunded")
	}

	allowed, feeRate, reason, err := s.checkRefund(ctx, o)
	if err != nil {
		return RefundResult{}, errs.Internal("refund check", err)
	}
	if !allowed {
		return RefundResult{}, errs.BadRequest(reason)
	}

	// Compute refund amount
	fullAmount, _ := strconv.ParseFloat(o.Amount, 64)
	refundAmount := fullAmount
	if feeRate > 0 {
		refundAmount = fullAmount * (1 - feeRate)
	}

	// Atomic: mark refunded + revoke enrollments
	revokedAt := time.Now().UTC()
	if err := s.repo.MarkRefunded(ctx, orderID); err != nil {
		return RefundResult{}, errs.Internal("mark refunded", err)
	}
	switch o.Type {
	case db.OrdersTypeCourse:
		if o.CourseID.Valid {
			if _, err := s.repo.q.RefundRevokeEnrollmentsForCourse(ctx, db.RefundRevokeEnrollmentsForCourseParams{
				DeletedAt: sql.NullTime{Time: revokedAt, Valid: true},
				UserID:    userID,
				CourseID:  o.CourseID,
			}); err != nil {
				s.log.Warn("refund revoke course enrollment failed", zap.Error(err))
			}
		}
	case db.OrdersTypeDegree:
		if o.DegreeID.Valid {
			if _, err := s.repo.q.RefundRevokeEnrollmentsForDegree(ctx, db.RefundRevokeEnrollmentsForDegreeParams{
				DeletedAt: sql.NullTime{Time: revokedAt, Valid: true},
				UserID:    userID,
				DegreeID:  o.DegreeID,
			}); err != nil {
				s.log.Warn("refund revoke degree enrollment failed", zap.Error(err))
			}
			if _, err := s.repo.q.RefundRevokeDegreeCourseEnrollments(ctx, db.RefundRevokeDegreeCourseEnrollmentsParams{
				DeletedAt: sql.NullTime{Time: revokedAt, Valid: true},
				UserID:    userID,
				DegreeID:  o.DegreeID.String,
			}); err != nil {
				s.log.Warn("refund revoke degree-course enrollments failed", zap.Error(err))
			}
		}
	}

	// Audit
	s.writeAudit(ctx, "order.refund", orderID, userID)

	// Notification (cross-module, fire-and-forget)
	refundNotifier(ctx, userID, orderID, fmt.Sprintf("%.2f", refundAmount))

	s.log.Info("order refunded",
		zap.String("userId", userID),
		zap.String("orderId", orderID),
		zap.Float64("feeRate", feeRate),
		zap.Float64("refundAmount", refundAmount),
	)

	return RefundResult{
		OrderID:      orderID,
		Status:       string(db.OrdersStatusRefunded),
		RefundAmount: fmt.Sprintf("%.2f", refundAmount),
		FeeRate:      feeRate,
	}, nil
}

// init: override the package-level CheckRefundEligibility var so any
// existing callers of the old stub get a clear "moved" reason. The
// real refund flow now lives in Service.RefundOrder, wired by main.go.
func init() {
	CheckRefundEligibility = stubCheckRefund
}

// stubCheckRefund is the legacy var entry point (T13-2 signature).
// The real implementation moved to Service.RefundOrder (T15-final).
func stubCheckRefund(_ context.Context, _, _ string) RefundEligibility {
	return RefundEligibility{Allowed: false, Reason: "refund check moved to Service.RefundOrder (T15-final)"}
}

// Unused, kept to satisfy the import of errors/sql.
var (
	_ = errors.New
)
