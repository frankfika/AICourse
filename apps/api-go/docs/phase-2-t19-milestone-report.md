# Phase 2 T19 — Hackathons Module (slice 1)

**Date**: 2026-08-11
**Status**: ✅ Complete. 10/10 e2e tests green.
**Stack**: Go 1.26 / Fiber v2 / sqlc / dockertest.

## Scope

Migrated the first slice of the NestJS `hackathons` module to Go:
10 user-facing + admin endpoints. The teams / submissions / judges /
sponsors endpoints (~20 routes) are deferred to T19.1 — schema tables
exist; we just don't surface HTTP endpoints yet.

### Endpoints delivered

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/hackathons` | Optional | public list, status+search filter |
| GET | `/api/v1/hackathons/:id` | Optional | public detail, +registrationCount |
| POST | `/api/v1/hackathons` | admin | create |
| PATCH | `/api/v1/hackathons/:id` | admin | partial update |
| DELETE | `/api/v1/hackathons/:id` | admin | soft-delete → status='cancelled' |
| POST | `/api/v1/hackathons/:id/register` | JWT | idempotent (re-register returns existing) |
| POST | `/api/v1/hackathons/:id/cancel` | JWT | sets status='cancelled' + deleted_at |
| GET | `/api/v1/hackathons/:id/my-registration` | JWT | returns the row or `null` |
| GET | `/api/v1/hackathons/:id/announcements` | public | list |
| POST | `/api/v1/hackathons/:id/announcements` | admin | create |

### Deferred to T19.1

- Teams CRUD: `/:id/teams`, `/teams/:teamId/join|leave`
- Submissions: `/:id/submissions`, `/:id/submissions/:sid`, `/:id/submissions/:sid/judge`
- Judges CRUD: `/:id/judges` (list / add / update / delete)
- Sponsors CRUD: `/:id/sponsors` (list / add / update / delete)

All four tables are already in the schema; the corresponding sqlc
queries can be added when the endpoints land.

## Schema caveats (the 3 gotchas the task spec flagged)

1. **`hackathons` has NO `deleted_at` column** — the previous sqlc
   queries (`ListHackathons`, `GetHackathonByID`, `UpdateHackathon`)
   referenced `deleted_at IS NULL` and would have failed at runtime
   with `Unknown column 'deleted_at' in 'where clause'`. Rewrote
   all three to drop the filter; the table's notion of "soft delete"
   is `status='cancelled'`.
2. **`hackathon_registrations` HAS `deleted_at`** + a `UNIQUE(hackathon_id, user_id)`
   index. The `UpsertRegistration` query uses `ON DUPLICATE KEY UPDATE
   status='registered', deleted_at=NULL`, which gives the
   "re-register after cancel re-activates" behavior NestJS
   implements in two queries.
3. **`announcements` has NO `updated_at` column** — only `created_at`.
   The `CreateAnnouncement` and `ListAnnouncements` queries don't
   touch `updated_at` (NestJS doesn't either).

## Effective-status inference (date-based override)

NestJS computes a hackathon's effective `status` on the fly: editorial
states (`cancelled` / `finished` / `judging`) are never inferred
backwards from dates, but `upcoming` → `active` → `judging` is
inferred from `start_date` / `end_date`. Ported this as
`hackathons.effectiveStatus(h, now)` and applied it after the SQL
list, so the public list filter works on the *displayed* status
(matches NestJS's `.map(...).filter(...)` pattern).

## Idempotency: re-registration

`POST /:id/register` is idempotent. Two cases:

- **No existing row** → `UpsertRegistration` inserts a new row.
- **Existing active row (`status='registered'`)** → service returns
  the existing row without re-inserting (NestJS parity).
- **Existing cancelled row** → `UpsertRegistration` flips status
  back to `registered` and clears `deleted_at` via `ON DUPLICATE
  KEY UPDATE`.

The handler always returns `201 Created` (mirrors NestJS — the
controller doesn't distinguish create vs. re-activate).

## DTO shape

Single `HackathonDTO` type. Nullable columns are `*string` /
`*time.Time` with `omitempty` so absent fields don't show up as
`null` in JSON. `RegistrationCount` is a `*int32` (not a plain
`int32` with `omitempty`) so the field is always present in detail
responses — clients can rely on `dto.registrationCount === 0`
meaning "no registrations yet", which is the cleaner contract than
"the field is sometimes absent, sometimes 0".

## Files written / modified

### New
- `internal/hackathons/hackathons.go` (~620 LoC) — repo + service + DTO
- `internal/handler/hackathons.go` (~220 LoC) — 10 Fiber handlers
- `test/e2e/hackathons_test.go` (~530 LoC, 10 tests)
- `docs/phase-2-t19-milestone-report.md` (this file)

### Modified
- `db/queries/hackathons.sql` — rewrote 3 queries to drop the broken
  `deleted_at` filter + added 2 new queries
  (`GetRegistrationIncludingCancelled`, `CountRegistrationsByHackathon`,
  `DeleteHackathon` for future use)
- `internal/repo/db/hackathons.sql.go` — sqlc-regenerated, 11 queries
- `cmd/server/main.go` — `mountHackathons` added, import added, call
  site added (now mounts 19 modules)

## Tests

```
$ go test -timeout 5m -count=1 -run "TestHackathon_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	153.925s

# Tests (10):
#   TestHackathon_Unauthenticated_401             ← 7 endpoints × unauth
#   TestHackathon_PublicList                       ← list + status filter + bad-status 400
#   TestHackathon_PublicDetail                     ← detail + date-based effective-status
#   TestHackathon_AdminCreate                      ← create + DB verify + student 403 + 400
#   TestHackathon_Register                         ← 201 + idempotent re-register
#   TestHackathon_CancelAndReRegister              ← cancel + DB verify + re-activate + 400
#   TestHackathon_MyRegistration                   ← null→row + other-user null
#   TestHackathon_OtherUserHackathonIsolation      ← role gate on POST
#   TestHackathon_AnnouncementsListAndCreate       ← list empty + create + DB verify + student 403 + 400
#   TestHackathon_AdminSoftDelete                  ← status='cancelled' + DB verify + register 403
```

The 10 tests cover:
- Auth gates (401 / 403) on every gated endpoint
- DB-state verification on every mutation (`SELECT status FROM hackathons ...`,
  `SELECT status, deleted_at FROM hackathon_registrations ...`,
  `SELECT title, is_pinned FROM announcements ...`)
- NestJS parity: date-based `effectiveStatus`, `status='published'` returns 400
  (not in the enum), `endDate == startDate` returns 400, `endDate < startDate` returns 400
- Re-registration of a cancelled registration re-activates (`deleted_at` flips
  back to NULL, status back to `registered`)

## Design decisions

1. **`hackathons.sql` rewrite (3 broken queries)** — the pre-existing
   sqlc output referenced `deleted_at IS NULL` on a table with no
   such column. Would have crashed at first request. Rewrote
   `ListHackathons`, `GetHackathonByID`, `UpdateHackathon` and added
   `DeleteHackathon` for future use.

2. **No `ListAll` admin endpoint yet** — NestJS's `findAll` is the
   only list endpoint, and the `isAdmin` distinction is purely
   "see the same data even if effectiveStatus would hide it". Since
   the date-based effectiveStatus never hides a row (it only changes
   the displayed status), the public list and admin list are
   identical in shape. No separate admin list endpoint needed.

3. **Re-registration handler returns 201, not 200** — matches
   NestJS. Even on the re-activate path, the HTTP semantic stays
   "create or get", which keeps client logic simpler.

4. **`myRegistration` returns `null` (not 404)** — NestJS's behavior.
   The client uses this to render "you haven't registered" vs.
   "you have registered" without having to special-case a 404.

5. **`effectiveStatus` runs in the service, not in SQL** — the
   date-based override can't be expressed in a single SQL query
   without complex CASE expressions. Doing it in Go keeps the
   queries simple and matches the NestJS implementation 1:1.

6. **Admin soft-delete = `status='cancelled'`, no tombstone** —
   the schema has no `deleted_at` column on `hackathons`, so
   "soft delete" is just a status flip. The `DELETE` handler
   returns 200 with a message (NestJS parity — NestJS's
   `delete` returns `{ message: 'Hackathon deleted' }` despite
   the schema not having a `deleted_at` column either).

7. **Hackathon `Delete` is admin-only, not user-self-deletable** —
   NestJS's `@Roles(UserRole.admin)` on the controller is
   the only gate. Users can only `cancel` their own registration.

## Open follow-ups (T19.1)

- **Teams / submissions / judges / sponsors endpoints** — the
  four tables exist; the corresponding sqlc queries and
  service+handler code need to be written. ~20 routes.
- **T19.2 — Hackathon-side notifications** — the NestJS code
  fires a notification when an announcement is created. Not
  ported in T19 (out of scope); the `writeAudit` hook writes
  to `audit_logs` but not to the user inbox.
- **Submission owner check** — NestJS checks `user_id = X` OR
  `team.members.some({ userId: X })`. The teams/submissions
  work in T19.1 will need this OR-clause in a single SQL.

## What's next

After T19, the Phase 2 module count is 27/38. T19.1 is the
follow-up for the remaining hackathon endpoints; T15-final
(refund eligibility, real progress-based logic) is the last
"small" deliverable; T8 (OAuth/SSO) is the biggest remaining
chunk. Estimated work for T19.1 is one session of focused
implementation + tests.
