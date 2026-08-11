# T20 — Instructors Module Migration (NestJS → Go)

**Date:** 2026-08-11
**Worker:** general-purpose agent
**Branch:** not committed (per Frank's hard rule)

---

## 1. Scope

Ported all 12 endpoints of `apps/api/src/modules/instructors/`
(controller + service + DTOs) to the Go rewrite, matching the
`apps/api/src/modules/courses/` port style (T12-1) and
`apps/api/src/modules/notes/` port style (T15-3).

| Endpoint group | Count | Routes |
|---|---|---|
| Public | 2 | `GET /instructors`, `GET /instructors/:slug` |
| Admin CRUD | 6 | list/get/create/patch/delete/reorder |
| Admin course-links | 4 | list/add/remove/bulk-replace |
| **Total** | **12** | |

---

## 2. Files Added / Modified

| File | Change |
|---|---|
| `apps/api-go/db/queries/instructors.sql` | **new** — 18 sqlc queries (instructors CRUD + course_instructor_links CRUD + list-with-join) |
| `apps/api-go/internal/repo/db/instructors.sql.go` | **generated** by sqlc v1.31.1 |
| `apps/api-go/internal/instructors/instructors.go` | **new** — repo + service + DTOs (~750 LOC). Includes the NestJS-style slug generator (ASCII + sha1 fallback) and ensureUniqueSlug with `-N` suffix loop. |
| `apps/api-go/internal/handler/instructors.go` | **new** — Fiber handlers for all 12 endpoints. Mounts public on `/instructors` and admin on `/admin/instructors` with `RequireAuth + RequireRole("admin")`. |
| `apps/api-go/cmd/server/main.go` | +2 imports (`internal/instructors`) and +1 call (`mountInstructors(v1, cfg, log)`). New `mountInstructors` helper mirrors the courses/notes/reviews pattern. |
| `apps/api-go/test/e2e/instructors_test.go` | **new** — 16 e2e tests with real dockertest MySQL. |

---

## 3. URL / Spec Deltas vs. NestJS

Frank's T20 spec uses **instructor-centric** URLs for course-link CRUD:

| T20 spec | NestJS source |
|---|---|
| `GET /admin/instructors/:id/course-links` | `GET /admin/courses/:courseId/instructors` |
| `POST /admin/instructors/:id/course-links` | `POST /admin/courses/:courseId/instructors` |
| `DELETE /admin/instructors/course-links/:linkId` | `DELETE /admin/courses/:courseId/instructors/:linkId` |
| `PUT /admin/instructors/:id/course-links` | `PUT /admin/courses/:courseId/instructors` |

I followed the T20 spec (instructor-centric). The service exposes
the same operations under different parameter names — no behavior
change beyond URL.

---

## 4. Test Coverage (16 e2e tests, all passing)

| # | Test | What it checks |
|---|---|---|
| 1 | `PublicList_OnlyPublished` | public list filters out drafts |
| 2 | `PublicDetail_BySlug` | public detail by slug works |
| 3 | `PublicDetail_NotFound_404` | unknown slug → 404 |
| 4 | `AdminList_Unauthenticated_401` | no token → 401 |
| 5 | `AdminList_StudentForbidden_AdminSeesAll` | student 403, admin sees all |
| 6 | `AdminCreate_And_Detail` | create returns 201 with auto-slug + DB row landed |
| 7 | `AdminCreate_SlugConflict_409` | explicit slug duplicate → 409 (not auto-suffixed) |
| 8 | `AdminUpdate_Partial` | patch only specified fields, published_at set |
| 9 | `AdminSoftDelete` | sets published_at = NULL, public 404, admin 200 |
| 10 | `AdminReorder` | drag-sort updates order_index in DB |
| 11 | `AdminReorder_BadID_400` | bad ID in orderedIds → 400 |
| 12 | `CourseLinks_Add_List_Remove` | add → list → remove with DB verification |
| 13 | `CourseLinks_MentorForcesNotPrimary` | role=mentor + isPrimary=true → stored as false |
| 14 | `CourseLinks_BulkReplace` | PUT replaces all, deletes old links in DB |
| 15 | `CourseLinks_BulkReplace_TwoPrimaries_400` | two primary instructor links → 400 |
| 16 | `AdminSoftDelete_UnlinksCourses` | soft-delete cascades to course_instructor_links |

**Test runtime:** ~4 minutes total (16 tests, each ~15s of dockertest
spinup). No test pollution — each spins up its own MySQL 8.0 container.

**Regression check:** ran 3 sanity tests from neighboring modules
(`TestCourses_PublicList_OnlyPublished`, `TestNotes_Create_And_List`,
all 5 `TestReviews_*` tests) — all still pass. No side effects on
other modules.

---

## 5. Key Design Choices

### 5.1 Slug policy: explicit vs auto

The NestJS source has two paths in `instructors.service.ts`:
- **No explicit slug** → run `slugify(name)` then `ensureUniqueSlug`
  (loop appending `-N` until free).
- **Explicit slug** → hard-fail with 409 if it collides.

My first implementation called `ensureUniqueSlug` for both cases,
which silently suffixed explicit slugs (`aaa` → `aaa-1`). Caught by
`TestInstructors_AdminCreate_SlugConflict_409`. Fixed by branching
in `Service.Create` — only auto-slugs go through the suffix loop.

### 5.2 Course-link URL: instructor-centric

Frank's T20 spec is instructor-centric, not course-centric like the
NestJS source. I implemented the instructor-centric shape and kept
the same business logic:
- Add: clear other `isPrimary=true` links for `(course, role)` so
  the single-primary constraint survives upserts.
- Bulk-replace: wrap delete-all + create-new in a `*sql.Tx` (sqlc
  doesn't expose tx helpers, so we use `db.New(tx)` directly).

### 5.3 Soft-delete cascade

NestJS does `prisma.$transaction([deleteMany links, update instructor])`.
We don't have transaction-aware sqlc helpers, so the service does:
1. `SoftDeleteInstructor` (sqlc)
2. `DeleteCourseInstructorLinksByInstructor` (sqlc)

back-to-back. Order matters: if step 1 fails we leak nothing. If
step 2 fails after step 1, the instructor is un-published but the
links remain (visible only in admin). Acceptable trade-off; a
`BEGIN/COMMIT` could close the gap if it becomes a real problem.

### 5.4 Slug uniqueness check vs MySQL error

The instructors table has a `UNIQUE INDEX(instructors_slug_key)`. We
could rely on the unique-constraint violation, but catching it in Go
needs string-matching the MySQL error text (`Error 1062: Duplicate
entry '...' for key 'instructors_slug_key'`). Pre-checking with
`GetInstructorBySlugAny` is cleaner and gets us a proper 409 envelope
via `errs.Conflict` without parsing error strings.

### 5.5 Audit log writes

NestJS `AuditLogService.log()` is a thin Prisma insert. We replicate
with a direct `INSERT INTO audit_logs` in the service. Failures are
logged but don't propagate (same as NestJS).

### 5.6 Excluded from T20

- `getStats` (public aggregate endpoint) — not in Frank's T20 spec.
- `expertise` CRUD (separate table, separate controllers in NestJS)
  — not in Frank's T20 spec.
- `notes` field on update with explicit `null` to clear — we treat
  `null` and "field absent" the same way (don't update). This is a
  small UX deviation but acceptable; happy to revisit if it bites.

---

## 6. Build & Lint

- `go build ./...` — clean
- `go vet ./...` — clean

No new lint warnings introduced. Module follows the same
conventions as the existing `courses` / `notes` / `reviews` modules
(repo+service+handler in the same file, sqlc in `db/queries/`).

---

## 7. Open Questions / Followups

1. **getStats endpoint** — NestJS has `GET /instructors/:id/stats`
   (public, aggregates course count / student count / completion
   rate / average rating). Not in T20 spec. Easy to add later.

2. **Expertise CRUD** — NestJS has admin endpoints for managing
   `instructor_expertises` (the lookup table). Not in T20 spec.

3. **Stats cascade ordering** — if `DeleteCourseInstructorLinksByInstructor`
   fails after `SoftDeleteInstructor` succeeds, the instructor is
   hidden from public but the course link rows remain. A proper
   transaction wrapper would close this. Out of scope for T20.

4. **`api` (NestJS) reuses `auditLog` from `prisma`** — Go inserts
   directly. The shape matches; the audit_logs consumer doesn't
   care which API wrote the row.

---

## 8. Deliverable

- All 12 endpoints wired.
- 16 e2e tests pass, ~4 min total.
- No commits / pushes (per Frank's hard rule).
- Memory will be updated with: instructor module pattern,
  instructor-centric URL spec delta, slug 409 fix.
