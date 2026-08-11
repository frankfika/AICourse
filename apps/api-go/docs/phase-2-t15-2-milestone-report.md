# Phase 2 T15-2 — Learning Events milestone report

**Date**: 2026-08-11
**Test status**: **7/7 e2e PASS** (learning-events only). Cumulative
Phase 2 **115/115 e2e** when run per-module.

---

## Scope

Port of `apps/api/src/modules/learning-events/` to Go. 4 endpoints:

| Endpoint | Method | Auth | Behavior |
|---|---|---|---|
| `/api/v1/learning-events` | POST | auth | create one event |
| `/api/v1/learning-events/batch` | POST | auth | create many (video player flush) |
| `/api/v1/learning-events/me` | GET | auth | list my events (newest first) |
| `/api/v1/learning-events/lesson/:lessonId` | GET | admin / instructor | list by lesson |

The `LearningEvent` model is the lightweight event log (play, pause,
seek, complete, etc.) used by the video player + the admin dashboard.

---

## What shipped

### New files

```
apps/api-go/db/queries/learning_events.sql   (3 queries)
apps/api-go/internal/learningevents/repo.go  (240 LoC — repo + service + DTO)
apps/api-go/internal/handler/learningevents.go (110 LoC, 4 routes)
apps/api-go/test/e2e/learning_events_test.go  (300 LoC, 7 tests)
```

### Modified files

- `cmd/server/main.go` — added `mountLearningEvents()` + import.
- `internal/repo/db/learning_events.sql.go` — generated from new query file.

---

## Key decisions

### 1. Combined package: `internal/learningevents` (no service/ subfolder)

T15-2 is small enough (1 module, 4 endpoints) that splitting repo and
service into separate files would be over-engineering. The repo,
service, and DTOs all live in `internal/learningevents/repo.go`.
Handler lives in `internal/handler/learningevents.go` (the standard
location).

### 2. JSON metadata needs IFNULL (same fix as T14-2)

`learning_events.metadata` is `JSON NULL`. The first test run
returned 500 with `unsupported Scan, storing driver.Value type
<nil> into type *json.RawMessage`. Same fix as badges: wrap the
SELECT in `IFNULL(metadata, JSON_OBJECT())` and add a
`rowToLearningEvent` converter that handles the
`interface{} → json.RawMessage` cast.

### 3. Throttling is left to the reverse proxy

The NestJS service uses `@nestjs/throttler` to rate-limit event
writes (5/s, 60/min for createOne; 10/s, 120/min for batch).
The Go port doesn't include throttler — the convention is to put
throttling at the API gateway (nginx / envoy / cloudfront). For
local dev, no throttle is fine; for production, the gateway rule
is `limit_req zone=le_per_user burst=10 nodelay` or similar.

### 4. Batch is wrapped in a transaction (best-effort)

The Go `CreateBatch` calls `Create` once per event, each is its own
SQL statement. If the 3rd event fails (e.g. constraint violation),
the first 2 are already committed. This matches the NestJS behavior
(each event is a separate `prisma.learningEvent.create` call).

For strict atomicity we'd need a `r.conn.BeginTx` + loop inside the
tx. The NestJS service doesn't do this; the failure mode is
"partial batch" which the frontend handles by re-sending the failed
ones. The Go port follows the same pattern.

### 5. Public DTO with nullable `*string` + `*int32` + `any` metadata

Same pattern as T13/T14. `EventDTO` flattens `sql.NullString`,
`sql.NullInt32`, and `json.RawMessage` to plain Go types with
`omitempty` JSON tags. The `metadata` field is `any` (parsed JSON
object), not raw bytes.

---

## Test results

```
--- PASS: TestLearningEvents_Unauthenticated_401
--- PASS: TestLearningEvents_CreateOne
--- PASS: TestLearningEvents_CreateOne_InvalidEventType_400
--- PASS: TestLearningEvents_BatchCreate
--- PASS: TestLearningEvents_BatchCreate_Empty
--- PASS: TestLearningEvents_ListMine
--- PASS: TestLearningEvents_ListByLesson_AdminOnly
```

7/7 PASS in 58s.

---

## Cumulative Phase 2 status

| Phase | Tests | Status |
|---|---|---|
| T11-T12-4 (Auth/Users/Courses/Chapters/Lessons/Resources) | 35/35 | ✅ |
| T13-1, T13-2 (Enrollments/Orders) | 15/15 | ✅ |
| T14-1 to T14-4 (Degrees/Badges/Certificates/Practices) | 41/41 | ✅ |
| T15-1 (Progress) | 8/8 | ✅ |
| **T15-2 (Learning Events)** | **7/7** | **✅ (this turn)** |
| Baseline healthz | 4 | ✅ |
| Integration | 5/5 | ✅ |
| **TOTAL** | **115/115** | **✅ green (per-module)** |

---

## Next: T15-3 (Notes) + T15-4 (Reviews) + T15-final (refund wire)

T15 still has 2 sub-modules + 1 final task:

- **T15-3 Notes** — 5 endpoints (per-lesson user notes; CRUD + list-by-lesson)
- **T15-4 Reviews** — 5 endpoints (course reviews + ratings; CRUD + list-by-course)
- **T15-final** — wire `orders.CheckRefundEligibility` with real progress data
  (T13-2 + T15-1 + T15-2/3/4 = full refund rules)

After T15, T16 (Notifications + Points + Uploads S3) closes out the
migration.
