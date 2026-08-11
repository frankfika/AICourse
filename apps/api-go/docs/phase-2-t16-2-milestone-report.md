# Phase 2 T16-2 — Points Module

**Date**: 2026-08-11
**Status**: ✅ Complete. 7/7 e2e tests green.
**Stack**: Go 1.23 / Fiber v2 / sqlc / dockertest.

## Scope

Single endpoint: `GET /api/v1/points/me`. Returns the user's
points, level, level-progress, and the 10 most recent non-deleted
point transactions.

Mirrors `apps/api/src/modules/points/points.controller.ts:11-17` 1:1.

## Response shape (matches NestJS exactly)

```json
{
  "points": 350,
  "level": 2,
  "currentLevelPoints": 100,
  "nextLevelPoints": 400,
  "pointsToNextLevel": 50,
  "recentTransactions": [
    {
      "id": "...",
      "userId": "...",
      "amount": 30,
      "reason": "完成课时",
      "refType": "lesson",
      "refId": "lesson-123",
      "createdAt": "2026-08-11T06:15:36.000Z"
    }
  ]
}
```

### Level curve (math copied from NestJS)

```go
calculateLevel(p) = floor(sqrt(p/100)) + 1
levelThreshold(L) = max(0, (L-1)^2 * 100)
```

| points range | level | current | next |
|---|---|---|---|
| 0–99 | 1 | 0 | 100 |
| 100–399 | 2 | 100 | 400 |
| 400–899 | 3 | 400 | 900 |
| 900–1599 | 4 | 900 | 1600 |
| 1600–2499 | 5 | 1600 | 2500 |

Verified across 6 test cases (0, 50, 100, 399, 400, 1600).

## Files written / modified

### New
- `internal/points/points.go` (~180 LoC) — repo + service + DTO + level math
- `internal/handler/points.go` (~45 LoC) — single endpoint
- `test/e2e/points_test.go` (~390 LoC, 7 tests)
- `db/queries/points.sql` — 2 sqlc queries

### Modified
- `cmd/server/main.go` — `mountPoints` added, import added, call site added
- `internal/repo/db/points.sql.go` — sqlc-generated, 2 queries

## Tests

```
$ go test -timeout 5m -count=1 -run "TestPoints_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	62.794s

# Tests:
#   TestPoints_Unauthenticated_401
#   TestPoints_FreshUser_ZeroLevelOne
#   TestPoints_LevelCurve                        ← 6 sub-cases across 5 levels
#   TestPoints_RecentTransactions_NewestFirst
#   TestPoints_SoftDeletedTransaction_Excluded
#   TestPoints_TransactionWithRefType
#   TestPoints_OnlyReturns10Recent
```

The 6-case level curve test is the most important — it locks down
the math against the NestJS reference implementation. If anyone
tweaks the formula in the future, this test fires immediately.

## Design decisions

1. **`RefType *string` with `omitempty`** — `refType` is an optional
   enum in the Prisma schema (`PointRefType?`), so the DTO uses
   `*string`. When a transaction has no `refType` (e.g. bonus points
   unrelated to any entity), the field is omitted from JSON.

2. **Empty list, not null** — `RecentTransactions` is always an
   array, never null. Matches NestJS's default and avoids frontend
   `.length` crashes on brand-new users.

3. **No cross-module hook wired** — T16-2 only delivers the public
   read API. The `award(...)` method is internal and exposed via
   the service, but no `practices.AwardOnPracticeComplete` or
   `progress.AwardOnLessonComplete` is currently pointing at it.
   When that wiring gets done, it'll follow the same pattern as
   `orders.NotifyOrderCreated`: package-level var in
   `internal/points/points.go`, override in `mountPoints` (or in
   the caller's mount if the points service is the callee).

4. **No `award` HTTP endpoint** — the NestJS module also has a
   service-level `award(...)` method but no HTTP endpoint that
   triggers it. The award flow is server-side only (called from
   practices, badges, etc.). We keep parity — no new HTTP route.

5. **No email side effect** — none in NestJS either.

## What's next

T16-3 (Uploads) needs design first. The NestJS module has:
- `POST /uploads/sign` — presigned S3 URL for direct browser upload
- `POST /uploads/complete` — callback to mark the upload done
- 286 lines of S3 / multipart logic

For the Go port, options:
- (A) Mock S3 with a local file storage backend (simplest, lets e2e
  tests pass without a real S3)
- (B) Use MinIO container in dockertest (most realistic, ~1 hour
  to wire)
- (C) Use AWS SDK with real S3 in test mode (requires Frank's
  AWS credentials)

I'd default to (A) for the migration and let production swap to
real S3 later — same pattern as the JWT issuer (HS256 test, RS256
prod). The uploads module is admin-only and not in the 38 controller
list — let me check the OpenAPI spec for the actual route count.

After T16-3, the Phase 2 module count is 25/38. Remaining 13
routes: T8 (OAuth/SSO) + 1-2 admin/experimental ones.
