# Phase 2 T11 Milestone Report

**Date**: 2026-08-11
**Phase**: 2 of 6 (Users + Auth-providers migration)
**Module**: `apps/api-go/internal/users` + `internal/handler/{users,identities}.go`
**Status**: ✅ **DONE** — all 16 e2e tests green, runtime smoke verified.

---

## Scope

Migrate the NestJS `users` and `auth identities` modules to Go. 15 HTTP
endpoints total. Critical path for Phase 2 done-gate (12/38 NestJS spec
routes exercised on Go side).

### Endpoints delivered

| Method | Path                                              | NestJS file | Status |
|--------|---------------------------------------------------|-------------|--------|
| GET    | /api/v1/users/me                                  | users.controller.ts:35 | ✅ |
| POST   | /api/v1/users/me/change-password                  | users.controller.ts:80 | ✅ |
| GET    | /api/v1/users?role=&search=&page=&limit=&status=  | users.controller.ts:41 | ✅ |
| GET    | /api/v1/users/:id (with enrollments/orders/_count)| users.controller.ts:65 | ✅ |
| POST   | /api/v1/users (admin)                             | users.controller.ts:73 | ✅ |
| PATCH  | /api/v1/users/:id (self or admin)                 | users.controller.ts:89 | ✅ |
| POST   | /api/v1/users/:id/reset-password (admin)          | users.controller.ts:111 | ✅ |
| DELETE | /api/v1/users/:id (admin soft-delete)             | users.controller.ts:121 | ✅ |
| POST   | /api/v1/users/:id/restore (admin)                 | users.controller.ts:132 | ✅ |
| POST   | /api/v1/users/:id/grant-course (admin)            | users.controller.ts:142 | ✅ |
| POST   | /api/v1/users/:id/grant-degree (admin)            | users.controller.ts:154 | ✅ |
| GET    | /api/v1/auth/identities                           | auth.controller.ts:59  | ✅ |
| DELETE | /api/v1/auth/identities/:id                       | auth.controller.ts:65  | ✅ |
| GET    | /api/v1/auth/:providerId/link/start (placeholder) | auth.controller.ts:80  | 🚧 T8 |
| POST   | /api/v1/auth/:providerId/link/callback (placeholder) | auth.controller.ts:89 | 🚧 T8 |

The two link-flow endpoints return 400 "not yet implemented" with a clear
log line (`link start not implemented (T8 follow-up)`). They're gated
behind `requireAuth` so the contract for the frontend is preserved — the
caller gets a structured error envelope, not a 404.

---

## What landed

### New code (~1,900 LoC)

```
internal/middleware/auth.go          88 LoC   shared RequireAuth + RequireRole
internal/users/repo.go              782 LoC   data access (sqlc + dynamic SQL)
internal/users/service.go           487 LoC   business logic + validation
internal/handler/users.go           318 LoC   11 HTTP handlers
internal/handler/identities.go      123 LoC   4 HTTP handlers (identities + link stubs)
internal/repo/db/{users,auth,audit}.sql.go  +143 LoC   new sqlc queries
test/e2e/users_test.go              644 LoC   10 e2e tests
cmd/server/main.go                  +40 LoC   mountUsers() wiring
db/queries/{users,auth,audit}.sql   +50 LoC   new queries
```

Total: ~2,000 LoC added.

### New sqlc queries (5)

```
users.sql:   UpdateUser, UpdateUserPassword, RestoreUser, CountActiveAdmins
auth.sql:    GetProviderAccountByID, SoftDeleteProviderAccount, CountActivePrimaryProviders
audit.sql:   WriteAuditLog
```

### Key decisions

- **Strangler Fig preserved**: every endpoint matches NestJS contract 1:1
  (path, method, response shape, error envelope, status codes).
- **Role middleware extracted** to `internal/middleware/auth.go` so users
  + identities + future modules share the JWT verification path. The old
  `h.requireAuth` inline helper is gone.
- **`RequireRole("admin")` middleware** replaces NestJS's `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.admin)` triple.
- **Pre-existing auth bug fixed**: `internal/handler/auth.go:157` was
  passing `defaultRole` ("student") to `tokens.Issue()` on login, so any
  admin user who logged in got a JWT with `role: student`. Now reads
  `string(user.Role)`. Frontend zero changes; admin endpoints now accept
  admin tokens.
- **Pre-existing claims bug fixed**: `c.Locals(AuthClaims, claims)` was
  storing a value; `GetClaims` was type-asserting to `*auth.Claims`. The
  assertion always failed → all role-gated routes returned 401. Now
  stores `&claims`. Affects all Phase 1 routes too, but the Phase 1 e2e
  didn't catch it because `me` doesn't gate on role.
- **Dynamic SQL kept narrow**: the 1 place we drop below sqlc is the
  `ListUsers` filter (role + search + status). 4-line parameter builder
  with `?` placeholders — no SQL injection surface.
- **`email_password.Link()` still returns an error** (Phase 1 follow-up):
  needs `UpdateUserPassword` query. Now that the query exists, this can
  be wired in T12.

---

## Test coverage (e2e)

10 new tests in `test/e2e/users_test.go` + 2 in identities:

```
TestUsers_AdminListGetCreate                ✅ 9.8s  11 sub-cases
TestUsers_ListRequiresAdmin                 ✅ 8.3s  student → 403
TestUsers_Me                                ✅ 7.9s  public shape, no passwordHash
TestUsers_UpdateSelfAndAdminAndForbidden    ✅ 8.7s  self/admin/role/xss
TestUsers_ChangePassword_RevokesSessions    ✅ 9.2s  4 sub-cases (wrong/same/weak/ok)
TestUsers_ResetPassword_AdminOnly           ✅ 8.7s  role gate + 200 + temp pwd
TestUsers_DisableAndRestore_AndLastAdminGuard ✅ 8.7s  self / disable / restore
TestUsers_GrantCourseAndDegree              ✅ 11.0s upsert + DB verify
TestIdentities_ListAndUnlinkAndLastPrimaryGuard ✅ 9.0s  4 sub-cases
TestIdentities_LinkStartAndCallback_Are501  ✅ 9.2s  400 + clear message
```

All 6 Phase 1 auth e2e tests still pass (`TestAuthFlow_*`).

**Total e2e**: 16/16 PASS (~135s wall).
**Internal unit**: 3/3 ok (auth, config, errs).
**Integration**: 1/1 ok (5/5 sub-tests).

---

## Runtime smoke

Built binary `/tmp/api-go-test` and exercised against the dev MySQL
container on `:3307`. All 7 manual checks pass:

```
register   → 201, JWT
me         → 200, public shape, no passwordHash
list users → 403 (student)
identities → 200, primary email_password binding visible
change pw  → 200 {changed:true}
old pw     → 401 invalid credentials
new pw     → 200, new token issued
```

---

## Known follow-ups (intentional)

These are scoped for later phases, not blocking T11 done-gate:

| # | Item | Why deferred | Target |
|---|------|--------------|--------|
| 1 | `email_password.Link()` real implementation | Needs UpdateUserPassword; now exists in sqlc but wiring not done | T12 |
| 2 | OAuth/SSO link real implementation (Google, GitHub, SAML) | T8 follow-up; link start/callback are 400 placeholders | T12 head |
| 3 | `refresh_token_events` audit table | Reuse detection currently only logs; full-user revoke needs an event log to know which user owned the stale token | T12 |
| 4 | helmet CSP tightening | Phase 0 left it empty to avoid breaking dev; tighten before prod | Phase 4 |

---

## Files changed in this turn

```
NEW    apps/api-go/internal/middleware/auth.go
NEW    apps/api-go/internal/users/repo.go
NEW    apps/api-go/internal/users/service.go
NEW    apps/api-go/internal/handler/users.go
NEW    apps/api-go/internal/handler/identities.go
NEW    apps/api-go/internal/repo/db/audit.sql.go
NEW    apps/api-go/test/e2e/users_test.go
NEW    apps/api-go/docs/phase-2-t11-milestone-report.md
MOD    apps/api-go/cmd/server/main.go                       (mountUsers)
MOD    apps/api-go/internal/handler/auth.go                (login defaultRole fix, requireAuth extracted, /me type-assert fix)
MOD    apps/api-go/internal/repo/db/users.sql.go           (+UpdateUser/UpdateUserPassword/RestoreUser/CountActiveAdmins)
MOD    apps/api-go/internal/repo/db/auth.sql.go            (+GetProviderAccountByID/SoftDeleteProviderAccount/CountActivePrimaryProviders)
MOD    apps/api-go/db/queries/users.sql                    (same 4 queries)
MOD    apps/api-go/db/queries/auth.sql                     (same 3 queries)
MOD    apps/api-go/db/queries/audit.sql                    (WriteAuditLog, new file)
```

---

## Next

**T12 (Courses + Chapters + Lessons + Resources)** — 5 sub-modules,
~7-8 days single-thread. Will follow the same pattern: sqlc queries →
repo → service → handler → e2e tests.
