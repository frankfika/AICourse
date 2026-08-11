# Phase 2 T12-3 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (Courses + Chapters + Lessons + Resources)
**Module**: `apps/api-go/internal/lessons` + `internal/handler/lessons.go`
**Status**: ✅ **DONE** — 5/5 lessons e2e green. Cascade to chapter delete verified.

---

## Scope

Migrate the NestJS lessons controller (5 endpoints) to Go.

### Endpoints delivered

| Method | Path                                              | NestJS file                              | Status |
|--------|---------------------------------------------------|------------------------------------------|--------|
| GET    | /api/v1/chapters/:chapterId/lessons               | lessons.controller.ts:45                 | ✅ |
| POST   | /api/v1/chapters/:chapterId/lessons               | lessons.controller.ts:59                 | ✅ |
| POST   | /api/v1/chapters/:chapterId/lessons/reorder       | lessons.controller.ts:137                | ✅ |
| PATCH  | /api/v1/lessons/:id                               | lessons.controller.ts:98                 | ✅ |
| DELETE | /api/v1/lessons/:id                               | lessons.controller.ts:118                | ✅ |

All admin-only.

---

## Cascade hook completion (T12-2 follow-up)

The T12-2 stub `chapters.LessonSoftDeleteByChapter` is now wired
to the real impl. When `chapters.Service.Delete` runs, it calls
`lessonsRepo.SoftDeleteByChapter` to cascade the soft-delete to all
lessons under the chapter.

**Mounting sequence in `cmd/server/main.go`**:

```go
mountLessons(v1, cfg, log) {
    ...
    lessonsRepo := lessons.NewRepo(conn)
    // Wire the chapters → lessons cascade hook.
    chapters.LessonSoftDeleteByChapter = func(ctx context.Context, _ *sql.DB, chapterID string) (int64, error) {
        return lessonsRepo.SoftDeleteByChapter(ctx, chapterID)
    }
    ...
}
```

The package-level var override is set at boot, after the lessons
repo is constructed. The chapters service holds a function pointer
(it doesn't need to know about the lessons package).

E2E coverage: `TestLessons_ChapterDelete_CascadesToLessons` creates
2 lessons under a chapter, deletes the chapter, asserts both
lessons are now `deleted_at != NULL`.

---

## What landed

### New code (~1,300 LoC)

```
internal/lessons/repo.go                 170 LoC
internal/lessons/service.go             270 LoC
internal/handler/lessons.go              200 LoC
test/e2e/lessons_test.go                 410 LoC   5 e2e tests
cmd/server/main.go                      +50 LoC   mountLessons() + cascade hook
db/queries/lessons.sql                  40 LoC
internal/repo/db/lessons.sql.go         170 LoC
```

### New sqlc queries (7)

```
lessons.sql:  ListLessonsByChapter, GetLessonByID, CreateLesson, UpdateLesson,
              SoftDeleteLesson, SoftDeleteLessonsByChapter, MaxLessonOrderIndex,
              LessonsByIDs
```

(8 in the file; ListByChapter + GetByID + Create + Update + SoftDelete +
SoftDeleteByChapter + MaxOrderIndex + LessonsByIDs are used by service paths.)

### Key decisions

- **Strangler Fig preserved**: 1:1 with NestJS.
- **videoUrl SafeUrl validated**: only `http://` / `https://` allowed,
  max 500 chars. Mirrors the NestJS `@SafeUrl` decorator. Rejects
  `javascript:`/`data:`/`file:` schemes — verified in
  `TestLessons_CreateAndList_AndAutoOrderIndex`.
- **Cascade hook via package var**: the chapters service holds a
  function pointer (`chapters.LessonSoftDeleteByChapter`) that the
  lessons module replaces at boot. Avoids an import cycle and keeps
  the chapters service decoupled from the lessons package.

---

## Test coverage (e2e)

5 new tests in `test/e2e/lessons_test.go`:

```
TestLessons_ListRequiresChapter                 ✅ 7.8s  empty list + 404 + 401
TestLessons_CreateAndList_AndAutoOrderIndex    ✅ 9.3s  3 lessons + bad URL 400
TestLessons_UpdateAndDelete                    ✅ 10.2s full CRUD
TestLessons_Reorder_AndOwnershipGuard          ✅ 7.4s  reorder + cross-chapter 403
TestLessons_ChapterDelete_CascadesToLessons    ✅ 7.8s  T12-2 stub now wired
```

---

## Files changed in this turn

```
NEW    apps/api-go/internal/lessons/repo.go
NEW    apps/api-go/internal/lessons/service.go
NEW    apps/api-go/internal/handler/lessons.go
NEW    apps/api-go/test/e2e/lessons_test.go
NEW    apps/api-go/docs/phase-2-t12-3-milestone-report.md
MOD    apps/api-go/cmd/server/main.go                   (mountLessons + cascade)
MOD    apps/api-go/db/queries/lessons.sql               (8 new queries)
MOD    apps/api-go/internal/repo/db/lessons.sql.go     (8 hand-written funcs)
```

---

## Next

**T12-4 (Resources)** — resources are attached to lessons. 5 endpoints:
- `GET    /lessons/:lessonId/resources` (list, admin)
- `POST   /lessons/:lessonId/resources` (create, admin)
- `PATCH  /resources/:id` (update, admin)
- `DELETE /resources/:id` (soft-delete, admin)
- `POST   /lessons/:lessonId/resources/reorder` (reorder, admin)

Resources have a `kind` enum + `url` (SafeUrl-validated) + `orderIndex`.
Same pattern as lessons/chapters.
