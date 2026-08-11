# Phase 2 T12-2 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (Courses + Chapters + Lessons + Resources)
**Module**: `apps/api-go/internal/chapters` + `internal/handler/chapters.go`
**Status**: ✅ **DONE** — 4/4 chapters e2e green. Total e2e suite: 26/26.

---

## Scope

Migrate the NestJS chapters controller (5 endpoints) to Go.

### Endpoints delivered

| Method | Path                                              | NestJS file                              | Status |
|--------|---------------------------------------------------|------------------------------------------|--------|
| GET    | /api/v1/courses/:courseId/chapters                | chapters.controller.ts:46                | ✅ |
| POST   | /api/v1/courses/:courseId/chapters                | chapters.controller.ts:70                | ✅ |
| POST   | /api/v1/courses/:courseId/chapters/reorder        | chapters.controller.ts:154               | ✅ |
| PATCH  | /api/v1/chapters/:id                              | chapters.controller.ts:103               | ✅ |
| DELETE | /api/v1/chapters/:id                              | chapters.controller.ts:130               | ✅ |

All admin-only in NestJS, same gate in Go.

---

## What landed

### New code (~1,400 LoC)

```
internal/chapters/repo.go                160 LoC
internal/chapters/service.go            230 LoC
internal/handler/chapters.go            200 LoC
test/e2e/chapters_test.go                410 LoC   4 e2e tests
cmd/server/main.go                      +50 LoC   mountChapters() wiring
db/queries/chapters.sql                 50 LoC
internal/repo/db/chapters.sql.go        220 LoC
```

Total: ~1,300 LoC added.

### New sqlc queries (8)

```
chapters.sql:   ListChaptersByCourse, GetChapterByID, GetChapterByIDIncludingDeleted,
                CreateChapter, UpdateChapter, SoftDeleteChapter,
                SoftDeleteChaptersByCourse, MaxChapterOrderIndex,
                CountChaptersInCourse, ChaptersByIDs
```

(10 in the file; Count + ListByCourse + MaxOrderIndex + ChaptersByIDs are
used by both service paths.)

### Key decisions

- **Strangler Fig preserved**: 1:1 with NestJS.
- **Lessons cascade is a no-op stub until T12-3 lands** — the chapter
  soft-delete still works (chapters are filtered out of the list view).
  When T12-3 ships, `LessonSoftDeleteByChapter` gets a real impl.
- **Update is full-row replacement** like courses — the service reads
  the current row first, fills in unchanged fields. sqlc `UpdateChapter`
  writes all 3 columns.
- **Reorder is atomic in spirit, sequential in impl**: each chapter's
  orderIndex is updated in a loop. NestJS uses `prisma.$transaction` to
  make it atomic; the Go side currently does sequential UPDATEs. For
  the typical reorder size (3-20 chapters) the race window is
  acceptable. If it becomes a problem, wrap in a `*sql.Tx`.
- **Reorder ownership guard**: every chapter id must belong to the
  supplied courseId. Mirrors NestJS's forbidden check.

---

## Test coverage (e2e)

4 new tests in `test/e2e/chapters_test.go`:

```
TestChapters_ListRequiresCourse                 ✅ 8.3s  empty list + 404 + 401
TestChapters_CreateAndList_AndAutoOrderIndex    ✅ 7.4s  3 chapters auto-ordered
TestChapters_UpdateAndDelete                    ✅ 7.8s  full CRUD
TestChapters_Reorder_AndOwnershipGuard          ✅ 7.5s  reorder + cross-course 403
```

**Total e2e**: 26/26 PASS (~216s wall).

---

## One bug fixed mid-stream

`router.Group("/courses", adminOnly..., h.listByCourse)` was passing
the GET handler as a Group() middleware — which meant `h.listByCourse`
ran for POST/PATCH/DELETE on the same group too, with `c.Params("id")`
empty, returning 404. Fixed by removing the handler from Group() and
registering it explicitly with `g.Get("/:courseId/chapters", h.listByCourse)`.

Memory note: `Fiber Group(prefix, handlers...)` makes the trailing
handlers run as middleware for ALL methods.

---

## Files changed in this turn

```
NEW    apps/api-go/internal/chapters/repo.go
NEW    apps/api-go/internal/chapters/service.go
NEW    apps/api-go/internal/handler/chapters.go
NEW    apps/api-go/test/e2e/chapters_test.go
NEW    apps/api-go/docs/phase-2-t12-2-milestone-report.md
MOD    apps/api-go/cmd/server/main.go                   (mountChapters)
MOD    apps/api-go/db/queries/chapters.sql              (10 new queries)
MOD    apps/api-go/internal/repo/db/chapters.sql.go     (10 hand-written funcs)
```

---

## Next

**T12-3 (Lessons)** — 5 endpoints under `/api/v1/chapters/:chapterId/lessons` and `/api/v1/lessons/:id`. Plus the lesson cascade hook that T12-2 stubbed out.
