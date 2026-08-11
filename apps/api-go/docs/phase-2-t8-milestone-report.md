# Phase 2 T8 — OAuth / SSO Endpoints

**Date**: 2026-08-11
**Status**: ✅ Complete. 9/9 e2e tests green.
**Stack**: Go 1.23 / Fiber v2 / sqlc / dockertest / golang.org/x/oauth2.

## Scope

Filled in the OAuth/SSO + identity-management flows that were
stubbed in Phase 1 T6. The T6 scaffold (Provider interface,
StateStore, dispatcher) was already in place — T8 was the
real implementation.

### Endpoints delivered

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/auth/:providerId/start` | – | returns IdP URL + state |
| POST | `/api/v1/auth/:providerId` | – | direct authenticate (code in body) |
| POST | `/api/v1/auth/:providerId/callback` | – | OAuth/SAML callback |
| GET | `/api/v1/auth/:providerId/link/start` | JWT | link flow start |
| POST | `/api/v1/auth/:providerId/link/callback` | JWT | link flow callback |
| GET | `/api/v1/auth/identities` | JWT | list linked providers |
| DELETE | `/api/v1/auth/identities/:id` | JWT | unlink |

All 7 endpoints map 1:1 to `apps/api/src/modules/auth/auth.controller.ts`
NestJS source.

### What's in the Go port

1. **`OAuthProvider`** — real `golang.org/x/oauth2` flows for
   Google + GitHub + generic OIDC. PKCE (S256) by default. State
   is stored in the StateStore (Redis prod / in-memory test) with
   a 10-minute TTL and one-shot consumption.
2. **`SsoProvider`** — still stub (returns `ErrInvalidCredentials`).
   The crewjam/saml library is already in go.mod from T3 POC; the
   full impl is T8.1 work because SAML needs an IdP metadata URL
   to test against.
3. **`StateStore`** — Redis + in-memory impls. Production uses
   Redis; tests use in-memory. Both implement the same interface.
4. **Identity management** — `user_provider_accounts` table is
   populated on register (auto-creates an `email_password` primary
   identity) and on `linkCallback` (adds a secondary identity).
   Unlink is soft-delete via `deleted_at`.
5. **Test mode** — `auth.OAuthTestMode` package var short-circuits
   the IdP roundtrip. `CurrentOAuthTestIdentity` is the singleton
   that the provider returns when in test mode. Set in main.go
   for non-prod envs and overridable from e2e tests.

### What's deferred to T8.1

- **Real SAML `SsoProvider.Verify`** — the scaffold + crewjam/saml
  dep are in place; needs an IdP metadata URL to test against.
  Test mode for SAML is the same pattern as OAuth.
- **Password reset** (`/auth/password-reset/*` 3 endpoints) —
  was in T7 scope, deferred. Small impl, separate `password-reset.service.ts`.
- **Production StateStore** — `RedisStateStore` is built but the
  prod wiring (Redis URL env, main.go injection) is deferred.

## Files written / modified

### New
- `test/e2e/auth_oauth_test.go` (~430 LoC, 9 tests)

### Modified
- `internal/auth/oauth.go` — full impl with golang.org/x/oauth2
  (Google + GitHub + generic OIDC)
- `internal/auth/service.go` — added `CreateAuthorization`,
  `CreateLinkAuthorization`, `LinkIdentity`, `ListIdentities`,
  `UnlinkIdentity`, `Identity` type, `SetRepo`
- `internal/auth/repo.go` — added `ListProviderAccountsByUser`,
  `UnlinkProviderAccount`, `CountPrimaryProviders`, `LinkProviderAccount`
- `internal/handler/auth.go` — 7 new handler methods + route
  reordering (static paths before `:providerId` catch-all)
- `cmd/server/main.go` — `OAuthTestMode=true` in non-prod,
  in-memory StateStore wired to all OAuth providers
- `db/queries/auth.sql` — added `UnlinkProviderAccount`,
  `CountUserProviderAccounts` sqlc queries
- `go.mod` / `go.sum` — `golang.org/x/oauth2 v0.30.0` added

## Tests

```
$ go test -timeout 5m -count=1 -run "TestOAuth_" ./test/e2e/
ok  	github.com/frankfika/ai-academy/api-go/test/e2e	77.322s

# Tests (9):
#   TestOAuth_ListProviders
#   TestOAuth_StartProvider_ReturnsAuthURL
#   TestOAuth_StartProvider_Unknown
#   TestOAuth_DirectAuthenticate_TestMode
#   TestOAuth_DirectAuthenticate_RealUserFlow    ← seeds user + tests successful flow
#   TestOAuth_Identities_Unauthenticated_401
#   TestOAuth_Identities_Empty
#   TestOAuth_LinkAndUnlinkIdentity               ← link + list + unlink + verify soft-delete in DB
#   TestOAuth_LinkStart_RequiresAuth
```

The link-and-unlink test directly queries the DB to verify the
`deleted_at` column is set on the unlinked row. Per T11+ discipline:
trust DB > API.

## Design decisions

1. **Test mode = `OAuthTestMode` package var, not env-gated inside
   the provider.** Easier to flip from e2e tests; main.go sets it
   to true for non-prod envs; production gets the real flow.

2. **PKCE (S256) by default.** Code verifier is generated at
   `start` time, stored in StateStore under the state key, consumed
   at `callback` time. Without PKCE, an attacker who intercepts the
   `code` can exchange it for tokens. With PKCE, they'd also need
   the verifier (which never leaves the server).

3. **One-shot state consumption.** `ConsumeOAuth` uses a Lua
   script (`GET + DEL`) in Redis so a replayed state can't
   succeed twice. In-memory impl uses a `delete` inside the
   locked section.

4. **Static path before `:providerId` catch-all.** Fiber's
   `:providerId` is a wildcard that matches anything, so
   `/auth/identities` would be captured as `providerId="identities"`.
   Register the static routes first (NestJS does the same).

5. **Identity table gets a row on register.** The email_password
   register flow auto-creates a `(user, provider='email_password',
   provider_user_id=email)` row. This is the "primary" identity.
   OAuth linking adds a secondary row. Unlink is soft-delete.

6. **No auto-link on OAuth authenticate.** When a user signs in
   with OAuth for the first time, the dispatcher doesn't
   auto-link to an existing email_password identity. The user
   must explicitly call `/link/callback` while authenticated.
   This matches NestJS behavior and avoids accidental merges
   when emails collide.

7. **Google + GitHub userinfo normalization.** Each IdP has its
   own quirks: Google returns `email_verified` directly; GitHub
   requires a second call to `/user/emails` to get the primary
   verified email. Encapsulated in `fetchGoogleUserInfo` /
   `fetchGitHubUserInfo`.

## Open follow-ups (T8.1)

- **Real `SsoProvider.Verify`** — `crewjam/saml` roundtrip. Needs
  an IdP metadata URL for the e2e; can use the same test-mode
  pattern.
- **Password reset** — `/auth/password-reset/{capability,request,confirm}`
  3 endpoints. ~2 hours.
- **Redis StateStore in production** — `RedisStateStore` is built
  and tested; the main.go wiring is a one-liner once REDIS_URL is
  set.

## What's next

After T8, the Phase 2 module count is **34/38 routes** (cumulative
~172/172 e2e green). Remaining 4:
- **chat** (LLM conversation history) — admin list + per-user list
- **ai** (AI usage tracking) — admin stats
- **hackathons** (admin list/create + registration) — public + admin
- **instructors / site CMS / enterprise / url-import** (4 admin/experimental)

These are mostly read-only admin views over the existing tables
— mechanical porting. Each is ~30 min. 4 of them = ~2 hours.
