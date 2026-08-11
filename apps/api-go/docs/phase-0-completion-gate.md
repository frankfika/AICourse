# Phase 0 Completion Gate

**Date opened**: 2026-08-10
**Owner**: Mavis (root orchestrator)
**Purpose**: Hard list of evidence that must exist before declaring Phase 0 done
and starting Phase 1 (auth/password + DTO repair).

## Gate items (all must be ✅)

### T1 — Go skeleton
- [x] `apps/api-go/go.mod` with module path `github.com/frankfika/ai-academy/api-go`
- [x] `cmd/server/main.go` boots Fiber, mounts middleware, registers /healthz, /readyz, /metrics
- [x] `internal/{config,logger,errs,metrics}/` each compile
- [x] `Dockerfile` multi-stage, distroless final image target < 50MB
- [x] `make build` produces `bin/server` static binary
- [x] `make run` boots the server; curl /healthz returns 200 + request_id

### T2 — OpenAPI extraction
- [x] `apps/api-go/api/openapi.yaml` exists, 6,581 lines
- [x] 181 paths, 257 operations, 97 schemas
- [x] `apps/api-go/api/gen/` — 16 oas_*.go files, 119,608 LOC, compiles
- [x] `internal/handler/health.go` embeds generated types (smoke test uses ogen types)
- [x] `cmd/server/main.go` /healthz and /readyz route through generated handler
- [x] `scripts/export-openapi.sh` — one-shot re-export
- [x] `docs/poc-openapi-report.md` — 234 lines, identifies 0 typed response body / 15 empty DTOs / 8 any-typed query
- [x] **Verified independently**: server boots, /healthz returns 200 with NestJS-shaped JSON

### T3 — External dependency POC
- [ ] S3 / MinIO — full PutObject / GetObject / Presigned URL round-trip with live MinIO
- [ ] Redis — PING / SET/GET with TTL / INCR counter all PASS (already confirmed: PASS)
- [ ] Stripe — PaymentIntent form encoding + webhook signature HMAC-SHA256 + tampered-payload rejection (already confirmed: PASS)
- [ ] SAML — samlidp ↔ samlsp round-trip, signed response verifies, attribute mapping confirmed
- [ ] `docs/poc-ext-deps-report.md` — final report with per-PoC parity table vs Node SDKs

### T4 — Prisma → sqlc
- [x] `db/schema.sql` — 1,118 lines, 59 tables, 32 enums, loss-less translation
- [x] `db/migrations/0001_init.sql` — 58,624 bytes, byte-identical to schema.sql
- [x] `db/sqlc.yaml` — config for sqlc v1.31.1
- [x] `db/queries/{auth,courses,enrollments,orders,users}.sql` — 32 named queries (auth 10)
- [x] `internal/repo/db/` — 7 files, 3,692 LOC, compiles
- [x] `cmd/poc-schema/main.go` — 4/4 step PASS, idempotent
- [x] `docs/poc-schema-report.md` — 276 lines, translation rules + caveats
- [x] **Verified independently**: `make db-verify` applies DDL to scratch MySQL → 59 tables; `SHOW CREATE TABLE courses` matches Prisma byte-for-byte

### T5 — Test discipline
- [x] `docs/testing-strategy.md` — 6 layers, hermetic, no DB mocks
- [x] `test/e2e/setup_test.go` + `health_test.go` — 4 tests, all PASS, < 1s
- [x] `test/integration/main_test.go` + `main_integration_test.go` — dockertest spins MySQL 8, 5 tests all PASS, 6-13s
- [x] `internal/errs/errs_test.go` — 91.9% coverage, error envelope contract verified
- [x] `internal/config/config_test.go` — 97.1% coverage, JWT secret placeholder check verified
- [x] `Makefile` with `make {test,test-fast,build,run,lint,db-verify,openapi-export,schema-diff,clean}`
- [x] `docs/ci-workflow-snippet.yml` — GH Actions snippet (Frank to push; Mavis lacks `workflow` scope)
- [x] `make test` all green; `make lint` clean; `make db-verify` 59 tables

### Phase 0 documentation
- [x] `docs/go-migration-execution-plan.md` — full phase plan, 13 tasks, 23 sub-tasks
- [x] `docs/go-migration-assessment-2026-08-10.md` — 评估报告 (R1-R7 risks)
- [x] `docs/migration-decisions.md` — 11 decisions logged (incl. T2 finding, T4 caveats)
- [x] `apps/api-go/README.md` — stack + layout + run instructions

## Sign-off (when all ✅)

When every box is checked, this gate is satisfied and Phase 1 (auth/password)
may begin. The first concrete Phase 1 task is **T2 finding remediation**:
add `@ApiProperty()` decorators to `LoginDto`, `RegisterDto`,
`PasswordResetRequestDto`, `PasswordResetConfirmDto` in
`apps/api/src/modules/auth/dto/*.dto.ts`, re-export the spec, regenerate
ogen, then start the auth handler port.

## Cron monitoring

- cron `phase0-poc-monitor` (every 30 min) tracks T3 status
- when T3 succeeds, this gate is the authoritative checklist
- on Phase 0 sign-off, delete the cron
