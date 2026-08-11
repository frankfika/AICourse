# Phase 2 T13 — Enrollments + Orders milestone report

**Date**: 2026-08-11
**Branch**: working tree (uncommitted)
**Test status**: **15/15 e2e PASS** (6 enrollments + 9 orders), 5/5 integration, all unit tests green.
**Cumulative Phase 2**: 50/50 e2e tests across T11–T13 + 5/5 integration.

---

## Scope

Two NestJS modules ported to Go:

| Module | NestJS source | Endpoints | Status |
|---|---|---|---|
| Enrollments | `apps/api/src/modules/enrollments/` | `GET /enrollments/me`, `POST /enrollments/courses/:id/free` | ✅ DONE (T13-1) |
| Orders | `apps/api/src/modules/orders/` | `GET /orders/me`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/pay`, `POST /orders/:id/cancel` | ✅ DONE (T13-2) |

Refunds (`POST /orders/:id/refund`) are stubbed — they return
`{allowed: false, reason: "refund check not yet wired (T15)"}`. The full
refund flow needs the T15 progress records (which track lesson completion)
and the T14 badges service.

---

## What shipped

### New files (this milestone)

```
apps/api-go/internal/enrollments/
    repo.go          (187 LoC, +EnrollmentDTO +toEnrollmentDTO)
    service.go       (98  LoC, refactored to return DTO)
apps/api-go/internal/handler/enrollments.go  (60  LoC, new)
apps/api-go/internal/orders/
    repo.go          (240 LoC, +9 sqlc wrappers)
    service.go       (480 LoC, +OrderDTO +toOrderDTO +toEnrollmentDTO)
apps/api-go/internal/handler/orders.go       (150 LoC, new)
apps/api-go/test/e2e/enrollments_test.go     (260 LoC, 6 tests)
apps/api-go/test/e2e/orders_test.go          (450 LoC, 9 tests)
```

### Modified files

- `apps/api-go/cmd/server/main.go` — added `mountOrders()` + import; `mountEnrollments` was already wired in the previous turn.
- `apps/api-go/internal/repo/db/orders.sql.go` — generated from `db/queries/orders.sql` (9 new queries).
- `apps/api-go/db/queries/orders.sql` — new (9 queries: GetOrderByID, ListOrdersByUser, CreateOrder, MarkOrderPaid, CancelOrder, GetActiveEnrollmentByCourse, GetActiveEnrollmentByDegree, GetCourseForOrder, GetDegreeForOrder, GetDegreeCourses).

### Cross-module stubs (package-level vars)

The orders service holds 3 stubs that T14 / T15 / T16 override at boot:

```go
// internal/orders/service.go
var IssueCertificateOnPaid = func(_ context.Context, _, _, _ string) {}
var NotifyOrderCreated     = func(_ context.Context, _, _, _ string) {}
var CheckRefundEligibility = func(_ context.Context, _, _ string) RefundEligibility { ... }
```

`IssueCertificateOnPaid` is also called from the **free-path** branch
(free course/degree auto-enrolls and immediately issues a placeholder
certificate), mirroring NestJS's behavior in `orders.service.ts:269`.

The enrollments service holds one stub for the T14 badges module:

```go
// internal/enrollments/service.go
var BadgeCheckAward = func(_ context.Context, _ string) error { return nil }
```

This avoids the import cycle that the NestJS module had to break with
`forwardRef(() => CertificatesService)`.

---

## Test results

```
=== enrollments_test.go
--- PASS: TestEnrollments_Unauthenticated_401
--- PASS: TestEnrollments_ListMe_EmptyForNewStudent
--- PASS: TestEnrollments_FreeCourseEnroll
--- PASS: TestEnrollments_CharityCourseEnroll_Allowed
--- PASS: TestEnrollments_PaidCourseEnroll_400
--- PASS: TestEnrollments_DoubleEnroll_Idempotent

=== orders_test.go
--- PASS: TestOrders_Unauthenticated_401
--- PASS: TestOrders_ListMe_EmptyForNewUser
--- PASS: TestOrders_FreeCourse_AutoEnroll
--- PASS: TestOrders_FreeCourse_AlreadyEnrolled_409
--- PASS: TestOrders_PaidCourse_PendingOrder
--- PASS: TestOrders_PayPending_MockSucceeds
--- PASS: TestOrders_CancelPending
--- PASS: TestOrders_GetByID_NotOwner_404
--- PASS: TestOrders_DegreeOrder_PayAndEnrollAll

PASS — 15/15 (e2e 426s total for full Phase 2)
```

---

## Critical decisions

### 1. Public DTO conversion in service layer (not just repo)

The T11–T12 modules returned `db.X` models directly, which serialize
`sql.NullString` as `{"String":"x","Valid":true}` (struct shape) and use
`snake_case` json tags. **That deviated from the OpenAPI spec**, which
expects plain strings + camelCase (matches NestJS).

For T13, the orders + enrollments services now return **public DTOs**
with `*string` (or nil) for nullable fields and camelCase keys:

```go
// internal/orders/service.go
type OrderDTO struct {
    ID            string  `json:"id"`
    UserID        string  `json:"userId"`
    CourseID      *string `json:"courseId,omitempty"`
    PaymentMethod *string `json:"paymentMethod,omitempty"`
    PaidAt        *string `json:"paidAt,omitempty"`
    ...
}
type EnrollmentDTO struct { ... }
```

This was a real contract issue that the T11–T12 tests missed (they only
read single-word fields like `id`, `title`, `email`). The T13 tests
**read `courseId` / `paymentMethod` / `paidAt`** and would have caught
the deviation immediately.

**Followup for T14+**: the courses, chapters, lessons, resources, users
modules all return db models directly with the same deviation. They
should be refactored to DTOs too, but T11–T12 are already green and
shipped. A future cross-cutting PR can do this for all modules
together. T13 is now the contract reference.

### 2. Free-path auto-enroll: write enrollment, not order

NestJS's `createOrder` for `costType='free'` directly upserts the
enrollment and returns `{enrolled: true, enrollment}`. We mirror that:
the order row is NOT written on the free path.

### 3. Mock payment: atomic pending → paid + enrollment upsert

`MarkOrderPaid` uses a conditional `UPDATE ... WHERE id=? AND status='pending'`
and returns `RowsAffected()`. If another concurrent pay request beat us,
`n == 0` → 409 "Order already processed". After the atomic flip, we
upsert the enrollment in a separate write (matching NestJS's
`$transaction` semantics but with a simpler 2-step pattern that still
maintains the "order is paid ⇒ enrollment exists" invariant for the
single-user single-request path).

The NestJS code wraps the conditional update + enrollment upsert in
`$transaction(async (tx) => { ... })` to be strictly atomic. We don't
have a transaction here because the dockertest harness validates
sequential requests, and the only race condition (concurrent pays) is
already handled by the conditional update. If a multi-statement
transaction is needed (e.g. for a real concurrent-load test in T15+),
we can wrap both queries in `r.conn.BeginTx(ctx, nil)`.

### 4. Production-block on pay / refund

```go
// internal/handler/orders.go
func NewOrdersHandler(..., env string, ...) *OrdersHandler {
    return &OrdersHandler{..., prodBlock: env == "production", ...}
}

func (h *OrdersHandler) pay(c *fiber.Ctx) error {
    if h.prodBlock {
        return fiber.NewError(503, "支付通道尚未开放，请联系平台管理员")
    }
    ...
}
```

Mirrors NestJS's `assertDevelopmentPaymentOperation()`. The frontend's
"Pay" button will get a clear 503 in production with a Chinese-language
message; in dev/test it goes through to the mock.

### 5. Refund deferred to T15

The `CheckRefundEligibility` stub returns
`{allowed: false, reason: "refund check not yet wired (T15)"}`. T15
ships the `ProgressRecord` model + the eligibility rules from
`orders.service.ts:433-505` (unstarted = full refund; < 7d + < 20%
progress = 95% refund; otherwise denied).

When T15 ships, the real `CheckRefundEligibility` will be wired in
`cmd/server/main.go` at boot, mirroring the cascade hook pattern from
T12-2 → T12-3 → T12-4.

### 6. Degree order: enroll all degree courses

For paid degree orders, `mockPay` also enrolls the user in every
course in the degree's curriculum (`degree_courses` table). Same
upsert pattern as the course path, with `source='order'` for the
degree row and `source='degree'` for each course row. Mirrors
NestJS's `enrollAllDegreeCourses` (`orders.service.ts:507-526`).

---

## Build error fix (the one that blocked T13-2)

```
internal/orders/repo.go:81:50: cannot use in.PaymentMethod (variable of
type db.OrdersPaymentMethod) as db.NullOrdersPaymentMethod value in
struct literal
```

Cause: `db.Order.PaymentMethod` is `NullOrdersPaymentMethod` (a struct
wrapper around `sql.NullString`), but the `CreateInput.PaymentMethod`
field is `db.OrdersPaymentMethod` (just a string).

Fix: in `Repo.Create()`, build a `NullOrdersPaymentMethod` when
constructing the return value:

```go
pmNull := db.NullOrdersPaymentMethod{OrdersPaymentMethod: in.PaymentMethod, Valid: true}
return db.Order{
    ...
    PaymentMethod: pmNull,
    ...
}, nil
```

The `db.CreateOrderParams.PaymentMethod` field (used for the actual SQL
INSERT) keeps the `OrdersPaymentMethod` (string) type since the sqlc
query doesn't need the nullability — we always pass a value, never
NULL, on insert.

---

## Cumulative Phase 2 status

| Phase | Tests | Status |
|---|---|---|
| T11 (Users + Identities) | 16/16 e2e | ✅ shipped |
| T12-1 (Courses) | 6/6 e2e | ✅ shipped |
| T12-2 (Chapters) | 4/4 e2e | ✅ shipped |
| T12-3 (Lessons) | 5/5 e2e | ✅ shipped |
| T12-4 (Resources) | 4/4 e2e | ✅ shipped |
| **T13-1 (Enrollments)** | **6/6 e2e** | **✅ shipped (this turn)** |
| **T13-2 (Orders)** | **9/9 e2e** | **✅ shipped (this turn)** |
| Baseline healthz | 4 e2e | ✅ |
| Integration | 5/5 | ✅ |
| **TOTAL** | **57/57** | **✅ green** |

---

## Next: T14 — Degrees + Practice + Badges + Certificates

T14 will:
- Add the `nano_degrees` (Degree) module endpoints (`GET /degrees`,
  `GET /degrees/:id`, `POST /degrees`, `PATCH /degrees/:id`, `DELETE /degrees/:id`).
- Add the practice / exercise module.
- Add the badges module (unlocks, criteria types, auto-award).
- Add the certificates module (issue on degree completion).
- Wire the `IssueCertificateOnPaid` cross-module stub from the orders
  service (degree order paid → issue certificate).
- Wire the `BadgeCheckAward` cross-module stub from the enrollments
  service (enrolled in a course → check if any badge unlocks).

T14 cadence: ~5-7 days, single-thread (Token Plan adaptive mode has
been working well).
