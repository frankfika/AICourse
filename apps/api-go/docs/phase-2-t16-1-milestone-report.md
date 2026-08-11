# Phase 2 T16-1 — Notifications Module

**Date**: 2026-08-11
**Status**: ✅ Complete. 9/9 e2e tests green (7 core + 2 cross-module).
**Stack**: Go 1.23 / Fiber v2 / sqlc / dockertest.

## Scope

Migrated the NestJS `notification` module to Go: 6 endpoints that
expose the user's inbox (list / unread-count / mark-read / read-all /
delete / clear-read) plus the cross-module `CreateNotification` hook
that business events fire into.

### Endpoints delivered

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/notifications` | JWT | list newest-first + `unreadCount` |
| GET | `/api/v1/notifications/unread-count` | JWT | bell badge poll |
| POST | `/api/v1/notifications/:id/read` | JWT | idempotent |
| POST | `/api/v1/notifications/read-all` | JWT | bulk flip + `readAt` |
| DELETE | `/api/v1/notifications/:id` | JWT | soft-delete (`deleted_at`) |
| POST | `/api/v1/notifications/clear-read` | JWT | bulk soft-delete of read |

All endpoints map 1:1 to `apps/api/src/modules/notification/notification.controller.ts`.

### Cross-module wiring (the actual T16-1 deliverable)

`orders.NotifyOrderCreated` was a 4-arg no-op stub declared in T13-2.
`mountNotifications` in `cmd/server/main.go` now overrides it with:

```go
orders.NotifyOrderCreated = func(ctx context.Context, userID, orderID, amount string) {
    err := notifSvc.CreateNotification(ctx, notifications.CreateNotificationInput{
        UserID:  userID,
        Type:    "order",
        Title:   "订单已创建",
        Body:    "您的订单已创建，金额 ¥" + amount + "，请尽快完成支付。",
        LinkURL: "/orders/" + orderID,
    })
    if err != nil { log.Warn("...", zap.Error(err)) }
}
```

This is the third cross-module hook wired in the project
(`BadgeCheckAward` → `CheckAndAward` in T14-2, `IssueCertificateOnPaid`
→ `IssueCertificate` in T14-3, now `NotifyOrderCreated` →
`CreateNotification` in T16-1). The pattern: package-level var
stub, real impl set in `mountX` of the implementing module, both
modules mount at boot, the wiring is set before any request fires
the hook.

## Files written / modified

### New
- `internal/notifications/notifications.go` (~280 LoC) — repo + service + DTO
- `internal/handler/notifications.go` (~120 LoC) — Fiber handlers
- `test/e2e/notifications_test.go` (~410 LoC, 7 tests)
- `test/e2e/notifications_orders_integration_test.go` (~260 LoC, 2 tests)
- `db/queries/notifications.sql` — 7 sqlc queries

### Modified
- `cmd/server/main.go` — `mountNotifications` added (with hook wiring),
  `mountNotifications(v1, cfg, log)` call added in `main()`
- `internal/repo/db/notifications.sql.go` — sqlc-generated, 7 queries

## Tests

```
$ go test -timeout 5m -count=1 -run "TestNotif_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	61.069s
# 7 tests:
#   TestNotif_Unauthenticated_401
#   TestNotif_EmptyInbox
#   TestNotif_ListAndUnreadCount
#   TestNotif_MarkRead_OneAndAll
#   TestNotif_Delete_AndClearRead
#   TestNotif_DoesNotLeakOtherUsers
#   TestNotif_LinkUrlNullable

$ go test -timeout 5m -count=1 -run "TestNotifOrders_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	16.905s
# 2 tests:
#   TestNotifOrders_PaidOrder_FiresNotification  ← verifies cross-module hook
#   TestNotifOrders_FreeOrder_NoNotification     ← verifies free-path is silent
```

The cross-module integration test sets up an env with both `orders`
and `notifications` mounted, manually overrides `orders.NotifyOrderCreated`
(matching what `mountNotifications` does in main.go), creates a paid
order, and verifies the user got exactly 1 `type=order` notification
with the correct title, body (contains the amount), and linkUrl pointing
at the order.

The free-path test confirms that a `costType=free` order does NOT fire
the notification (the orders service short-circuits free courses to
auto-enrollment, never calling `NotifyOrderCreated`).

## Design decisions

1. **Single `type` field with hard-coded 4 values** (`announcement` /
   `comment` / `hackathon` / `order`) — matches NestJS enum. Service
   rejects unknown types with 400.

2. **`*string` for nullable fields with `omitempty`** — `linkUrl` and
   `readAt` are `*string` in the DTO, so they vanish from the JSON
   when not set. The `toNotificationDTO` converter guards on
   `sql.NullString.Valid` / `sql.NullTime.Valid`.

3. **No `unreadOnly` / `type` / `page` query params** in this iteration.
   The NestJS list endpoint takes these, but they're not in the
   swagger spec the v1 OpenAPI export uses, and the front-end currently
   always calls `GET /notifications` without filters. If a need
   surfaces, the sqlc query already filters by `user_id` + `deleted_at`,
   so adding more `WHERE` clauses is a one-query change.

4. **No soft-delete filter on `unread-count`** — bell badge should
   always reflect the user's true unread total, ignoring any
   `unreadOnly` / `type` filter. NestJS does the same.

5. **No email side effect** — NestJS's `sendEnterpriseInquiryNotification`
   was a 286-line cross-feature that doesn't belong here. Email
   integration is deferred to wherever Frank's email provider gets
   picked (P1-8 in the original plan). T16-1 only delivers the
   in-app inbox.

6. **No audit log** — NestJS's controller writes to `audit_logs` on
   every mark-read / mark-all / delete / clear-read. T16-1 skips
   this — the audit log is per-module and the migration plan doesn't
   have a unified cross-module audit. If Frank wants consistency,
   add a `notifSvc.writeAudit(...)` wrapper matching `orders.writeAudit`
   in T13-2.

## What's next

T16-2 (Points) is a 1-endpoint module (`GET /points/me` returns
user's points, level, recent ledger entries). 1 hour max.
T16-3 (Uploads, 2 endpoints, S3 presigned URL) needs design first —
S3 mock or real?

After T16, the Phase 2 module count is 24/38. Remaining 14 routes
are T8 (OAuth/SSO) and a few admin/experimental ones.
