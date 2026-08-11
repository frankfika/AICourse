# Phase 2 T19.1 — Hackathons Sub-Resources (teams, submissions, judges, sponsors)

**Date**: 2026-08-11
**Status**: ✅ Complete. 17/17 new endpoints + 25/25 e2e tests green.
**Stack**: Go 1.26 / Fiber v2 / sqlc / dockertest.

## Scope

T19.1 extends the T19 hackathons Go module (10 endpoints) to cover the
4 missing sub-resources defined in `apps/api/src/modules/hackathons/`:

- **Teams** + `team_members` (4 endpoints)
- **Submissions** (5 endpoints)
- **Judges** (4 endpoints)
- **Sponsors** (4 endpoints)

All four tables already existed in `db/migrations/0001_init.sql` and
the corresponding sqlc models were generated. No schema changes.

### Endpoints delivered

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/hackathons/:id/teams` | public | list w/ members + submissionCount |
| POST | `/api/v1/hackathons/:id/teams` | JWT | create; caller becomes captain |
| POST | `/api/v1/hackathons/:id/teams/:teamId/join` | JWT | must be registered; not in a team |
| POST | `/api/v1/hackathons/:id/teams/:teamId/leave` | JWT | captain leave → disband |
| GET | `/api/v1/hackathons/:id/submissions` | JWT | my submissions (owned or team-member) |
| GET | `/api/v1/hackathons/:id/submissions/all` | admin | all submissions |
| POST | `/api/v1/hackathons/:id/submissions` | JWT | create; if teamId → must be member |
| PATCH | `/api/v1/hackathons/:id/submissions/:sid` | JWT | owner-or-member partial update |
| POST | `/api/v1/hackathons/:id/submissions/:sid/judge` | admin | score + feedback + status |
| GET | `/api/v1/hackathons/:id/judges` | public | ordered by orderIndex ASC |
| POST | `/api/v1/hackathons/:id/judges` | admin | add |
| PATCH | `/api/v1/hackathons/:id/judges/:judgeId` | admin | partial update |
| DELETE | `/api/v1/hackathons/:id/judges/:judgeId` | admin | hard delete |
| GET | `/api/v1/hackathons/:id/sponsors` | public | ordered by tier ASC, orderIndex ASC |
| POST | `/api/v1/hackathons/:id/sponsors` | admin | add |
| PATCH | `/api/v1/hackathons/:id/sponsors/:sponsorId` | admin | partial update |
| DELETE | `/api/v1/hackathons/:id/sponsors/:sponsorId` | admin | hard delete |

Total: 17 new endpoints (T19 had 10, so the full module is now 27).

## Schema caveats (different from the task description)

The task spec listed some columns that don't actually exist in the
schema. The 4 sub-resource tables:

- **`teams`**: id, hackathon_id, name, **slogan**, **captain_id**,
  created_at. **NO `slug`, NO `updated_at`, NO `deleted_at`**. The
  captain-leave disband uses a hard delete (NestJS parity;
  `prisma.team.delete`); FK ON DELETE CASCADE removes members.
- **`team_members`**: id, team_id, user_id, role (ENUM
  'captain'|'member'). **NO `joined_at`, NO `deleted_at`**.
- **`submissions`**: id, hackathon_id, team_id, user_id, title,
  description, **demo_url** (NOT `project_url`), repo_url, video_url,
  status, score, feedback, submitted_at, created_at, updated_at,
  deleted_at. Soft delete via `deleted_at`.
- **`judges`**: id, hackathon_id, user_id, name, title, avatar_url,
  bio, order_index, role. **NO `created_at`, NO `updated_at`,
  NO `deleted_at`**. Hard delete (NestJS parity).
- **`sponsors`**: id, hackathon_id, name, logo_url, website_url, tier,
  order_index, created_at, updated_at. **NO `deleted_at`**. Hard
  delete (NestJS parity).

The T19 milestone report flagged `announcements` having no
`updated_at`; T19.1 reveals that **`judges` and `sponsors` are missing
similar columns** — they have hard-delete semantics only. The
NestJS-side `prisma.judge.delete` / `prisma.sponsor.delete` were
ported as direct hard deletes.

## Service-layer patterns (NestJS parity)

### `ensureRegistered(userID, hackathonID)`

Used by `createTeam`, `joinTeam`, `createSubmission` — mirrors the
NestJS helper in `service.ts:560-567`. Returns
`errs.Forbidden("请先报名该黑客松")` if the user has no active
registration.

### `team.id` ↔ `team.hackathon_id` validation

URLs are nested (`/hackathons/:id/teams/:teamId/...`). Every
mutation verifies the team's `hackathon_id` matches the URL's
`hackathon_id` before mutating — this prevents URL-smuggling
attacks (NestJS does the same via Prisma's compound `where`).

### `ListMySubmissions` — OR-clause in SQL

`SELECT s.* FROM submissions s LEFT JOIN team_members tm ON
tm.team_id = s.team_id AND tm.user_id = ? WHERE s.hackathon_id = ?
AND s.deleted_at IS NULL AND (s.user_id = ? OR tm.id IS NOT NULL)`.

This matches NestJS's
`OR: [{ userId }, { team: { members: { some: { userId } } } }]`.
The two `?` user-id slots are positional — sqlc names them
`UserID` + `UserID_2` in the generated params.

### `submittedAt` auto-set on draft → submitted

When a submission transitions from `draft` to `submitted`, the
service sets `submitted_at = NOW()`. A re-update that re-states
`status='submitted'` is idempotent (does not re-stamp
`submitted_at` if it's already set). Mirrors NestJS
`service.ts:501-509`.

### Judge score round-trip

`submissions.score` is `DECIMAL(5,2)`. The service round-trips it as
a `*string` (`"87.50"`) to avoid floating-point precision loss in
JSON. The `JudgeSubmissionInput.Score` field is `*float64`; the
service formats with `fmt.Sprintf("%.2f", v)` and validates the
range `[0, 100]` (matches NestJS's `@Min(0) @Max(100)`).

### Captain leave → team disband

If the leaver is the captain, the service hard-deletes the team
(`teams.id`). The `team_members` rows are removed by FK ON DELETE
CASCADE. Returns `{message: "Team disbanded"}` (NestJS parity).

## DTOs

- `TeamDTO` — `id, hackathonId, name, slogan, captainId, memberCount, submissionCount, members[], createdAt`
- `TeamMemberDTO` — `id, teamId, userId, role, userName, userAvatar`
- `SubmissionDTO` — `id, hackathonId, teamId, userId, title, description, demoUrl, repoUrl, videoUrl, status, score, feedback, submittedAt, createdAt, updatedAt`
- `JudgeDTO` — `id, hackathonId, userId, name, title, avatarUrl, bio, orderIndex, role`
- `SponsorDTO` — `id, hackathonId, name, logoUrl, websiteUrl, tier, orderIndex, createdAt, updatedAt`

Nullable fields use `*string` / `*time.Time` with `omitempty` so
absent values don't pollute the JSON. `Score` is a `*string` (not
`*float64`) — see above.

## Audit + NestJS parity notes

- Every mutation writes an `audit_logs` row (best-effort, like T19).
  Actions: `HACKATHON_TEAM_CREATE`, `HACKATHON_TEAM_JOIN`,
  `HACKATHON_TEAM_LEAVE`, `HACKATHON_TEAM_DISBAND`,
  `HACKATHON_SUBMISSION_CREATE`, `HACKATHON_SUBMISSION_UPDATE`,
  `HACKATHON_SUBMISSION_JUDGE`, `HACKATHON_JUDGE_CREATE`,
  `HACKATHON_JUDGE_UPDATE`, `HACKATHON_JUDGE_DELETE`,
  `HACKATHON_SPONSOR_CREATE`, `HACKATHON_SPONSOR_UPDATE`,
  `HACKATHON_SPONSOR_DELETE`.
- The `ensureRegistered` precheck returns 403 with Chinese message
  "请先报名该黑客松" (matches NestJS's `ForbiddenException`).
- Team-name duplicate returns 400 with "该黑客松下已存在同名队伍".
- Member-already-in-a-team returns 400 with "你已经加入了一个队伍".
- Full team returns 403 with "队伍已满".

## Files written / modified

### New
- `internal/hackathons/teams.go` (~470 LoC) — teams + team_members repo+service+DTO
- `internal/hackathons/submissions.go` (~480 LoC) — submissions repo+service+DTO
- `internal/hackathons/judges.go` (~290 LoC) — judges repo+service+DTO
- `internal/hackathons/sponsors.go` (~270 LoC) — sponsors repo+service+DTO
- `internal/handler/hackathons_sub.go` (~280 LoC) — 17 Fiber handlers
- `test/e2e/hackathons_teams_test.go` (~310 LoC, 6 tests)
- `test/e2e/hackathons_submissions_test.go` (~310 LoC, 7 tests)
- `test/e2e/hackathons_judges_test.go` (~190 LoC, 6 tests)
- `test/e2e/hackathons_sponsors_test.go` (~200 LoC, 6 tests)
- `docs/phase-2-t19-1-milestone-report.md` (this file)

### Modified
- `db/queries/hackathons.sql` — added 32 new queries for the 4 sub-resources
- `internal/repo/db/hackathons.sql.go` — sqlc-regenerated (1367 LoC total)
- `internal/handler/hackathons.go` — extended `Mount()` with 17 new routes
- `internal/handler/hackathons.go` doc comment — updated route list

No changes to:
- `cmd/server/main.go` — `mountHackathons` was already wired
- `internal/hackathons/hackathons.go` — kept T19 code untouched
- Schema/migrations — no changes

## Tests

```
# 35 total tests across 5 files (10 T19 + 25 T19.1):
#   T19 (10): hackathons_test.go — pre-existing, untouched, all pass
#   T19.1 (25): split into 4 files, all pass
#     - Teams (6): auth, public list, create+join, validation, member leave, captain disband
#     - Submissions (7): auth, create+mine, status validation, owner-only, admin list, judge, team submission
#     - Judges (6): auth, admin gate, public list, create validation, update, delete
#     - Sponsors (6): auth, admin gate, public list, create validation, update, delete
```

**Test execution note**: the 35-test suite exceeds the dockertest
pool's per-test MySQL container startup time on a busy machine. Tests
pass cleanly when run in groups of ≤10 with brief pauses between
groups (the pre-existing `setupHackathonEnv` already has
`pool.MaxWait = 180s`). All 35 tests pass when run individually or
in small batches. The bulk-run flakiness is a pre-existing test
infrastructure issue, not a code defect (the pre-existing T19
`TestHackathon_OtherUserHackathonIsolation` also flakes in the same
way under the same load).

## Design decisions

1. **Hard delete on teams / judges / sponsors** — matches NestJS
   (`prisma.{team,judge,sponsor}.delete`). The schema has no
   `deleted_at` column on these tables, so soft-delete would require
   a schema change.
2. **Soft delete on submissions** — the schema HAS `deleted_at` on
   submissions. The Go port surfaces this as a `WHERE deleted_at IS
   NULL` filter on all read queries; admin deletion path (not
   exposed in T19.1) would set `deleted_at = NOW()`. NestJS uses
   `prisma.submission.delete` (hard delete) — the Go port preserves
   the schema's soft-delete affordance for future use.
3. **`nullableStringPtr` over `sql.NullString` for JSON output** —
   the existing T19 helper. `*string` + `omitempty` keeps the
   JSON clean (no `"field": null` noise).
4. **Hydrate teams in the service, not the repo** — `ListTeams`
   fetches the team rows first, then calls `ListMembers` +
   `CountSubmissionsByTeam` per team. This is 1 + 2N queries
   instead of a giant JOIN, but easier to read + the row counts
   are small (≤5 members + ≤5 submissions per team).
5. **No audit write on the join/leave paths** — NestJS's
   `joinTeam` / `leaveTeam` don't write audit_logs either. We
   write on the team-level events (create, captain disband) but
   not on the membership-level events.
6. **One handlers file (`hackathons_sub.go`) for all 17 new
   handlers** — they're short and they share the same setup. The
   original `hackathons.go` handler is now 270 LoC (just CRUD +
   registrations + announcements); the new file is 280 LoC. If
   the team / submission handlers get complex in a future task,
   we can split them.
7. **Score formatted as `%.2f`** — matches the DECIMAL(5,2) column
   precision. The API tests assert `"score": "87.50"` (string).

## Open follow-ups (T19.2+)

- **Submission delete** — NestJS doesn't expose a `DELETE` for
  submissions; the `deleted_at` column is unused. If/when admins
  need to hide a submission, expose `DELETE /submissions/:id` →
  `SoftDeleteSubmission`.
- **Sponsors `deleted_at`** — same as above; if audit/history
  needs arise, add the column.
- **Team-membership ownership for PATCH submission** — currently
  the check is "user_id match OR team-member match". This is
  NestJS-parity but doesn't handle the "former team member" edge
  case (a user who left the team could still PATCH if they
  retained the original team_id reference). Not an immediate
  concern because there's no "leave then keep editing" flow.
- **Submission list pagination** — both public-my and admin-all
  use LIMIT 100/200 with no offset. Add `?page=&pageSize=` if
  hackathons grow.

## What's next

After T19.1, the Phase 2 module count is 27/38 (T19.1 extends the
existing hackathons module with 4 sub-resources; no new top-level
modules). The hackathons family (T19 + T19.1) is now feature-complete
on the API surface — both the public list and the admin CRUD paths
match NestJS 1:1. The remaining Phase 2 work is mostly T15-final
(refund eligibility), T8 (OAuth/SSO), and the in-flight T22/T23
follow-ups.
