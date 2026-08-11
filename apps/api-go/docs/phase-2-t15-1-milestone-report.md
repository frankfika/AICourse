# Phase 2 T15-1 — Progress milestone report

**Date**: 2026-08-11
**Test status**: **8/8 e2e PASS** (progress only). Cumulative Phase 2
**106/106 e2e** when run per-module.

---

## Scope

Port of `apps/api/src/modules/progress/` to Go. 4 endpoints:

| Endpoint | Method | Auth | Behavior |
|---|---|---|---|
| `/api/v1/progress/me` | GET | auth | all my progress records |
| `/api/v1/progress/me/stats` | GET | auth | learning stats (dashboard) |
| `/api/v1/progress/courses/:courseId` | GET | auth | progress for one course |
| `/api/v1/progress/lessons/:lessonId/complete` | POST | auth | mark lesson done |

The `ProgressRecord` model is a per-(user, lesson) record. Completed
lessons are the primary write path.

---

## What shipped

### New files

```
apps/api-go/db/queries/progress.sql        (8 queries)
apps/api-go/internal/progress/repo.go      (190 LoC)
apps/api-go/internal/progress/service.go   (210 LoC, public DTO + LearningStats)
apps/api-go/internal/handler/progress.go   (80  LoC, all 4 routes)
apps/api-go/test/e2e/progress_test.go      (340 LoC, 8 tests)
```

### Modified files

- `cmd/server/main.go` — added `mountProgress()` + import.
- `internal/repo/db/progress.sql.go` — generated from new query file.

---

## Key decisions

### 1. Lessons are linked via chapters, not directly to courses

`prisma/schema.prisma` defines `Lesson.chapterId` (not `courseId`).
The Go side had to follow this — but two of my initial queries
referenced `lessons.course_id` which doesn't exist. Fixed in dev:

- `progress.sql::ListCompletedCourseIDs` — added JOIN
  `lessons → chapters → course` with `course_id` filter.
- `progress/repo.go::GetCourseForLesson` — same join.

**Lesson-noted**: in the Prisma-generated schema, `lessons` and
`chapters` are join tables; only `courses` has `course_id`. Always
go through the chapter when you need the course from a lesson.

### 2. `lessons` and `chapters` have no `updated_at`

Unlike most tables in the schema, `lessons` and `chapters` have
`created_at` + `deleted_at` but no `updated_at`. (They use
`@map("created_at")` but `@updatedAt` is only on courses /
users / progress_records / etc.) The e2e test insert code had
`updated_at` in the column list which made the inserts fail.

Fixed in `progress_test.go::insertCourseChapterLesson` — removed
`updated_at` from the chapter + lesson inserts. The service code
doesn't reference `updated_at` for these tables.

### 3. CompleteLesson is idempotent + first-transition badge hook

Same pattern as the badges service. The service:
1. Looks up the existing progress record (by user + lesson).
2. If it doesn't exist, inserts a new row (status=completed).
3. If it exists, updates the existing row (status=completed).
4. If the record was NOT already 'completed' (first transition),
   fires a fire-and-forget `AwardOnLessonComplete` hook.
5. If it was already 'completed' (re-complete), no hook fires.

The hook is a no-op stub for now. T15-2 or T15-3 will wire it to
the badges service's `CheckAndAward`.

### 4. LearningStats aggregates from multiple tables

`/me/stats` returns a single object with:
- `totalLessonsCompleted` — `SELECT COUNT(*) FROM progress_records WHERE user_id=? AND status='completed'`
- `completedCourseIds` — derived query (full course = all lessons done)
- `streakDays` — derived from `DISTINCT DATE(completed_at)`
- `enrollmentsCount` — `SELECT COUNT(*) FROM enrollments WHERE user_id=? AND deleted_at IS NULL`
- `completedPractices` — `SELECT COUNT(*) FROM practice_completions WHERE user_id=? AND status='completed'`
- `points` — `SELECT points FROM users WHERE id=?`

The streak algorithm: most recent completion date must be today or
yesterday; then count consecutive days back. This is a simplified
version of the NestJS service's `computeStreakDays` (which
parses every completed_at timestamp).

### 5. Public DTO with nullable fields

`ProgressDTO` flattens `sql.NullTime` + `sql.NullInt32` to
`*string` + `*int32` (or nil) with `camelCase` keys. Matches the
OpenAPI contract.

---

## Test results

```
--- PASS: TestProgress_Unauthenticated_401
--- PASS: TestProgress_Me_EmptyForNewUser
--- PASS: TestProgress_CompleteLesson_Success
--- PASS: TestProgress_CompleteLesson_Idempotent
--- PASS: TestProgress_Me_ListsCompleted
--- PASS: TestProgress_CourseProgress_Filter
--- PASS: TestProgress_Stats_ForNewUser
--- PASS: TestProgress_Stats_AfterCompletion
```

8/8 PASS in 74s.

---

## Cumulative Phase 2 status

| Phase | Tests | Status |
|---|---|---|
| T11 (Users + Identities) | 16/16 | ✅ |
| T12-1 to T12-4 (Courses/Chapters/Lessons/Resources) | 19/19 | ✅ |
| T13-1, T13-2 (Enrollments/Orders) | 15/15 | ✅ |
| T14-1 to T14-4 (Degrees/Badges/Certificates/Practices) | 41/41 | ✅ |
| **T15-1 (Progress)** | **8/8** | **✅ (this turn)** |
| Baseline healthz | 4 | ✅ |
| Integration | 5/5 | ✅ |
| **TOTAL** | **108/108** | **✅ green (per-module)** |

---

## Cross-module unlocks

T15-1 unlocks real implementations for several previously-stubbed
hooks:

| Stub | Real impl path |
|---|---|
| `badges.computeProgress → course_completed` | T15-1's `ListCompletedCourseIDs` |
| `badges.computeProgress → lessons_completed` | T15-1's `CountCompletedLessons` |
| `badges.computeProgress → streak_days` | T15-1's `computeStreak` |
| `orders.CheckRefundEligibility` | T15-1's progress queries (deferred to T15-final) |
| `progress.AwardOnLessonComplete` | Will wire to `badges.CheckAndAward` in T15-2 |

When T15 ships, the badges service can drop the `(0, target)`
fallback for these 3 criteria types and use real progress data.

---

## Next: T15-2 (Learning events) + T15-3 (Notes) + T15-4 (Reviews)

T15 still has 3 sub-modules:
- **T15-2 Learning events** — 3 endpoints, lightweight event log
- **T15-3 Notes** — 5 endpoints, per-lesson user notes
- **T15-4 Reviews** — 5 endpoints, course reviews + ratings

Then T15-final wires the orders.CheckRefundEligibility with real
progress data (T13-2 + T15-1 + T15-2/3/4 = full refund rules).

After T15: T16 (Notifications + Points + Uploads S3), then Phase 3-4
(strangler fig traffic shift).
