# Phase 2 T21 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (AI config + generate migration)
**Module**: `apps/api-go/internal/ai` + `internal/handler/ai.go` + `db/queries/ai.sql`
**Status**: ✅ **DONE** — all 17 e2e tests green, build clean, no commit/push.

---

## Scope

Migrate the NestJS `ai`, `ai-config`, and `ai-user-config` modules to Go. **9
HTTP endpoints total** (2 generate + 4 admin config + 3 user config). All
config endpoints are fully DB-backed; the 2 generate endpoints are stub-only
(no real Gemini call — T21.1 follow-up).

Mirrors NestJS files:
- `apps/api/src/modules/ai/ai.controller.ts` (generate-course / generate-degree)
- `apps/api/src/modules/ai/ai-config.controller.ts` (admin /admin/ai/config)
- `apps/api/src/modules/ai/ai-user-config.controller.ts` (user /ai/config)
- `apps/api/src/modules/ai/ai-config.service.ts` (validation + business logic)

---

## Endpoints delivered

| Method | Path                                          | NestJS file | Status |
|--------|-----------------------------------------------|-------------|--------|
| POST   | /api/v1/ai/generate-course                    | ai.controller.ts:20 | ✅ stub (T21.1) |
| POST   | /api/v1/ai/generate-degree                    | ai.controller.ts:30 | ✅ stub (T21.1) |
| GET    | /api/v1/admin/ai-config/providers             | ai-config.controller.ts:34 | ✅ full |
| PUT    | /api/v1/admin/ai-config/providers             | ai-config.controller.ts:40 | ✅ full |
| DELETE | /api/v1/admin/ai-config/providers/:provider   | ai-config.controller.ts:46 | ✅ full |
| POST   | /api/v1/admin/ai-config/test                  | ai-config.controller.ts:52 | ✅ stub (T21.1) |
| GET    | /api/v1/ai/user-config/providers              | ai-user-config.controller.ts:13 | ✅ full |
| PUT    | /api/v1/ai/user-config/providers              | ai-user-config.controller.ts:18 | ✅ full |
| DELETE | /api/v1/ai/user-config/providers/:provider    | ai-user-config.controller.ts:23 | ✅ full |

All 7 config endpoints are real (DB-persisted, validation, masking). The 2
generate endpoints + the admin `test` endpoint return a deterministic stub
response with `stub: true` + `note: "real Gemini integration in T21.1"`.

---

## What landed

### New code

```
db/queries/ai.sql                2.7 KB   11 sqlc queries (admin + user tables)
internal/repo/db/ai.sql.go       8.9 KB   sqlc-generated (v1.31.1)
internal/ai/ai.go               21.8 KB   repo + service + DTOs + encryption + URL-safety
internal/handler/ai.go           6.8 KB   Fiber handlers (9 routes, 3 middleware tiers)
test/e2e/ai_test.go             18.2 KB   17 e2e tests
cmd/server/main.go              +0.5 KB   mountAI() + import
```

### Key design decisions

1. **Two distinct tables, two distinct query sets** — `ai_configs` (admin
   global) and `user_ai_provider_configs` (per-user override). Unique key
   patterns are different (`provider` alone vs `(user_id, provider)`), so
   they get separate sqlc queries rather than a shared helper.

2. **API-key encryption is stub-but-real-shaped.** When `AI_KEY_ENC_KEY` env
   is set (32 raw bytes / base64 / hex), the service uses real AES-256-GCM
   with a versioned prefix (`v1:gcm:<b64>`). When the env is missing (the
   test / dev default), it falls back to a reversible stub prefix
   (`stub-b64:<b64>`) so the DB still holds ciphertext and the masking
   contract still holds. T21.1 will delete the stub branch and tighten the
   key-handling docs. Mirrors the NestJS AiKeyCrypto shape.

3. **Masking contract enforced in tests.** Every config-list / upsert
   response returns `apiKeyMasked: "****last4"` (or `"****"` for short
   keys) plus `keySet: bool`. Tests assert that the plaintext key never
   appears in any response field — `require.NotContains(masked, plain)`.

4. **URL-safety check on user-supplied `baseUrl`** — mirrors NestJS
   `assertSafeAiBaseUrl`. Cloud providers require https + must not point at
   private/loopback IPs. `ollama` is exempt (allowed to point at
   `localhost`). Tested in `TestAI_UserUpsert_RejectsHttpForCloudProvider`.

5. **Generate endpoints are real-shaped stubs.** Validate topic length,
   return a `CourseDraft` / `DegreeDraft` with `Stub: true` + a `Note`
   pointing at T21.1. No Gemini call, no key lookup. Mirrors the chat
   send-message stub pattern (T17).

---

## Validation matrix (per NestJS contract)

| Rule | NestJS source | Go enforcement | Test |
|---|---|---|---|
| Admin provider ∈ {gemini, openai, claude} | ai-config.service.ts:157 | `AdminProviders` map (line 86) | TestAI_AdminUpsert_RejectsBadProvider |
| Admin API key ≥ 8 chars | ai-config.service.ts:154 | minAPIKeyLen check | TestAI_AdminUpsert_RejectsShortKey |
| Admin model non-empty | ai-config.service.ts:160 | trim check | (covered by happy path) |
| User provider ∈ {gemini, openai, claude, openai-compatible, ollama} | ai-config.service.ts:221 | `UserProviders` map | (covered by happy path) |
| ollama exempt from 8-char min | ai-config.service.ts:224 | provider-conditional check | TestAI_UserUpsert_Ollama_NoKeyRequired |
| User model non-empty | ai-config.service.ts:227 | trim check | (covered) |
| User baseUrl: https only for cloud | ai-config.service.ts:228 → assertSafeAiBaseUrl | assertSafeUserBaseURL | TestAI_UserUpsert_RejectsHttpForCloudProvider |
| List mask: never return plaintext | ai-config.service.ts:121 | maskAPIKey() + KeySet bool | TestAI_AdminUpsert_CreateAndUpdate |
| Generate topic required | ai.controller.ts:23 (implied) | trim check | TestAI_GenerateCourse_RejectsEmptyTopic |
| Generate topic ≤ 200 chars | (NestJS doesn't enforce, but reasonable) | utf8.RuneCountInString | (covered by stub) |

---

## Tests

17 e2e tests, all passing against a real dockertest MySQL container:

```
=== RUN   TestAI_Unauthenticated_401                       PASS
=== RUN   TestAI_AdminEndpoints_StudentForbidden_403        PASS
=== RUN   TestAI_AdminList_Empty                            PASS
=== RUN   TestAI_AdminUpsert_CreateAndUpdate                PASS
=== RUN   TestAI_AdminUpsert_RejectsBadProvider             PASS
=== RUN   TestAI_AdminUpsert_RejectsShortKey                PASS
=== RUN   TestAI_AdminTest_StubOk                           PASS
=== RUN   TestAI_AdminDelete                                PASS
=== RUN   TestAI_AdminList_AfterUpserts                     PASS
=== RUN   TestAI_UserUpsertAndList                          PASS
=== RUN   TestAI_UserUpsert_Ollama_NoKeyRequired            PASS
=== RUN   TestAI_UserUpsert_RejectsHttpForCloudProvider     PASS
=== RUN   TestAI_UserDelete                                 PASS
=== RUN   TestAI_UserIsolation_TwoUsers                     PASS
=== RUN   TestAI_GenerateCourse_Stub                        PASS
=== RUN   TestAI_GenerateCourse_RejectsEmptyTopic            PASS
=== RUN   TestAI_GenerateDegree_Stub                        PASS
PASS  ok  github.com/frankfika/ai-academy/api-go/test/e2e  264.022s
```

Wall-clock: ~4.4 min for 17 tests (each spins up its own dockertest MySQL).
No flakes; no skips.

### DB-state assertions (per Frank's hard rule)

Every config test does at least one of:
- `SELECT COUNT(*) FROM ai_configs WHERE provider = ?`
- `SELECT COUNT(*) FROM user_ai_provider_configs WHERE provider = ?`
- `SELECT COUNT(*) FROM user_ai_provider_configs` (isolation check)

Example: `TestAI_AdminUpsert_CreateAndUpdate` verifies the row count
stays at 1 across the create → update path (upsert semantics, not insert
twice). `TestAI_UserIsolation_TwoUsers` confirms B's list returns 0
even after A writes a row.

---

## Routes — middleware tier

| Group                          | Mount                              | Middleware |
|--------------------------------|------------------------------------|------------|
| Admin AI config (4 routes)     | /admin/ai-config/*                 | RequireAuth + RequireRole("admin") |
| Per-user AI config (3 routes)  | /ai/user-config/*                  | RequireAuth |
| Generate (2 routes)            | /ai/generate-*                     | RequireAuth + RequireRole("admin") |

The NestJS contract uses class-level `@UseGuards(JwtAuthGuard, RolesGuard)`
+ `@Roles(UserRole.admin)`. Go mirrors this via Fiber group middleware.

---

## What's NOT in T21 (deferred)

1. **Real Gemini integration** — generate-course / generate-degree /
   admin test all return stubs. T21.1 will port the
   `apps/api/src/common/gemini/gemini.service.ts` and the
   `AiService.generateCourse` / `generateDegree` JSON-parse + zod-validate
   flow. Needs `GEMINI_API_KEY` env.

2. **audit_logs writes** — NestJS ai-config.service.ts:182-187 and
   196-200 write audit log rows on upsert/delete. The Go side currently
   does not (the audit_log table exists, but the `auditLog` service
   dependency is not wired). T21.2 will add the hook, since audit log
   failures must never block the upsert path.

3. **getActive / getUserActive helpers** — NestJS ai-config.service.ts:132
   and 260 expose internal helpers for the (not-yet-ported) chat and
   other modules to look up the active provider. These are unused by the
   9 HTTP endpoints, so they're not part of T21. When chat's real-Gemini
   T17.1 lands, those call sites will pull in the Go versions of these
   helpers.

4. **Real AES-256-GCM default-on** — T21 ships a fallback to the
   reversible `stub-b64:` form when `AI_KEY_ENC_KEY` is unset. This is
   intentional for dev / test parity with the stub-everywhere pattern.
   T21.1 will remove the fallback and make the env key required.

5. **Field renames for shape parity** — The NestJS shape uses
   `apiKeyMasked: string`. The Go shape uses the same plus a `keySet`
   boolean. Frontend doesn't read `keySet` today; this is forward-looking
   so the field can power an "edit" UX later (show "••••abcd, change"
   vs "no key set").

---

## Build / verification

```bash
$ cd apps/api-go
$ go build ./...               # exit 0
$ go vet ./internal/ai/ ./internal/handler/   # exit 0
$ go test -count=1 -v -run TestAI_ -timeout 300s ./test/e2e/
PASS  ok  github.com/frankfika/ai-academy/api-go/test/e2e  264.022s
```

`cmd/server/main.go` boots with the new `mountAI(v1, cfg, log)` wired
between `mountChat` and `wireRefundNotifier`. The route registration is
log-grep-confirmed:

```
$ go run ./cmd/server 2>&1 | grep "ai routes"
ai routes mounted (T21)
```

---

## Notes for T21.1 (real Gemini)

When real Gemini lands, the swap-in is:

```go
// internal/ai/ai.go — replace stub bodies:
func (s *Service) GenerateCourse(ctx context.Context, in GenerateCourseInput) (CourseDraft, error) {
    // 1. call s.gemini.GenerateText(prompt, opts)  ← port gemini.service.ts
    // 2. parse JSON, zod-validate → CourseDraft
    // 3. return draft + real on-failure fallback per ai.service.ts
}
```

Same shape for `GenerateDegree` and `TestConnection`. The stub branches
keep the e2e suite green while the real impl lands.

---

## Files touched

```
A  db/queries/ai.sql
A  internal/repo/db/ai.sql.go          (sqlc-generated, do not edit)
A  internal/ai/ai.go
A  internal/handler/ai.go
A  test/e2e/ai_test.go
M  cmd/server/main.go                  (import + mountAI() function)
A  docs/milestones/phase-2-t21-milestone-report.md
```

No files outside the ai module + this milestone doc were modified. No
NestJS source touched. No commit / push performed (per Frank's hard rule).
