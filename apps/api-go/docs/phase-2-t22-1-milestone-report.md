# Phase 2 T22.1 — url-import real + enterprise audit/notification

**Date**: 2026-08-11
**Phase**: 2 of 6 (admin + ancillary migration)
**Modules**: `internal/urlimport` (real metadata extraction) + `internal/enterprise` (audit_log + Resend notifier)
**Status**: ✅ **DONE** — 19/19 e2e tests pass (verified individually), build + vet clean.

---

## Scope

T22.1 lands the two pieces of real work that were stubbed in T22
because their supporting packages didn't exist yet:

1. **url-import real metadata fetch** — live HTTP calls to YouTube
   oEmbed and the Bilibili view API, persisted title/author/
   thumbnail/duration/raw JSON. Status state machine
   `pending → fetched → imported|failed`.
2. **enterprise side effects** — `audit_logs` rows on
   `Create`/`UpdateStatus`/`Delete`, and the cross-module Resend
   notifier fires on the user-visible status transitions
   (`pending → contacted`, `pending → qualified`,
   `contacted → qualified`).

---

## What I did

The previous (failed) subagent had already written the production
code on disk. I verified it works and fixed one test-file bug.
**No production code was rewritten**.

### One test-file fix

`test/e2e/enterprise_test.go` was modified to use `time.Now()` /
`time.Since()` in the dockertest retry context message, but the
`"time"` import was never added — broke `go test ./test/e2e/`
compilation. Fix: one-line edit, added `"time"` to the import
block at line 25.

### Files modified

- `test/e2e/enterprise_test.go` — added missing `"time"` import
- `docs/phase-2-t22-1-milestone-report.md` — this report

No production code, no schema, no other test files touched.

### Build + vet (clean)

`go build ./...` and `go vet ./...` both pass with no output.

---

## E2E verification (19/19 pass)

8 `TestUrlImport_*` + 6 T22-baseline `TestEnterprise_*` + 5
T22.1-specific `TestEnterprise_T221_*` = 19 tests, all green
when run individually with explicit docker cleanup between runs
(see discoveries below).

T22.1-specific coverage:

- **urlimport** (4 tests): `Single_YouTube_Real`,
  `Single_Bilibili_Real`, `Single_UpstreamFailure`, `Admin_Batch`.
  Verifies httptest fixtures (oEmbed + Bilibili view) land
  title/author/thumbnail/duration on the `url_imports` row, and
  that 500s flip the row to `failed` with the upstream error.
- **enterprise audit + notifier** (4 tests):
  - `T221_Create_WritesAuditLog` — POST inquiry → 1 audit row,
    action `enterprise_inquiry_created`, details JSON includes
    name/company/team_size.
  - `T221_UpdateStatus_WritesAuditLog_AndFiresNotifier` — PATCH
    `pending → contacted` → audit row with from/to status +
    `ResendNotifierCall` populated.
  - `T221_Delete_WritesAuditLog` — DELETE → audit row, action
    `enterprise_inquiry_deleted`. Row persists in `audit_logs`
    after the inquiry is hard-deleted.
  - `T221_InternalStatusUpdate_NoNotifier` — PATCH to `closed` →
    audit row written, **notifier NOT fired** (admin-internal).

---

## Key design points (in code, not my changes)

- **httptest injection**: `urlimport.SetYouTubeOEmbedBaseURL` /
  `SetBilibiliViewBaseURL` are package-level setters that swap the
  production endpoints for `httptest.NewServer` URLs. Cleanup
  restores prior URLs to avoid leaking state to parallel test files.
- **`enterprise.SetResendNotifier`**: package-level function pointer
  + recording wrapper (`ResendNotifierCall`).
  `main.go::wireEnterpriseNotifier` overrides with a logging stub;
  tests override with a counter. Mirrors `orders.SetRefundNotifier`
  (T11).
- **Narrow notifier triggers**: `shouldNotifyOnStatus` only fires
  for `pending → contacted`, `pending → qualified`,
  `contacted → qualified`. Closed/archived are admin-internal.
- **`DraftCourseOutline` is a no-op without `GEMINI_API_KEY`** —
  real Gemini call deferred to T21.1.
- **`pool.MaxWait = 3 * time.Minute`** in both test files —
  raises dockertest's default 60s retry to 3 min so the suite
  survives concurrent MySQL containers from other agents.

---

## Non-obvious discoveries

### 1. Multi-agent docker resource contention

Running `go test ./test/e2e/` while 4-7 other agents are also
running their suites produces alternating PASS/FAIL (10-15s PASS,
55-90s FAIL on dockertest retry). The failure is `mysql never came
up` — the docker daemon on macOS can't start 4+ MySQL containers
simultaneously within the retry window. Mitigation: `-p 1` +
per-test `docker rm -f` between runs. I confirmed all 19 tests
PASS by running them individually with explicit cleanup.

### 2. Prior subagent's mid-flight edits broke the test package

The failed subagent modified the dockertest retry error message
to include elapsed time but forgot to add `"time"`. This broke
`go test ./test/e2e/` compilation for **every** agent working
in this repo, not just T22.1 tests. Worth being careful about
mid-flight edits leaving the package build-broken.

### 3. `cms_test.go` was being actively edited in parallel

While I was running tests, the T23 cms agent was writing
`test/e2e/cms_test.go`. Briefly the file had a forward reference
to a not-yet-declared variable, breaking the whole `test/e2e`
package build. Self-resolved when the cms agent finished. I did
NOT touch `cms_test.go` — T23's territory.

---

## Deferred work

1. **Real Gemini integration** — `DraftCourseOutline` is a no-op
   without `GEMINI_API_KEY`. T21.1 follow-up.
2. **Real Resend client** — `wireEnterpriseNotifier` is a logging
   stub. notification-module follow-up.
3. **url-import admin list endpoint** — sqlc queries exist
   (`ListUrlImports` / `ListUrlImportsByRequester`) but no HTTP
   route yet.
4. **`moduleCount` source-of-truth fix** — preserved as a known
   bug for parity with NestJS.
5. **Per-IP-only rate limit on `POST /enterprise/inquiries`** —
   global Fiber limiter (100 req/min) is the right floor; tighter
   per-IP limit can be layered later.
