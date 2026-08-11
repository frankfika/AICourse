# Testing Strategy — apps/api-go

**Owner**: Mavis (root orchestrator) + Frank
**Status**: Phase 0 — initial scaffolding; rules below apply from Phase 1 onward.
**Goal**: Make sure the Go rewrite never silently regresses the public API surface
or the error contract that the previous NestJS API exposed.

This strategy exists because the existing NestJS API has **0 e2e tests** (verified
2026-08-10: `find apps/api/test -name "*.e2e-spec.ts"` returns nothing) and only
**38 service-level spec files** for 25,303 LOC. We are not migrating that test debt
forward — we are raising the bar.

## Layers

| Layer | Tooling | Scope | CI gate |
|---|---|---|---|
| **Unit** | `testing` + `testify/assert` | Pure functions, validators, error mapping, helpers | `go test ./internal/...` |
| **HTTP handler** | `fiber.App.Test()` + `httptest` | Handler logic, middleware chain, status codes, response body shape | `go test ./internal/handler/...` |
| **Contract** | `ogen` generated types + a `contract` package that compares NestJS swagger spec vs Go handlers | Every path in the OpenAPI 3.0 spec has a registered Go handler with matching request/response schema | `go test ./test/contract/...` |
| **Integration** | `dockertest` (MySQL + Redis + MinIO via the repo's docker-compose) | Full request → handler → repo → MySQL → response round trip, with double-write verification against the live NestJS API | `go test ./test/integration/...` |
| **E2E** | `httptest`-driven CLI + Playwright (apps/web already has Playwright) | Critical user paths: login → /me → enroll in course → pay → progress → logout | `go test ./test/e2e/...` + `pnpm playwright test` in apps/web |
| **Load (Phase 4)** | `k6` | p95 latency ≤ 1.5x current NestJS baseline at 100 RPS, 0 errors | manual run before cutover |

## Directory layout

```
apps/api-go/
├── internal/.../*_test.go           — unit + handler tests live next to source
└── test/
    ├── contract/                    — OpenAPI spec ↔ Go handler parity
    │   └── contract_test.go
    ├── integration/                 — full stack, dockertest spins MySQL/Redis/MinIO
    │   ├── main_test.go             — shared setup
    │   ├── auth_test.go             — phase 1
    │   ├── courses_test.go          — phase 2
    │   └── ...
    └── e2e/                         — black-box, against running server
        ├── e2e_test.go              — healthz/readyz/rate-limit envelope (phase 0)
        ├── auth_login_test.go       — phase 1
        └── ...
```

## Conventions

1. **Every new package gets a `_test.go` file** with at least one positive case. No silent untested code.
2. **Test names describe behavior, not implementation**: `TestLogin_WithValidEmailAndPassword_Returns200AndJWT` not `TestAuthServiceLogin`.
3. **No mocks for the database**. Use dockertest + a real MySQL. The existing NestJS service ran 38 spec files all of which are mocked — that pattern hid bugs.
4. **Error response shape is part of the contract.** Every handler-level test asserts the JSON envelope: `statusCode`, `message`, `error`, `timestamp`, `path`, `requestId`.
5. **Tests must be hermetic.** No external network. MySQL/Redis/MinIO come from the repo's `docker-compose.yml`. Stripe is mocked with a fake-key test mode.
6. **Tests must be parallelizable.** Use `t.Parallel()` where possible so the full suite can finish in < 60s.

## Phase 0 T5 deliverables (this week)

- [x] `docs/testing-strategy.md` — this document
- [ ] `test/e2e/e2e_test.go` — first e2e: boot the Go server in-process, hit `/healthz`, `/readyz`, expect 404 envelope shape, expect rate-limit kicks in after 100 reqs/min
- [ ] `test/integration/main_test.go` — dockertest harness that spins mysql:8 + redis:7 + minio and tears them down after the suite
- [ ] CI workflow under `.github/workflows/api-go-test.yml` running `go test ./...` on every push

## Migration invariant

Until the gateway fully cuts traffic to the Go API (Phase 4 cut 100%), every
integration test must run the **same scenario** against both the NestJS API
(`localhost:3001` in CI) and the Go API (`localhost:8080`), and assert the
responses are structurally identical (status code, JSON shape, key fields).
This is the "double-write parity" check that catches accidental behavioral drift.

The first parity test target: `/healthz` and `/readyz` — trivial, but exercises
the contract harness end-to-end. Auth follows in Phase 1.

## What this strategy does NOT do

- We are not porting the existing 38 NestJS `*.spec.ts` files verbatim. Many of them
  assert on private internals (decorators, NestJS provider scopes) that have no Go
  equivalent. We re-author tests at the Go behavior level.
- We are not introducing property-based testing in Phase 0. Phase 2 may add
  `pgregory.net/rapid` for fuzz-style validation of DTOs.
- We are not introducing chaos testing in Phase 0. Phase 4 (cutover) adds
  targeted failure injection (kill MySQL mid-request, force throttler to expire).
