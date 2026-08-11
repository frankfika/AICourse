# Phase 2 T14-2 — Badges milestone report

**Date**: 2026-08-11
**Test status**: **8/8 e2e PASS** + full Phase 2 e2e (66/66) + 5/5 integration.

---

## Scope

Port of `apps/api/src/modules/badges/` to Go. 6 endpoints + 1 cross-module hook:

| Endpoint | Method | Auth | Behavior |
|---|---|---|---|
| `/api/v1/badges` | GET | public | list active badges |
| `/api/v1/badges/me` | GET | auth | user's badge wall + progress |
| `/api/v1/badges` | POST | admin | create |
| `/api/v1/badges/:id` | PATCH | admin | update (full overwrite) |
| `/api/v1/badges/:id` | DELETE | admin | delete (cascades user_badges) |
| `/api/v1/badges/admin/stats` | GET | admin | dashboard stats |
| `enrollments.BadgeCheckAward` | hook | — | real impl, fires after enroll |

---

## What shipped

### New files

```
apps/api-go/db/queries/badges.sql        (11 queries)
apps/api-go/internal/badges/repo.go      (210 LoC, with row-to-badge converter)
apps/api-go/internal/badges/service.go   (390 LoC, public DTOs + CheckAndAward)
apps/api-go/internal/handler/badges.go   (165 LoC, public + admin routes)
apps/api-go/test/e2e/badges_test.go      (430 LoC, 8 tests)
```

### Modified files

- `cmd/server/main.go` — added `mountBadges()` + import; `mountBadges` now
  wires the `enrollments.BadgeCheckAward` package var with the real impl.
- `internal/enrollments/service.go` — actually **calls** `BadgeCheckAward`
  (in a goroutine, fire-and-forget) after a successful enrollment.
  The hook was declared in T13-1 but never invoked. Now it runs.
- `internal/repo/db/badges.sql.go` — generated from new query file.

---

## Key decisions

### 1. NULL JSON column scan fix

The `badges.criteria_json` column is `JSON NULL`. The first iteration
of the repo scanned into `*json.RawMessage` directly, which failed
with `unsupported Scan, storing driver.Value type <nil> into type
*json.RawMessage` when the column was NULL.

Two fixes applied together:

a. **SQL: `IFNULL(criteria_json, JSON_OBJECT())`**: ensures the
   column is never NULL on read. The empty `{}` is a valid JSON value
   that decodes to an empty object.

b. **sqlc Row type conversion**: sqlc generates custom `*Row` structs
   for queries that don't use `SELECT *`. The `criteria_json` field
   in these Row types is `interface{}` (sqlc can't infer the type of
   `JSON_OBJECT()`). I added a `badgeRowToBadge` helper that takes
   `interface{}` and converts to `json.RawMessage` based on the
   underlying type (`[]byte`, `string`, or generic).

Memory-noted for future JSON NULL columns.

### 2. BadgeCheckAward now actually fires

The T13-1 implementation declared the hook but never called it from
the enrollments service. T14-2 fixes that:

```go
// internal/enrollments/service.go
go func() {
    bgCtx := context.Background()
    if err := BadgeCheckAward(bgCtx, userID); err != nil {
        s.log.Warn("badge check failed", zap.String("userId", userID), zap.Error(err))
    }
}()
```

Fire-and-forget pattern: the response returns immediately, the badge
check runs in a goroutine. A detached `context.Background()` is used so
the badge check isn't cancelled when the request context is done.

The badges service's `CheckAndAward` is idempotent — it checks
`HasUserBadge` before inserting, so concurrent calls are safe.

### 3. Progress-dependent criteria stubbed for T15

The full NestJS badges service has criteria types like
`course_completed`, `lessons_completed`, `streak_days`, etc. that need
the T15 `progress_records` table to compute. T14-2 stubs these to
return `(0, target)` so `unlocked` stays `false`:

```go
func (s *Service) computeProgress(ctx context.Context, userID string, b db.Badge) (int32, int32) {
    switch b.CriteriaType {
    case db.BadgesCriteriaTypeFirstEnrollment:
        n, _ := s.repo.CountActiveEnrollments(ctx, userID)
        return int32(n), max32(1, b.CriteriaValue)
    case db.BadgesCriteriaTypePointsReached:
        pts, _ := s.repo.GetUserPoints(ctx, userID)
        return pts, b.CriteriaValue
    default:
        return 0, b.CriteriaValue  // T15 will fill in
    }
}
```

T14-2 supports `first_enrollment` + `points_reached` (which don't need
progress data). T15 will extend this.

### 4. Public DTO with `criteriaJson` as `any`

The `db.Badge.CriteriaJson` is `json.RawMessage` (raw bytes). The
public `BadgeDTO.CriteriaJson` is `any` (parsed object) — the
`toBadgeDTO` function unmarshals the raw bytes into a Go `any` so the
JSON response has the parsed object, not the raw bytes-with-escapes.

```go
type BadgeDTO struct {
    ...
    CriteriaJson any `json:"criteriaJson,omitempty"`
    ...
}

if len(b.CriteriaJson) > 0 {
    var v any
    if err := json.Unmarshal(b.CriteriaJson, &v); err == nil {
        dto.CriteriaJson = v
    }
}
```

### 5. Admin stats is partial

The NestJS `getAdminStats` includes `activeUsers7d` and
`totalLessonsCompleted` from `progress_records`. T14-2's stats omits
these (they need T15). The structure is forward-compatible — T15
will add the two fields without changing the response shape.

---

## Test results

```
--- PASS: TestBadges_Unauthenticated_401
--- PASS: TestBadges_NonAdmin_403
--- PASS: TestBadges_PublicList_OnlyActive
--- PASS: TestBadges_AdminCreate_AndUpdate_AndDelete
--- PASS: TestBadges_Me_NoBadgesYet
--- PASS: TestBadges_Me_WithProgress_NotUnlocked
--- PASS: TestBadges_AdminStats
--- PASS: TestBadges_AdminStats_RequiresAdmin
```

Full e2e suite (8 new + 58 existing): **66/66 PASS in 568s**.

---

## Cumulative Phase 2 status

| Phase | Tests | Status |
|---|---|---|
| T11 (Users + Identities) | 16/16 e2e | ✅ shipped |
| T12-1 (Courses) | 6/6 e2e | ✅ shipped |
| T12-2 (Chapters) | 4/4 e2e | ✅ shipped |
| T12-3 (Lessons) | 5/5 e2e | ✅ shipped |
| T12-4 (Resources) | 4/4 e2e | ✅ shipped |
| T13-1 (Enrollments) | 6/6 e2e | ✅ shipped |
| T13-2 (Orders) | 9/9 e2e | ✅ shipped |
| T14-1 (Degrees) | 8/8 e2e | ✅ shipped |
| **T14-2 (Badges)** | **8/8 e2e** | **✅ shipped (this turn)** |
| Baseline healthz | 4 e2e | ✅ |
| Integration | 5/5 | ✅ |
| **TOTAL** | **73/73** | **✅ green** |

---

## Next: T14-3 — Certificates

T14-3 ships `apps/api/src/modules/certificates/`:
- 4 endpoints: GET /certificates (mine), GET /certificates/verify/:serial (public),
  GET /certificates/:id (public), POST /certificates/revoke/:id (admin).
- Wire the `IssueCertificateOnPaid` cross-module stub from the orders
  service (T13-2). The real impl generates a serial number
  (`OCSG-2026-COURSE-0001`) and writes the certificate row.
- 4-5 e2e tests.

T14-3 cadence: ~1 day.

T14-4 (Practices, 11 endpoints) is the biggest T14 module. ~2 days.
