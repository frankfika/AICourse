# Migration Decision Log — Academy backend → Go

Append-only log of decisions made during the migration. Source of truth when
the docs/go-migration-* reports disagree. Frank authorized Mavis to make these
autonomously (2026-08-10 thread).

Format: `[date] [topic] decision → rationale → consequences`

## 2026-08-10

### Stack — HTTP framework

**Decision**: Fiber v2 over Gin / Echo / chi / net/http.

**Rationale**:
- Express-style middleware chain → minimal porting friction from NestJS (which sits on Express).
- Best-in-class raw throughput among Go HTTP frameworks (~1.5x Gin in our quick benchmark).
- Built-in middlewares for the exact things we need: recover, requestid, logger, helmet, cors, limiter.
- `app.Test()` method makes in-process e2e tests trivial — used in `test/e2e/`.

**Consequences**:
- Tied to fasthttp under the hood, not net/http. Some libraries (notably standard `http.Handler`) need an adapter.
- Smaller community than Gin. Mitigation: middleware ecosystem is mature for the cases we hit.

### Stack — ORM / data layer

**Decision**: sqlc + go-migrate + ariga/atlas over gorm / ent.

**Rationale**:
- sqlc generates type-safe Go from SQL at build time — we already have a 1,504-line Prisma schema that compiles to clean DDL.
- Performance: sqlc has no runtime reflection; gorm does. At our request volume this matters less than for high-traffic services, but it costs nothing.
- ent's schema-first is more appealing than Prisma's, but the existing Prisma schema is the contract — porting to ent means rewriting the schema. sqlc lets us keep schema as SQL DDL.

**Consequences**:
- We hand-write SQL queries in `db/queries/*.sql` rather than using a query builder. This is more verbose for complex queries (joins with 5+ tables) but more honest.
- Schema migrations live in `db/migrations/*.sql` and run through `migrate` or `atlas migrate apply`.

### Stack — auth (Phase 1)

**Decision**: golang-jwt/jwt/v5 + crewjam/saml + manual auth-provider abstraction ported from `apps/api/src/modules/auth/providers/`.

**Rationale**:
- The previous API already has a clean AuthProvider abstract class with three concrete impls (email-password, oauth, sso). We port that design 1:1 rather than redesigning in Go.
- crewjam/saml is the de facto Go SAML library. We are doing a dedicated POC in Phase 0 T3 to confirm IdP compatibility before committing.
- golang-jwt/jwt is the de facto Go JWT library; supports HS256/RS256/ES256, refresh token rotation, JWKS, and the same algorithms the previous NestJS used.

**Consequences**:
- If crewjam/saml POC reveals incompatibilities, we fall back to a custom SAML implementation or to keep NestJS as a SAML shim while the Go API handles JWT-only auth.
- Refresh token rotation logic must be re-implemented in Go; there is no drop-in library.

### Test discipline

**Decision**: testify + dockertest (no mocking of the DB layer).

**Rationale**:
- The previous API's 38 spec files all mock Prisma. That hides bugs.
- dockertest gives a fresh MySQL 8 container per `go test` run. CI cost is ~10s for the container start.
- For non-DB layers (validators, error mapping, request DTOs), we use plain unit tests with testify.

**Consequences**:
- `go test ./test/integration/...` requires Docker on the host. CI workflow provisions it via `services:` block.
- Tests are slower than mocked specs — full suite is currently ~7s, will grow to ~30s as we add auth/courses/orders in Phase 1-2.

### Error envelope contract

**Decision**: Go API emits the exact same JSON envelope as NestJS AllExceptionsFilter.

**Rationale**:
- The frontend (apps/web) is already coded against this envelope. Any shape change would require a coordinated frontend migration.
- Mirroring the envelope lets us flip traffic at the gateway without touching the frontend.

**Consequences**:
- The Go error handler (`internal/errs`) must produce `{statusCode, message, error, timestamp, path, requestId}` — same keys, same casing.
- Tests assert on this envelope shape via `decodeEnvelope(t, body)`. The next agent that adds an endpoint MUST keep the envelope consistent.

### Migration invariant: double-write parity

**Decision**: From Phase 2 onward, every integration test runs the same scenario against the NestJS API and the Go API, and asserts structural parity.

**Rationale**:
- "Repeat testing, don't break the system" (Frank, 2026-08-10). The risk of silent behavioral drift is the #1 reason large rewrites fail.
- A shared OpenAPI 3.0 spec is the natural common schema; both APIs must conform to it.

**Consequences**:
- Integration tests will run against two servers in CI (NestJS on :3001, Go on :8080). Doubles the CI cost for that suite.
- Any drift triggers a "fix the Go side" task; we do not change the OpenAPI spec lightly because both APIs depend on it.

### Bootstrap: Go installed locally

**Decision**: `brew install go` was run on the orchestrator machine (Go 1.26.5 was not previously installed).

**Rationale**:
- The previous NestJS API runs on Node 22.18. There was no Go toolchain on this machine.
- `brew install go` is the canonical macOS install path; standard Cellar at `/opt/homebrew/Cellar/go/1.26.5`.

**Consequences**:
- CI uses Go 1.23 (LTS-ish). The local 1.26.5 may emit some Go 1.24+ specific warnings that don't break the build but could mask issues. CI is the source of truth.
- Go module path: `github.com/frankfika/ai-academy/api-go` — chosen to match the existing GitHub org and the `apps/api-go/` directory name.

### OpenAPI 3.0 source of truth

**Decision**: Export the spec from the running NestJS API (`/api/docs-json`) and check it in at `apps/api-go/api/openapi.yaml`. The Go side generates server types from this spec via ogen.

**Rationale**:
- The NestJS API has been running for months; its spec is a validated contract with the frontend.
- Re-authoring the spec in the Go codebase would be redundant and error-prone.
- ogen reads OpenAPI 3.0, so a JSON→YAML conversion is fine for readability.

**Consequences**:
- Phase 0 T2 (in flight) must run NestJS once, export the spec, validate spec coverage, and generate Go stubs. If the spec is incomplete (e.g. SSE endpoints or webhook receivers that Swagger cannot describe), the report must call it out.
- When the Go side ships a new endpoint that doesn't exist in NestJS, the OpenAPI spec must be updated in the same PR — both sides are tied to it.

### OpenAPI spec coverage gap (T2 finding, 2026-08-10)

**Finding**: The exported `apps/api-go/api/openapi.yaml` (181 paths, 257 operations, 97 schemas) has three real gaps that ogen cannot infer:

1. **0 / 257 operations have a typed response body.** NestJS controllers never use `@ApiOkResponse({ type: DtoClass })` — swagger emits an empty Go struct for every response. The contract is "request shape only".
2. **15 request body DTOs are empty objects** in the spec (no `properties`):
   `LoginDto`, `RegisterDto`, `PasswordResetRequestDto`, `PasswordResetConfirmDto`,
   `OAuthCallbackDto`, `GenerateCourseDto`, `GenerateDegreeDto`,
   `CreateEnterpriseInquiryDto`, `UpdateInquiryStatusDto`, `ImportFromUrlDto`,
   `BatchImportFromUrlDto`, `CreateSessionDto`, `SendMessageDto`, and 2 more.
3. **8 query parameters fall back to `any`** because the spec lacks an explicit
   `type: string` / `type: integer` on the `schema` block.

**Decision (Phase 1 work, not Phase 0)**: Add `@ApiProperty()` decorators to the
15 empty DTOs in `apps/api/src/modules/*/dto/*.dto.ts` and re-export the spec.
For the response body gap, evaluate three options during Phase 1:
- (a) Add `@ApiOkResponse({ type: ... })` to every controller method
- (b) Write a NestJS swagger plugin that derives response type from the return type
- (c) Hand-author a parallel `openapi.filled.yaml` and only use it on the Go side

**Rationale**: A spec with 0 typed response bodies and 15 empty DTOs gives us
zero compile-time safety on the most error-prone surface (login, register,
payment, AI generation). Phase 1 must close this before auth/login parity testing.

**Consequences**:
- Phase 1 T6 (auth/password) MUST begin by closing the LoginDto + RegisterDto +
  PasswordResetRequestDto + PasswordResetConfirmDto gaps. These are the four
  DTOs that gate the entire auth flow.
- The other 11 empty DTOs can be filled in alongside their parent controller
  during Phase 1/2 module migration.
- The 8 any-typed query params are a Phase 2/3 follow-up; they don't block
  the auth flow but will cause pain when migrating admin search endpoints.

### Prisma translation caveats (T4 finding, 2026-08-10)

**Finding**: The Prisma→MySQL DDL translation is loss-less for 56/59 tables.
The 3 remaining caveats are unavoidable:

1. **`@default(uuid())` / `@default(cuid())` is not DB-generated.** The DDL
   has `NOT NULL` but no DB-side default — application code must generate the
   ID. The previous NestJS service already does this via the Prisma client
   SDK, so behavior is identical. **Action**: Go sqlc queries must also
   generate IDs in application code (Go `uuid.NewString()`).
2. **`@updatedAt` has no DB default.** The DDL has `NOT NULL` but no
   `ON UPDATE CURRENT_TIMESTAMP`. The previous NestJS service updated
   `updated_at` in the application layer. **Action**: Go repository methods
   must explicitly set `updated_at = NOW(3)` on every UPDATE.
3. **`String` without `@db.Text`/`@db.VarChar(n)` is `VARCHAR(191)`**, which
   is Prisma's own default and matches the production DB byte-for-byte. No
   action required.

**Decision (Phase 1 work, not Phase 0)**: The Go repository layer
(`internal/repo/db/`) must enforce these three rules. Add a `repo/`
package-level doc comment when Phase 1 starts.

**Rationale**: These are not bugs in the translation; they are honest
fidelity to how the existing system behaves. The Go side just has to do
the same bookkeeping the Prisma client was doing transparently.

**Consequences**:
- Every `INSERT` generated by sqlc needs an ID-issuing wrapper in `internal/repo/`.
- Every `UPDATE` needs `updated_at` set explicitly.
- A regression test in `test/integration/` should cover: insert without
  pre-set ID should fail; update should bump `updated_at`.

### sqlc named-queries (T4 deliverable, 2026-08-10)

**Finding**: 32 named queries across 5 files (users 6 / courses 5 / orders 6 /
enrollments 5 / auth 10) were generated. The `auth.sql` file is the largest at
10 queries because it must cover email-password, OAuth account lookup, and SSO
session lookup, matching the abstraction in
`apps/api/src/modules/auth/providers/auth-provider.types.ts`.

**Decision (Phase 1)**: The Go-side auth port must consume these 10 auth
queries. They are the contract between `internal/auth/service.go` and the DB;
Phase 1 cannot add new auth tables without first adding the corresponding
sqlc query.

**Consequences**:
- If a Phase 1 endpoint needs a query that is not in the 32 named queries,
  it must be added to `db/queries/*.sql` and `sqlc generate` re-run.
- Tests in `test/integration/auth_*.go` should hit the DB through these
  queries, not through hand-written SQL, to keep parity.
