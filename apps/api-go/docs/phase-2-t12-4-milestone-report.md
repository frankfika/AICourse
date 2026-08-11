# Phase 2 T12-4 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (Courses + Chapters + Lessons + Resources)
**Module**: `apps/api-go/internal/resources` + `internal/handler/resources.go`
**Status**: ✅ **DONE** — 4/4 resources e2e green. **T12 (all 4 sub-modules) complete.**

---

## T12 (full) Summary

The Courses + Chapters + Lessons + Resources tree is now fully on the
Go side. NestJS is preserved 1:1.

| Sub-task | Endpoints | E2E tests | Modules shipped | Cascade hook |
|----------|-----------|-----------|-----------------|--------------|
| T12-1 Courses | 6 | 6 | `internal/courses` + handler | — |
| T12-2 Chapters | 5 | 4 | `internal/chapters` + handler | lessons (stub→real in T12-3) |
| T12-3 Lessons | 5 | 5 | `internal/lessons` + handler | resources (stub→real in T12-4) |
| T12-4 Resources | 4 | 4 | `internal/resources` + handler | — |
| **Total** | **20** | **19** | **4 new packages** | **2 cascade chains** |

Combined with T11 (16 e2e), the new e2e suite is **35 tests** covering
auth + users + identities + courses + chapters + lessons + resources.

---

## Resources scope (T12-4)

| Method | Path                                | NestJS file                              | Status |
|--------|-------------------------------------|------------------------------------------|--------|
| GET    | /api/v1/lessons/:lessonId/resources | resources.controller.ts:56               | ✅ |
| POST   | /api/v1/lessons/:lessonId/resources | resources.controller.ts:69               | ✅ |
| PATCH  | /api/v1/resources/:id               | resource-item.controller.ts:121          | ✅ |
| DELETE | /api/v1/resources/:id               | resource-item.controller.ts:147          | ✅ |

All admin-only. Resources have:
- `type` enum: `pdf` | `code` | `link` | `video` | `audio`
- `url` SafeUrl-validated (http/https only, max 1000 chars)
- `isLocked` defaults to true
- `title` required, max 191 chars

---

## Cascade chain complete

T12-2 stubbed `chapters.LessonSoftDeleteByChapter`. T12-3 wired it.
T12-3 stubbed `lessons.ResourceSoftDeleteByLesson`. T12-4 wired it.

```
chapter soft-delete
  → lessons.LessonSoftDeleteByChapter        (T12-2 stub → T12-3 real)
  → lesson soft-delete
  → lessons.ResourceSoftDeleteByLesson       (T12-3 stub → T12-4 real)
  → resource soft-delete
```

E2E coverage: `TestLessons_ChapterDelete_CascadesToLessons` (T12-3)
and `TestResources_LessonDelete_CascadesToResources` (T12-4) verify
the chain.

---

## What landed (T12-4 only)

### New code (~1,100 LoC)

```
internal/resources/repo.go                 130 LoC
internal/resources/service.go             180 LoC
internal/handler/resources.go             120 LoC
test/e2e/resources_test.go                 370 LoC   4 e2e tests
cmd/server/main.go                      +45 LoC   mountResources() + cascade
db/queries/resources.sql                  30 LoC
internal/repo/db/resources.sql.go        110 LoC
```

### New sqlc queries (6)

```
resources.sql: ListResourcesByLesson, GetResourceByID, CreateResource, UpdateResource,
               SoftDeleteResource, SoftDeleteResourcesByLesson, ResourcesByIDs
```

(7 in the file; one is for future reorder ownership checks.)

### Key decisions

- **Strangler Fig preserved** 1:1 with NestJS.
- **`type` enum validated server-side** — the AllowedTypes map
  mirrors NestJS's `ALLOWED_TYPES` constant. Rejects unknown values
  with 400 + a clear "must be one of: ..." message.
- **Cascade hook chain via package-level vars**: 3 packages use this
  pattern (chapters → lessons → resources). It avoids an import
  cycle and keeps each service decoupled from its downstream. The
  trade-off is a package-level `var` (global state) — but since the
  override is at boot only, it behaves as expected.

---

## Test coverage (e2e)

4 new tests in `test/e2e/resources_test.go`:

```
TestResources_ListRequiresLesson                  ✅ 9.2s  empty list + 404
TestResources_CreateAndList_AndBadType            ✅ 10.6s 5 sub-cases (type/url/title/missing/404)
TestResources_UpdateAndDelete                     ✅ 9.0s  full CRUD + bad type
TestResources_LessonDelete_CascadesToResources    ✅ 6.0s  T12-3 stub now wired
```

---

## Files changed in this turn

```
NEW    apps/api-go/internal/resources/repo.go
NEW    apps/api-go/internal/resources/service.go
NEW    apps/api-go/internal/handler/resources.go
NEW    apps/api-go/test/e2e/resources_test.go
NEW    apps/api-go/docs/phase-2-t12-4-milestone-report.md
MOD    apps/api-go/cmd/server/main.go                  (mountResources + cascade)
MOD    apps/api-go/internal/lessons/repo.go             (added ResourceSoftDeleteByLesson stub)
MOD    apps/api-go/internal/lessons/service.go          (Delete cascades to resources)
MOD    apps/api-go/db/queries/resources.sql            (7 new queries)
MOD    apps/api-go/internal/repo/db/resources.sql.go   (7 hand-written funcs)
```

---

## Phase 2 progress so far

| Task | Status | E2E tests | Notes |
|------|--------|-----------|-------|
| T8 (auth) | ✅ | 6 | Phase 1, completed earlier |
| T11 (users + identities) | ✅ | 16 | 2 pre-existing auth bugs fixed |
| T12-1 (courses) | ✅ | 6 | OptionalAuth middleware added |
| T12-2 (chapters) | ✅ | 4 | Fiber Group() middleware pitfall fixed |
| T12-3 (lessons) | ✅ | 5 | videoUrl SafeUrl + chapter cascade |
| T12-4 (resources) | ✅ | 4 | type enum + lesson cascade |
| **Subtotal** | — | **41** | |
| T13 (orders + payments + enrollments) | pending | — | Next |

---

## Next

**T13 (Orders + Payments (Stripe) + Enrollments)** — 3 sub-modules.

The Strangler Fig pattern is fully proven now. The remaining 4
phase-2 tasks (T13–T16) follow the same template: sqlc → repo →
service → handler → e2e. I expect to ship T13 in the same T11-T12
single-thread cadence.
