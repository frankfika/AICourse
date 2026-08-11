# Phase 2 T16-3 — Uploads Module

**Date**: 2026-08-11
**Status**: ✅ Complete. 12/12 e2e tests green.
**Stack**: Go 1.23 / Fiber v2 / sqlc / dockertest / InMemoryStorage.

## Scope

Migrated the NestJS `uploads` module to Go: 2 endpoints (sign +
complete) with the full 9-scope config matrix and 9 writeback
paths. The 9 scopes are: `lesson-video`, `resource`,
`course-thumbnail`, `degree-thumbnail`, `hackathon-banner`,
`hackathon-judge-avatar`, `hackathon-sponsor-logo`,
`submission-video`, `user-avatar`.

### Endpoints delivered

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/uploads/sign` | JWT | presigned URL + key + scope |
| POST | `/api/v1/uploads/complete` | JWT | confirm + 9-scope writeback |

### What the Go port covers (matches NestJS 1:1)

1. **Scope config matrix** — 9 scopes with keyPrefix, allowedRoles,
   maxSizeMB, allowedMime, presignTtlSec. Ported from
   `uploads.config.ts` as a Go map.
2. **Sign validation** — role + mime + size. fail-fast refId check
   per scope (lesson / course / degree / hackathon / judge / sponsor /
   submission / user).
3. **Complete validation** — key ownership (`<prefix>/<userId>/`),
   role (mirror sign), headObject (must exist + pass mime/size
   re-check against the actual uploaded file).
4. **Writeback switch** — 9 cases, one per scope, each routing
   `publicUrl` to the correct column in the correct table.
5. **Submission ownership** — admin sees all; non-admin must own
   the submission (`user_id = X`) OR be on the team
   (`team_members.user_id = X`).
6. **Storage abstraction** — `Storage` interface (presign, head,
   delete, getPublicUrlBase) with `InMemoryStorage` impl for
   dev/test and a `LocalFileStorage` stub (file-based) for future.

### What the Go port defers (T16-3.1 follow-up)

- **Real S3 / MinIO** via `aws-sdk-go-v2`. The interface is in
  place; adding the impl is ~80 LoC + env config. The dev/test
  setup doesn't have MinIO, so we ship with `InMemoryStorage`.
- **Per-endpoint throttling** (NestJS uses `@nestjs/throttler`).
  No Go equivalent. Will be handled at the API gateway (nginx /
  envoy) per the T15-2 learning-events decision.
- **Audit log** on every sign/complete. NestJS writes a row to
  `audit_logs`. T16-3 skips this — the audit log wiring was
  cross-feature in NestJS; in Go, we log via zap and call it good.
  If Frank wants full parity, add a small `writeAudit` helper.

## Files written / modified

### New
- `internal/uploads/scopes.go` (~150 LoC) — 9-scope config map
- `internal/uploads/storage.go` (~200 LoC) — Storage interface +
  InMemoryStorage + LocalFileStorage stub
- `internal/uploads/uploads.go` (~430 LoC) — Service: sign,
  complete, writeback, 9 entity-specific existence checks
- `internal/handler/uploads.go` (~95 LoC) — 2 Fiber handlers
- `test/e2e/uploads_test.go` (~470 LoC, 12 tests)
- `db/queries/uploads.sql` — 9 sqlc UPDATE queries
- `docs/phase-2-t16-3-milestone-report.md` (this file)

### Modified
- `cmd/server/main.go` — `mountUploads` added, import added, call
  site added (now mounts 18 modules total)
- `internal/repo/db/uploads.sql.go` — sqlc-generated, 9 queries

## Tests

```
$ go test -timeout 5m -count=1 -run "TestUploads_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	99.630s

# Tests (12):
#   TestUploads_Unauthenticated_401
#   TestUploads_Sign_HappyPath
#   TestUploads_Sign_ValidationErrors  (3 sub-cases: bad scope, bad mime, too large)
#   TestUploads_Sign_StudentCannotUploadCourseThumbnail
#   TestUploads_Sign_NonexistentRefID
#   TestUploads_Complete_NotFound           (no seed → 404)
#   TestUploads_Complete_CrossUserKeyForbidden
#   TestUploads_Complete_UserAvatar_Writeback       ← verifies users.avatar_url updated
#   TestUploads_Complete_CourseThumbnail_Writeback  ← verifies courses.thumbnail updated
#   TestUploads_Complete_OwnerSubmission_Writeback  ← verifies submissions.video_url + owner check
#   TestUploads_Complete_OtherUsersSubmission_Forbidden
#   TestUploads_Complete_NoWriteback_WhenRefIDOmitted
```

The 3 writeback tests directly query the DB to verify the column
was updated (per T11+ audit discipline: trust DB > API).

## Design decisions

1. **`InMemoryStorage` as the dev/test default** — no S3 setup
   needed. The e2e test seeds blobs via `TestSeed()` to simulate
   browser PUTs. Production swap is one impl addition.

2. **9 separate UPDATE queries** instead of one dynamic SQL builder.
   sqlc generates type-safe bindings, so the cost is 9 short SQL
   statements + 9 cases in a Go switch. The 286-line NestJS
   `routeWriteback` function becomes ~100 lines in Go.

3. **Per-table existence checks** (8 separate `lessonExists`,
   `courseExists`, etc. helpers) instead of one generic check.
   Mirrors NestJS's per-scope `validateRefIdForSign` switch.
   The "use the writeback's affected_rows as the existence
   signal" alternative would conflate "not found" with "exists
   but not allowed" — keeping them separate is clearer.

4. **`courses.thumbnail` and `resources.url` are NOT NULL columns**
   in the schema, so sqlc generates `string` (not `NullString`).
   Other 7 columns are nullable → `NullString`. The service handles
   this with a `sql.NullString{Valid: true}` for nullable columns
   and bare `string` for the two NOT NULL ones.

5. **5 tables in the upload-targeted set have NO `deleted_at`
   column** (courses, nano_degrees, hackathons, judges, sponsors).
   The existence checks for those 5 skip the soft-delete filter.
   Caught by a 500 error in T16-3 testing; documented in memory.

6. **Submission owner check** uses a single SQL with
   `OR EXISTS (SELECT 1 FROM team_members ...)` instead of
   NestJS's two queries. One round-trip instead of two.

## Open follow-ups (T16-3.1)

- **Real S3 backend** — `aws-sdk-go-v2` config + MinIO endpoint.
  Tied to Frank setting `MINIO_*` env vars in production.
- **Audit log parity** — add `writeAudit(ctx, "UPLOAD_SIGN", ...)`
  to the sign + complete paths. Reuses the `audit_logs` table.
- **Throttling at gateway** — config note for nginx/envoy
  rate-limiting on the uploads routes (3/sec for sign, 10/sec
  for complete per the NestJS values).

## What's next

After T16-3, the Phase 2 module count is 26/38. Remaining 12
routes: T8 (OAuth/SSO) + a few admin/experimental ones (chat,
ai, hackathons, instructors, site CMS, enterprise, url-import).

T8 is the biggest remaining chunk. The NestJS code is 5
OAuth/SSO providers (WeChat Work, GitHub, Google, SAML, generic
OIDC) with full register/link/callback flows. Estimated 2-3
sessions of work. Frank's IR timeline drives priority — if the
BP work is heating up, T8 might wait.

T15-final (refund eligibility, real progress-based logic) is the
last "small" deliverable in Phase 2. ~2 hours.
