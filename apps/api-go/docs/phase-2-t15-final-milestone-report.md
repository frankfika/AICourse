# Phase 2 T15-final — Refund Flow

**Date**: 2026-08-11
**Status**: ✅ Complete. 11/11 e2e tests green.
**Stack**: Go 1.23 / Fiber v2 / sqlc / dockertest.

## Scope

Replaces the T13-2 placeholder `RefundOrder` with the real
implementation. The T13 stub returned `{allowed: true, deferred: true,
deferredNote: "refund execution ships with T15"}`; T15-final executes
the full refund flow end-to-end.

### Endpoints updated

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/orders/:id/refund` | now executes the real refund |

No new endpoints. The refund was always exposed via this route; T15-final
makes it actually work.

### Refund rules (1:1 with NestJS)

**Course order** (status must be `paid`):
- 0 completed lessons in the course → allowed, feeRate=0 (full refund)
- 1+ completed + paid < 7 days + progress < 20% → allowed, feeRate=0.05
- 1+ completed + paid >= 7 days → denied
- 1+ completed + paid < 7 days + progress >= 20% → denied

**Degree order** (status must be `paid`):
- 0 in_progress/completed in any degree-course → allowed, feeRate=0
- 1+ started → denied

### On approval — atomic flow

1. `orders.status = 'refunded'`
2. Soft-delete the order-sourced enrollment
3. For degree orders, also soft-delete the degree-sourced course enrollments
4. Write audit log (`action: "order.refund"`)
5. Fire "退款已完成" notification (cross-module via `orders.SetRefundNotifier`)

### Defensive checks

- Other user's order → 404 (not 403, prevents ID enumeration)
- Non-paid order → 400
- Non-existent order → 404
- Production env → 503 (refund is dev-mode only until real payment provider is wired)

## Files written / modified

### New
- `internal/orders/refund.go` (~280 LoC) — Service.RefundOrder +
  checkRefund + refundNotifier cross-module hook
- `test/e2e/orders_refund_test.go` (~440 LoC, 11 tests)
- `docs/phase-2-t15-final-milestone-report.md` (this file)

### Modified
- `cmd/server/main.go` — `wireRefundNotifier` function added (mounts
  notifications service + wires `orders.SetRefundNotifier`)
- `internal/errs/errs.go` — `Internal` log now appends `cause` field
  so 500s in server logs include the wrapped error
- `internal/orders/service.go` — old placeholder `RefundOrder` removed
  (now in `refund.go`)
- `db/queries/orders.sql` — added 8 sqlc queries for refund (count
  completed/total lessons, count started degree courses, count
  degree courses, 3 revoke-enrollments updateMany, getOrderForRefund)

## Tests

```
$ go test -timeout 5m -count=1 -run "TestRefund_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	94.187s

# Tests (11):
#   TestRefund_Unauthenticated_401
#   TestRefund_NonPaidOrder_400
#   TestRefund_NotFound_404
#   TestRefund_OtherUsersOrder_404                ← ID-enumeration defense
#   TestRefund_CourseOrder_NoProgress_FullRefund  ← 0 completed → full
#   TestRefund_CourseOrder_PartialProgress_5PercentFee  ← 10% < 20% + < 7d → 95% refund
#   TestRefund_CourseOrder_HighProgress_Denied    ← 40% >= 20% → denied
#   TestRefund_CourseOrder_Over7Days_Denied       ← 10d > 7d → denied
#   TestRefund_DegreeOrder_NoStartedCourses_Allowed  ← degree not started → full refund
#   TestRefund_DegreeOrder_StartedCourse_Denied   ← degree has in_progress → denied
#   TestRefund_FiresNotification                  ← cross-module hook fires
```

The cross-module notification test asserts via direct DB query that
exactly 1 `type=order` notification with the right title was created
after the refund. Per T11+ discipline: trust DB > API.

## Design decisions

1. **Refund logic lives in `Service.RefundOrder`, not the package-
   level var stub.** The old `CheckRefundEligibility` var was kept
   (now a "moved to Service.RefundOrder" sentinel) for back-compat
   with any caller holding a reference. The new `Service.RefundOrder`
   runs the full atomic flow in one place.

2. **Cross-module hook via `SetRefundNotifier` function pointer.**
   `internal/orders` doesn't import `internal/notifications` to
   avoid the cycle. The main.go wiring is identical in shape to
   `orders.NotifyOrderCreated` (set in `mountNotifications`).

3. **Soft-delete via updateMany, not per-row.**
   The 3 revoke-enrollments queries are `UPDATE ... WHERE
   source='order' AND deleted_at IS NULL`. They batch-revoke in
   one round-trip per scope (course, degree, degree-courses).

4. **RefundAmount formatted as `%.2f` string.**
   Mirrors NestJS's `refundAmount.toFixed(2)`. The `amount` column
   is a `DECIMAL(10,2)` string, so we parse to float64 for math
   and format back to 2-decimal-place string for the response.

5. **`errs.Internal` now logs `cause` field.** The 500 response
   body still hides the cause (matches NestJS filter), but the
   server log now includes the wrapped error. Saves 30 minutes
   of "Error 500 with no clue" debugging.

6. **`RefundCountStartedDegreeCourses` doesn't filter on
   `progress_records.deleted_at`**. The table has no `deleted_at`
   column. (See "Which Prisma tables have `deleted_at`" memory.)
   Bit me once in T16-3 too.

## What's next

After T15-final, the Phase 2 module count is 27/38. Remaining 11:
- **T8 (OAuth/SSO)**: 5 providers (WeChat Work, GitHub, Google,
  SAML, generic OIDC) — 2-3 sessions of work
- **Admin/experimental routes** (low priority):
  - chat (LLM conversation history)
  - ai (AI usage tracking)
  - hackathons (admin list/create, registration)
  - instructors (instructor profile pages)
  - site CMS (admin-controlled marketing pages)
  - enterprise (B2B inquiry form)
  - url-import (course import from external URL)

The admin/experimental set is mostly read-only admin views over
the existing tables — mechanical porting. T8 is the only
significant remaining work.

Frank's IR timeline drives T8 priority. If BP work is heating up,
T8 can wait a sprint.
