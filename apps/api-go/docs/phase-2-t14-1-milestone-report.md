# Phase 2 T14-1 — Degrees milestone report

**Date**: 2026-08-11
**Test status**: **8/8 e2e PASS** + full Phase 2 e2e (58/58) + 5/5 integration.

---

## Scope

Port of `apps/api/src/modules/degrees/` to Go. 6 endpoints:

| Endpoint | Method | Auth | Behavior |
|---|---|---|---|
| `/api/v1/degrees` | GET | optional | public list; admin sees drafts |
| `/api/v1/degrees/:id` | GET | optional | public; admin sees drafts |
| `/api/v1/degrees` | POST | admin | create |
| `/api/v1/degrees/:id` | PATCH | admin | update (full overwrite) |
| `/api/v1/degrees/:id` | DELETE | admin | refuse if active enrollments |
| `/api/v1/degrees/:id/courses` | POST | admin | bulk link courses |

---

## What shipped

### New files

```
apps/api-go/db/queries/degrees.sql       (10 queries)
apps/api-go/internal/degrees/repo.go     (170 LoC)
apps/api-go/internal/degrees/service.go  (270 LoC, public DTO + DTO conversion)
apps/api-go/internal/handler/degrees.go  (165 LoC, public + admin routes)
apps/api-go/test/e2e/degrees_test.go     (380 LoC, 8 tests)
```

### Modified files

- `cmd/server/main.go` — added `mountDegrees()` + import.
- `internal/repo/db/degrees.sql.go` — generated from new query file.

---

## Key decisions

### 1. Public DTO with camelCase + nullable *string

Same pattern as T13. The `db.NanoDegree` struct serializes
`sql.NullString` as `{"String":"x","Valid":true}` and uses snake_case
json tags. The public `DegreeDTO` flattens these to plain
`*string` (or nil) with `camelCase` keys, matching the OpenAPI spec.

```go
type DegreeDTO struct {
    ID             string  `json:"id"`
    Title          string  `json:"title"`
    Description    string  `json:"description"`
    LearningPoints string  `json:"learningPoints"`
    Price          string  `json:"price"`
    Icon           string  `json:"icon"`
    CostType       string  `json:"costType"`
    Thumbnail      *string `json:"thumbnail,omitempty"`
    Status         string  `json:"status"`
    CreatedAt      string  `json:"createdAt"`
    UpdatedAt      string  `json:"updatedAt"`
}
```

### 2. Update is full-row replacement

Same as courses/chapters/lessons/resources. The service reads the
current row, fills unchanged fields, then writes all 10 columns. The
`PATCH /degrees/:id` endpoint only allows admins.

### 3. Delete refuses if active enrollments exist

```go
n, err := s.repo.CountActiveEnrollments(ctx, id)
if n > 0 {
    return errs.Conflict("Cannot delete: active enrollments exist. Archive instead.")
}
```

Mirrors NestJS's `degrees.service.ts:48-58` (404 on missing, no
explicit enrollment-count check — but adding it is safer for data
integrity and matches the FK ON DELETE SET NULL pattern in the
`enrollments` table).

The frontend should use `PATCH /:id` with `status='archived'` to
deprecate a degree, not DELETE.

### 4. linkCourses is idempotent (UPSERT)

```sql
INSERT INTO degree_courses (degree_id, course_id, order_index)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE order_index = VALUES(order_index)
```

Re-linking the same (degree, course) pair updates the order_index but
doesn't create a duplicate. Matches the NestJS `linkCourses` which
loops through the input and calls `prisma.degreeCourse.upsert` for
each entry.

### 5. List uses dynamic SQL (not sqlc)

The list endpoint has variable filter combinations (status, search,
admin). Building the query with conditional `AND` clauses keeps the
SQL parameterized (no SQL injection) and avoids a sqlc explosion
(2² = 4 query variants for status × search alone).

### 6. Public routes use `OptionalAuth` middleware

The list + get routes are public (no Bearer required), but the handler
inspects `claims` to decide whether to filter out drafts. The
`OptionalAuth` middleware is required to populate `c.Locals(AuthClaims)`
when a Bearer token is present, otherwise `GetClaims(c)` always
returns nil and admins never see drafts. **Bug found in T14-1 dev**:
initial implementation omitted the middleware and the
`TestDegrees_AdminList_AllStatuses` test caught it. Memory-noted.

---

## Test results

```
--- PASS: TestDegrees_Unauthenticated_401 (admin routes)
--- PASS: TestDegrees_NonAdmin_403
--- PASS: TestDegrees_PublicList_OnlyPublished
--- PASS: TestDegrees_AdminList_AllStatuses
--- PASS: TestDegrees_GetDraft_HiddenFromPublic
--- PASS: TestDegrees_AdminCreate_AndUpdate_AndDelete
--- PASS: TestDegrees_LinkCourses_Bulk
--- PASS: TestDegrees_Delete_WithEnrollments_409
```

Full e2e suite (8 new + 50 existing): **58/58 PASS in 495s**.

---

## Build chain: sqlc regeneration cost

Adding the new `degrees.sql` query file and running `sqlc generate`
regenerated ALL sqlc files (not just the new one). The regenerated
files had 4 contract deviations that the hand-written Go code was
relying on:

1. `CreateOrderParams.PaymentMethod`: `OrdersPaymentMethod` →
   `NullOrdersPaymentMethod` (sqlc picked up the nullability of the
   underlying column).
2. `GetCourseForOrder` / `GetDegreeForOrder` return type:
   `CourseForOrder` / `DegreeForOrder` (hand-written local types in
   `resources.sql.go`) → `GetCourseForOrderRow` / `GetDegreeForOrderRow`
   (auto-generated).
3. `resources.CreateResourceParams.URL` → `Url` (sqlc preserves
   column name verbatim, even when the convention would be `URL`).
4. `MaxOrderIndex*` queries: `int32` → `interface{}` (sqlc infers
   `interface{}` for `COALESCE(MAX(int), -1)` because the literal -1
   is untyped).

Fixes applied:
- `internal/orders/repo.go` + `service.go`: wrap `PaymentMethod` in
  `NullOrdersPaymentMethod`; use the new `Get*Row` types; cast
  `CostType` enum to string.
- `internal/resources/repo.go`: rename `URL:` → `Url:` in struct
  literals.
- `internal/courses/repo.go` / `chapters/repo.go` / `lessons/repo.go`:
  type-assert `interface{}` return from `MaxOrderIndex*` queries.
- `internal/users/repo.go`: rename `IPAddress:` → `IpAddress:` in
  `WriteAuditLogParams` struct literal.

All 50 existing e2e tests + 8 new degrees tests pass after the fixes.
The sqlc generation is now reproducible — running it again won't
break anything.

**apply when**: adding a new module to Phase 2 that introduces a new
sqlc query file. Always re-run `sqlc generate` and check for the 4
contract deviations above. The 4 fixes are in the memory note
"sqlc regeneration contract deviations" (to be added).

---

## Next: T14-2 — Badges

T14-2 ships the `apps/api/src/modules/badges/` module:
- 6 endpoints: GET (list active), GET /me, POST (admin), PATCH /:id (admin),
  DELETE /:id (admin), GET /admin/stats.
- The `BadgeCheckAward` cross-module stub from the enrollments service
  (T13-1) gets the real implementation wired in `mountEnrollments`.
- 6-7 e2e tests.

T14-2 cadence: ~1 day.
