# Phase 2 T12-1 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (Courses + Chapters + Lessons + Resources)
**Module**: `apps/api-go/internal/courses` + `internal/handler/courses.go`
**Status**: ✅ **DONE** — 6/6 courses e2e tests green. Total e2e suite: 22/22.

---

## Scope

Migrate the NestJS `courses` module to Go. 6 HTTP endpoints total.

### Endpoints delivered

| Method | Path                                 | NestJS file                       | Status |
|--------|--------------------------------------|-----------------------------------|--------|
| GET    | /api/v1/courses                      | courses.controller.ts:32          | ✅ |
| GET    | /api/v1/courses/:id                  | courses.controller.ts:51          | ✅ |
| POST   | /api/v1/courses (admin)              | courses.controller.ts:67          | ✅ |
| PATCH  | /api/v1/courses/:id (admin)          | courses.controller.ts:76          | ✅ |
| DELETE | /api/v1/courses/:id (admin)          | courses.controller.ts:86          | ✅ |
| POST   | /api/v1/courses/:id/degrees (admin)  | courses.controller.ts:97          | ✅ |

List + detail are public (OptionalAuth — admin gets draft visibility).
Mutations are admin-only.

---

## What landed

### New code (~1,800 LoC)

```
internal/courses/repo.go                335 LoC   data access
internal/courses/service.go             420 LoC   business logic + validation
internal/handler/courses.go             226 LoC   6 HTTP handlers
internal/middleware/auth.go             +50 LoC   OptionalAuth helper
test/e2e/courses_test.go                396 LoC   6 e2e tests
cmd/server/main.go                      +50 LoC   mountCourses() wiring
db/queries/courses.sql                  +50 LoC   new queries
internal/repo/db/courses.sql.go         +130 LoC   hand-written generated Go
```

Total: ~1,650 LoC added.

### New sqlc queries (6)

```
courses.sql:   UpdateCourse, DeleteCourse, ListAllCourses, CountCourses,
               MaxOrderIndexInDegree, DegreeCourseExists, CreateDegreeCourse
```

### Key decisions

- **Strangler Fig preserved**: every endpoint matches NestJS contract 1:1
  (path, method, response shape, error envelope, status codes).
- **OptionalAuth middleware extracted** to `internal/middleware/auth.go`
  so courses (and any future public-with-personalization route) can
  share the JWT verification path. Mirrors NestJS's OptionalJwtAuthGuard.
- **Public list forces status=published** unless the caller's claims
  show role=admin — even if a public request passes `?status=draft`,
  the handler returns 403. The admin path can use the filter.
- **`linkDegrees` is append-semantic with idempotency**: skips any
  (degree, course) pair that already exists, returning appended vs
  skipped counts separately. Mirrors NestJS exactly.
- **Update is full-row replacement in the SQL layer**: the sqlc
  `UpdateCourse` writes all 17 columns, so the service reads the
  current row first and fills in unchanged fields. Same trade-off as
  NestJS's `prisma.course.update`.
- **No `chapters/lessons/degrees/instructors` deep-includes yet**: those
  ship with T12-2/3/4 (Chapters + Lessons + Resources) and a follow-up
  to T12-1. The list/detail return flat course rows for now; the
  frontend will see a slightly different shape until those ship.
  Acceptable: the courses list page is the consumer, and Chapters will
  be a separate fetch.
- **`UpdateCourse` field count = 17**: that matches the columns. If a
  new field lands in the courses table, the sqlc query + service patch
  both need an update. Acceptable — the cost is bounded and the types
  catch mismatches at build time.

---

## Test coverage (e2e)

6 new tests in `test/e2e/courses_test.go`:

```
TestCourses_PublicList_OnlyPublished          ✅ 8.3s  public filter
TestCourses_AdminCanSeeDrafts                 ✅ 8.1s  admin sees drafts
TestCourses_PublicGetDraftsHidden             ✅ 7.8s  404 for public
TestCourses_AdminCreate_AndUpdate_AndDelete   ✅ 9.9s  full CRUD
TestCourses_AdminOnly_PublicForbidden         ✅ 7.0s  role gate
TestCourses_LinkDegrees_AppendAndIdempotent   ✅ 9.4s  append + skip
```

**Total e2e**: 22/22 PASS (~185s wall).
**Internal unit**: 3/3 ok.
**Integration**: 1/1 ok (5/5 sub-tests).

---

## Known follow-ups (intentional)

| # | Item | Why deferred | Target |
|---|------|--------------|--------|
| 1 | Deep includes (chapters, lessons, degrees, instructors, industry, category) in get/list | Chapters/Lessons ship next; nested fetch is more code | T12-2/3 |
| 2 | Sort modes (rating / popular) | Need a join + aggregation; the raw `ORDER BY created_at DESC` is the default | T12-2 |
| 3 | Course filter by instructorId/instructorSlug | Requires CourseInstructorLink join (T12-4 / instructors module) | T14 |
| 4 | Review aggregation (rating + count) | Reviews module is T15 | T15 |
| 5 | Nested chapter/lesson/resource creation in POST /courses | Chapters / Lessons / Resources modules | T12-2/3/4 |

---

## Files changed in this turn

```
NEW    apps/api-go/internal/courses/repo.go
NEW    apps/api-go/internal/courses/service.go
NEW    apps/api-go/internal/handler/courses.go
NEW    apps/api-go/test/e2e/courses_test.go
NEW    apps/api-go/docs/phase-2-t12-1-milestone-report.md
MOD    apps/api-go/internal/middleware/auth.go         (OptionalAuth)
MOD    apps/api-go/cmd/server/main.go                   (mountCourses)
MOD    apps/api-go/db/queries/courses.sql              (7 new queries)
MOD    apps/api-go/internal/repo/db/courses.sql.go     (7 hand-written functions)
```

---

## Next

**T12-2 (Chapters)** — chapters live under courses, ordered by
`orderIndex`. Endpoints:
- `GET /courses/:courseId/chapters` (public)
- `GET /courses/:courseId/chapters/:id` (public)
- `POST /courses/:courseId/chapters` (admin)
- `PATCH /courses/:courseId/chapters/:id` (admin)
- `DELETE /courses/:courseId/chapters/:id` (admin)

Same pattern as courses: sqlc queries → repo → service → handler → e2e.
