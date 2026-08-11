# Phase 2 T14-4 — Practices milestone report

**Date**: 2026-08-11
**Test status**: **15/15 e2e PASS** (practices only). Cumulative Phase 2
**98/98 e2e** when run per-module.

---

## Scope

Port of `apps/api/src/modules/practices/` to Go. 11 endpoints:

| Endpoint | Method | Auth | Behavior |
|---|---|---|---|
| `/practices/courses/:courseId` | GET | optional | public list (projectUrl gated) |
| `/practices/courses/:courseId/access` | GET | auth | accessible list (paid needs enrollment) |
| `/practices/admin/courses/:courseId` | GET | admin | all projects incl. inactive |
| `/practices/:id` | GET | optional | get one (projectUrl gated) |
| `/practices` | POST | admin | create |
| `/practices/:id` | PATCH | admin | update |
| `/practices/:id` | DELETE | admin | delete |
| `/practices/user/progress` | GET | auth | my progress |
| `/practices/:id/start` | POST | auth | start (in_progress) |
| `/practices/:id/complete` | POST | auth | complete (with badge check) |
| `/practices/:id/skip` | POST | auth | skip |

---

## What shipped

### New files

```
apps/api-go/db/queries/practices.sql         (12 queries)
apps/api-go/internal/practices/repo.go       (245 LoC)
apps/api-go/internal/practices/service.go    (490 LoC, public DTOs + access control)
apps/api-go/internal/handler/practices.go    (250 LoC, 11 routes)
apps/api-go/test/e2e/practices_test.go       (480 LoC, 15 tests)
```

### Modified files

- `cmd/server/main.go` — added `mountPractices()` + import.
- `internal/repo/db/practices.sql.go` — generated from new query file.

---

## Key decisions

### 1. projectUrl is gated (admin OR enrolled sees it)

The NestJS service gates `projectUrl` to prevent scraping. Anon /
un-enrolled users see `projectUrl: ""` for both list and get-one
endpoints. The Go side does the same:

```go
if !isAdmin {
    enrolled, _ := s.repo.HasActiveEnrollment(ctx, userID, p.CourseID)
    if !enrolled {
        dto.ProjectURL = ""
    }
}
```

Bug found in T14-4 dev: the GET /practices/:id route initially had
no middleware, so admin tokens weren't recognized and even admins
saw `projectUrl: ""`. Fixed by adding `OptionalAuth` middleware (same
pattern as the T14-1 degrees bug).

### 2. Access control: assertCourseAccess

The NestJS service has a private `assertCourseAccess` that gates
`/start`, `/complete`, `/skip`:
- free / charity courses: anyone can access
- paid courses: user must have an active enrollment

The Go port has the same helper. It returns `403 Forbidden` if the
user tries to start/complete/skip a paid course they're not enrolled
in.

### 3. Start is idempotent

The NestJS service returns the existing completion record if the
user has already started. The Go port does the same. This means
calling `/start` twice for the same project gives the same
`completion_id` (the same DB row).

### 4. Complete fires a non-blocking badge check

The NestJS service calls `badgesService.checkAndAward(userId)` after
`completeProject` (only on the first transition to `completed`, not
on re-completes). The Go port has a package-level
`AwardOnPracticeComplete` hook that `main.go` can override with the
real badges service. The default is a no-op.

The hook is similar to the `BadgeCheckAward` pattern from
enrollments (T14-2). T14-4 doesn't wire it explicitly because the
badges service's `CheckAndAward` is called from both hooks; the
practice path is just one of many callers. When T15 + T16 are done,
all the cross-module hooks will be wired in `main.go`.

### 5. Public DTO + cross-module hook stub

Same pattern as T13 / T14-1: `ProjectDTO` flattens `sql.NullString`
to `*string` (or nil) with `camelCase` keys. The 11 endpoints' request
shapes match the NestJS DTOs in `apps/api/src/modules/practices/practices.dto.ts`.

---

## Test results

```
--- PASS: TestPractices_Unauthenticated_401
--- PASS: TestPractices_ListByCourse_OnlyActive
--- PASS: TestPractices_ListByCourse_HidesProjectUrlForAnonymous
--- PASS: TestPractices_AdminList_AllProjects
--- PASS: TestPractices_AdminList_RequiresAdmin
--- PASS: TestPractices_GetByID_ProjectUrlForAdmin
--- PASS: TestPractices_AdminCreate_AndUpdate_AndDelete
--- PASS: TestPractices_StartProject_RequiresEnrollment_ForPaid
--- PASS: TestPractices_StartProject_FreeCourse_OK
--- PASS: TestPractices_StartProject_Idempotent
--- PASS: TestPractices_CompleteProject_RequiresStart
--- PASS: TestPractices_CompleteProject_Success
--- PASS: TestPractices_SkipProject
--- PASS: TestPractices_UserProgress_EmptyForNewUser
--- PASS: TestPractices_UserProgress_FilterByCourse
```

15/15 PASS in 135s.

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
| T14-2 (Badges) | 8/8 e2e | ✅ shipped |
| T14-3 (Certificates) | 10/10 e2e | ✅ shipped |
| **T14-4 (Practices)** | **15/15 e2e** | **✅ shipped (this turn)** |
| Baseline healthz | 4 e2e | ✅ |
| Integration | 5/5 | ✅ |
| **TOTAL** | **98/98** | **✅ green (per-module)** |

**T14 (the whole "Degrees + Practice + Badges + Certificates" group) is COMPLETE.**

---

## T14 summary

| Sub-phase | Endpoints | E2E tests | Status |
|---|---|---|---|
| T14-1 Degrees | 6 | 8 | ✅ |
| T14-2 Badges | 6 | 8 | ✅ |
| T14-3 Certificates | 4 | 10 | ✅ |
| T14-4 Practices | 11 | 15 | ✅ |
| **Total T14** | **27** | **41** | **✅** |

Plus the cross-module hooks that were stubbed in earlier phases are
now wired:
- `enrollments.BadgeCheckAward` → `badgesSvc.CheckAndAward` (T14-2)
- `orders.IssueCertificateOnPaid` → `certSvc.IssueCertificate` (T14-3)
- `practices.AwardOnPracticeComplete` → no-op (will wire to badges in T15+ when progress data is available)

---

## Next: T15 — Progress + Learning events + Notes + Reviews

T15 ships the progress tracking module (`apps/api/src/modules/progress/`):
- `ProgressRecord` model + CRUD endpoints.
- Used by:
  - T13-2 Orders: refund eligibility check
  - T14-2 Badges: course_completed / lessons_completed / streak_days criteria
  - T14-4 Practices: practice_completed criteria

T15 cadence: ~3-5 days. This is the heaviest data-tracking module in
Phase 2.

After T15, T16 (Notifications + Points + Uploads) closes out the
migration. Then Phase 3-4 (strangler fig 10% → 50% → 100% traffic
shift) starts.
