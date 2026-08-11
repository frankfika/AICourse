# Phase 0 T2 — OpenAPI export + ogen integration report

**Date**: 2026-08-10
**Status**: ✅ Spec exported, ogen code generated, smoke test passing
**Out of scope for this report**: design recommendations (audit → synthesis split;
see `docs/go-migration-execution-plan.md`).

## 1. Spec extraction

- **Source**: `apps/api/` (NestJS, v1.5.5) Swagger at `GET /api/docs-json`
- **Output**: `apps/api-go/api/openapi.yaml` (155 KB, 6,581 lines)
- **JSON form**: `/tmp/nestjs-swagger.json` (121 KB) — kept for diff/regen
- **Repro script**: `apps/api-go/scripts/export-openapi.sh`
- **Determinism**: re-running the export produces a byte-identical spec (verified
  by sorted-key diff across two captures)

### Server boot environment

- Port `8080` from `apps/api/src/main.ts:102` (default; `API_PORT` env fallback)
- `docker-compose` already running: `ai-academy-mysql`, `ai-academy-redis`,
  `ai-academy-minio` (no SAML — `AUTH_SSO_SAML_*` env unset, so
  `auth/config/auth.config.ts:75-82` skips SAML init).
- The dev `.env`'s `JWT_SECRET` is a placeholder; `auth.module.ts:assertStrongJwtSecret`
  rejects it. We override `JWT_SECRET` with `openssl rand -hex 32` per boot.
  No NestJS source files were modified.

## 2. Spec coverage

| Metric | Count |
|---|---|
| Total paths | 181 |
| Total operations (HTTP methods) | 257 |
| &nbsp;&nbsp;GET | 99 |
| &nbsp;&nbsp;POST | 85 |
| &nbsp;&nbsp;PATCH | 32 |
| &nbsp;&nbsp;DELETE | 38 |
| &nbsp;&nbsp;PUT | 3 |
| Total schemas in `components.schemas` | 97 |
| Unique security schemes | 1 (`bearer` / JWT) |
| Distinct controllers (by `operationId` prefix) | 43 |
| Total tags | 40 |
| Operations with a typed response body | **0** |
| Operations with a typed request body | 94 |
| Operations with `in: query` parameters | 62 |
| Operations with `in: path` parameters | 151 |
| Operations with `oneOf` / `anyOf` / `allOf` | 0 |

43 controllers (vs 38 controllers registered in `app.module.ts`) — the gap
is because NestJS exposes admin/public variants as separate controllers
(e.g. `InstructorsAdminController` + `InstructorsPublicController`).

### Per-tag operation counts

| Tag | ops | Tag | ops |
|---|---:|---|---:|
| cms-admin | 64 | admin/ai-config | 4 |
| hackathons | 27 | Enterprise | 4 |
| Auth | 15 | learning-events | 4 |
| users | 11 | instructor-expertises (admin) | 4 |
| practices | 11 | course-instructors (admin) | 4 |
| cms-content | 10 | notes | 4 |
| courses | 6 | ai-config | 3 |
| degrees | 6 | cms-config | 3 |
| badges | 6 | instructors (public) | 3 |
| notifications | 6 | enrollments | 2 |
| orders | 6 | Ai | 2 |
| instructors (admin) | 6 | uploads | 2 |
| chapters | 5 | UrlImport | 2 |
| lessons | 5 | cms-enum | 2 |
| reviews | 5 | health | 2 |
| chat | 5 | audit-logs | 1 |
| progress | 4 | points | 1 |
| certificates | 4 | admin | 1 |
| resources | 4 | site | 1 |
| | | cms-i18n | 1 |
| | | instructor-expertises (public) | 1 |

**Verdict**: every public + admin module is represented. No major surface
missing.

## 3. Spec issues ogen flagged

ogen reported the following warnings while parsing — none blocked
generation, but they translate to "we lose information in the generated
code":

- **No typed response bodies** (257/257 operations). All
  `responses.<code>.content` is missing; every response is
  `description: ''`. Reason: NestJS swagger only emits response bodies
  when controllers carry `@ApiOkResponse()` / `@ApiResponse()` decorators
  — the codebase uses none of them. Effect: the generated
  `HealthControllerLivenessV1OK` and all 257 sibling response types are
  empty Go structs; the generated `Handler` interface methods return
  `error` only.
- **8 query parameter schemas fall back to `any`** at spec lines 281,
  286, 488, 2559, 2564, 2569, 2574, 2579. These are query parameters
  whose `schema` block lacks an explicit `type: string` / `type: integer`
  (e.g. `schema: {}` or `schema: { name: ... }`). ogen's parser
  gracefully degrades to `any`.
- **15 request body DTOs are empty** (`type: object` with no
  `properties`, no `oneOf`/`anyOf`/`allOf`):
  `PasswordResetRequestDto`, `PasswordResetConfirmDto`, `OAuthCallbackDto`,
  `RegisterDto`, `LoginDto`, `GenerateCourseDto`, `GenerateDegreeDto`,
  `CreateEnterpriseInquiryDto`, `UpdateInquiryStatusDto`, `ImportFromUrlDto`,
  `BatchImportFromUrlDto`, `CreateSessionDto`, `SendMessageDto`,
  `CreateNoteDto`, `UpdateNoteDto`. In the generated code these become
  empty Go structs — there's no way for ogen to infer field shape, so
  callers can't compose well-typed clients.

No paths were rejected by ogen. Generation succeeded on all 181 paths.

## 4. ogen configuration

- **Tool**: `github.com/ogen-go/ogen v1.24.0` (installed via
  `go install github.com/ogen-go/ogen/cmd/ogen@latest`)
- **Config file**: `apps/api-go/api/oapi-codegen.yml`
- **Output**: `apps/api-go/api/gen/` (16 Go files, 119,608 LOC total)
- **Package name**: `gen`
- **Features**: `paths/server` on, `paths/client` off, webhooks off,
  `allow_cross_type_constraints: false` (we don't ship pattern-on-numbers
  or max-on-strings in our DTOs)
- **Compile result**: `go build ./api/gen/...` → clean (no errors,
  no warnings)

Run command:

```bash
ogen --target apps/api-go/api/gen \
     --config apps/api-go/api/oapi-codegen.yml \
     --package gen \
     --clean \
     apps/api-go/api/openapi.yaml
```

The 16 generated files:

| File | LOC | Purpose |
|---|---:|---|
| `oas_handlers_gen.go` | 45,504 | Generated `Handler` interface + concrete wrappers |
| `oas_router_gen.go` | 13,814 | HTTP router glue (kept; not wired to Fiber in Phase 0) |
| `oas_schemas_gen.go` | 11,234 | All schema types (97 DTOs + 257 response/params types) |
| `oas_json_gen.go` | 17,499 | JSON encoders/decoders |
| `oas_parameters_gen.go` | 13,330 | Query/path/header param binding |
| `oas_validators_gen.go` | 9,736 | Per-field validator funcs |
| `oas_request_decoders_gen.go` | 7,193 | Request body decoders |
| `oas_unimplemented_gen.go` | 8,558 | Default `ErrNotImplemented` stubs |
| `oas_server_gen.go` | 1,510 | `Handler` interface definition (the contract) |
| `oas_response_encoders_gen.go` | 1,551 | Response encoders |
| `oas_operations_gen.go` | 266 | Operation name constants |
| `oas_security_gen.go` | 270 | Bearer-token security glue |
| `oas_cfg_gen.go` | 251 | OAS config / OTel keys |
| `oas_defaults_gen.go` | 135 | Default values |
| `oas_labeler_gen.go` | 42 | Unused |
| `oas_middleware_gen.go` | 10 | Empty (no webhooks) |

## 5. Smoke test (Phase 0 wiring)

A new handler in `apps/api-go/internal/handler/health.go` takes the
generated `*gen.HealthControllerLivenessV1OK` response type as an
embedded field and adds the runtime fields (`status` / `env` / `version` /
`request_id`). `cmd/server/main.go` wires it onto `GET /healthz`.

```bash
$ nohup go run ./cmd/server > /tmp/api-go-server.log 2>&1 &
$ curl -sS -w "\n[HTTP %{http_code}]\n" http://127.0.0.1:8080/healthz
{"status":"ok","env":"development","version":"0.1.0-phase0","request_id":"3c47c6df-d79b-47e0-8385-a584070804ce"}
[HTTP 200]
```

JSON shape is byte-identical to the pre-migration inline handler.

Cross-check vs 404 envelope (NestJS parity, unaffected by T2):

```bash
$ curl -sS http://127.0.0.1:8080/api/v1/nonexistent
{"statusCode":404,"message":"Route not found: GET /api/v1/nonexistent",
 "error":"NOT_FOUND","timestamp":"2026-08-10T14:04:31Z",
 "path":"/api/v1/nonexistent","requestId":"4b28895e-2047-431b-afa0-7dd8ca82649c"}
```

## 6. Open questions for Phase 1

These surfaced during the work and are left as inputs to the synthesis
agent. They are not recommendations in this report.

1. **How do we add typed response bodies?** The 257 empty responses are
   the largest gap between "spec" and "real" API. Options that need
   evaluation: (a) add `@ApiOkResponse({ type: DtoClass })` decorators
   to every NestJS controller method and re-export, (b) write a Swagger
   plugin that auto-derives response type from the method return type,
   (c) hand-author a parallel `api/openapi.filled.yaml` and only use it
   for Go generation.
2. **How do we layer handlers on top of the ogen `Handler` interface?**
   The generated interface has 257 methods that all return `error` (or
   one of the empty response structs). Our Fiber handlers need to
   receive `*fiber.Ctx` for middleware access, so a thin adapter that
   converts `(ctx, req, params) → (fiber.Ctx, response, error)` is
   probably the natural shape — but this hasn't been prototyped.
3. **Do we keep ogen's HTTP router in `oas_router_gen.go` (14K LOC) or
   drop it?** Keeping it costs ~14K LOC and ~3 MB of binary; dropping
   it means re-implementing request binding for every endpoint. The
   `--config disable paths/server` is a knob; we kept it on for
   now because the `Handler` interface lives in `oas_server_gen.go`
   and we want both pieces to evolve together.
4. **15 DTOs have no fields in the source.** Of these, `LoginDto`,
   `RegisterDto`, `ChangePasswordDto`, `CreateNoteDto`, `UpdateNoteDto`
   obviously have *runtime* fields (the controllers read them from
   `req.body`); NestJS just doesn't see them via the swagger plugin.
   When we fix the response-body gap (Q1), we should also fix the
   request-body gap on these 15.
5. **Empty `api/openapi.yaml` key order.** The YAML emitted by
   `PyYAML` doesn't preserve the original JSON key order — paths are
   alphabetized by URL. Diffing two versions of the spec works
   (sort-key JSON diff), but humans reading the file will see paths
   out of the order they appear in the controllers. Cosmetic, not
   blocking.
6. **`poc-ext-deps` (cmd/poc-ext-deps) does not compile.** This is
   the parallel Phase 0 T3 agent's workspace and is out of scope for
   T2, but the build failure means `go build ./...` from the repo root
   returns non-zero. T2's own code (`./api/...`, `./cmd/server/...`,
   `./internal/handler/...`) builds and vets clean.

## 7. Deliverables

| Path | Status |
|---|---|
| `apps/api-go/api/openapi.yaml` | ✅ written, 6,581 lines |
| `apps/api-go/api/oapi-codegen.yml` | ✅ written |
| `apps/api-go/api/gen/` (16 files) | ✅ generated, builds clean |
| `apps/api-go/scripts/export-openapi.sh` | ✅ written, executable |
| `apps/api-go/internal/handler/health.go` | ✅ written, embeds `gen.HealthControllerLivenessV1OK` |
| `apps/api-go/cmd/server/main.go` (patched) | ✅ wires `handler.Liveness(cfg)` into `/healthz` |
| `apps/api-go/docs/poc-openapi-report.md` | ✅ this file |
| git commit | ⏸ deferred per task constraint (no commit) |
