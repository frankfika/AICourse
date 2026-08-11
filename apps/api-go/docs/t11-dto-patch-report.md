# T11 — DTO patch + OpenAPI re-export + ogen regen report

**Date**: 2026-08-11
**Phase**: 1 / T11 (parallel branch of 3 agents)
**Owner**: Agent 1 (General)

## 1. DTO patch applied — ✅

File: `apps/api/src/modules/auth/auth.dto.ts`

All 5 DTO classes received `@ApiProperty()` decorators on every field:

| DTO | Fields decorated | Field names |
|---|---|---|
| `RegisterDto` | 3/3 | `email`, `password`, `name` |
| `LoginDto` | 2/2 | `email`, `password` |
| `OAuthCallbackDto` | 2/2 | `code`, `state` |
| `PasswordResetRequestDto` | 1/1 | `email` |
| `PasswordResetConfirmDto` | 2/2 | `token`, `newPassword` |

**Total**: 10 fields decorated. Each `@ApiProperty` carries `description`, and where the field has a class-validator bound (`@IsEmail`, `@MinLength`, `@MaxLength`), the matching `example` / `minLength` / `maxLength` was added to the decorator so OpenAPI emits a typed `properties` block.

## 2. Spec diff summary — ✅ exactly 5 schemas, no surprises

Diff against Phase 0 baseline (`apps/api-go/api/openapi.yaml`):

```diff
4643c4643,4650
<       properties: {}
---
>       properties:
>         email:
>           type: string
>           description: Account email to send the reset link to
>           example: user@example.com
>           maxLength: 320
>       required:
>       - email
4646c4653,4667
<       properties: {}
---
>       properties:
>         token: ...
>         newPassword: ...
>       required:
>       - token
>       - newPassword
4649c4670,4683
<       properties: {}
---
>       properties:
>         code: ...
>         state: ...
>       required:
>         ...
4652c4686,4706
<       properties: {}
---
>       properties:
>         email: ...
>         password: ...
>         name: ...
>       required:
>         ...
4655c4709,4720
<       properties: {}
---
>       properties:
>         email: ...
>         password: ...
>       required:
>         ...
6581a6647
>
```

**What changed (87 diff lines total):**
- `PasswordResetRequestDto`: `properties: {}` → 1 typed field (`email`) + `required: [email]`
- `PasswordResetConfirmDto`: `properties: {}` → 2 typed fields (`token`, `newPassword`) + `required: [token, newPassword]`
- `OAuthCallbackDto`: `properties: {}` → 2 typed fields (`code`, `state`) + `required: [code, state]`
- `RegisterDto`: `properties: {}` → 3 typed fields (`email`, `password`, `name`) + `required: [email, password, name]`
- `LoginDto`: `properties: {}` → 2 typed fields (`email`, `password`) + `required: [email, password]`
- 1 trailing newline added (benign `yaml.dump` artifact, stripped from final `openapi.yaml`)

**No unexpected changes**: all 257 response types, 181 paths, 8 `any`-fallback query params, and the other 92 schemas are byte-identical to the Phase 0 baseline.

## 3. ogen regen — ✅ success

Command run (from `apps/api-go`):
```bash
~/go/bin/ogen --target ./api/gen \
     --config ./api/oapi-codegen.yml \
     --package gen \
     --clean \
     ./api/openapi.yaml
```

**Files touched (16 files in `apps/api-go/api/gen/`, regenerated clean via `--clean`):**
- `oas_schemas_gen.go` — main impact: 5 DTO structs went from empty `struct{}` to typed structs with `Email`/`Password`/`Name`/`Code`/`State`/`Token`/`NewPassword` fields plus getter/setter methods
- All other 15 files (`oas_handlers_gen.go`, `oas_router_gen.go`, `oas_json_gen.go`, `oas_parameters_gen.go`, `oas_validators_gen.go`, `oas_request_decoders_gen.go`, `oas_response_encoders_gen.go`, `oas_server_gen.go`, `oas_operations_gen.go`, `oas_security_gen.go`, `oas_cfg_gen.go`, `oas_defaults_gen.go`, `oas_labeler_gen.go`, `oas_unimplemented_gen.go`, `oas_middleware_gen.go`) — regenerated, content byte-different due to internal ogen version-stamps but functionally unchanged (the spec diff is contained to schemas only)

**ogen warnings (8, all pre-existing per T2 report)**: query params falling back to `any` (`CoursesControllerFindAllV1Search`, `ReviewsControllerFindAllV1OnlyDeleted/Rating/CourseId/Limit/Page`, `UsersControllerFindAllV1Limit/Page`). These are Phase 2 follow-ups; nothing new from this patch.

**Spot-check of generated types** (`api/gen/oas_schemas_gen.go`):
```go
// Ref: #/components/schemas/RegisterDto
type RegisterDto struct {
    // User email, must be RFC 5321 compliant.
    Email string `json:"email"`
    // Password, 12-128 chars, must include uppercase, lowercase, digit, and symbol.
    Password string `json:"password"`
    // Display name shown in UI.
    Name string `json:"name"`
}

// Ref: #/components/schemas/LoginDto
type LoginDto struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

// Ref: #/components/schemas/OAuthCallbackDto
type OAuthCallbackDto struct {
    Code  string `json:"code"`
    State string `json:"state"`
}

// Ref: #/components/schemas/PasswordResetRequestDto
type PasswordResetRequestDto struct {
    Email string `json:"email"`
}

// Ref: #/components/schemas/PasswordResetConfirmDto
type PasswordResetConfirmDto struct {
    Token       string `json:"token"`
    NewPassword string `json:"newPassword"`
}
```

## 4. Go build — ✅ pass

```bash
go build ./...
# (no output = success)
```

Also clean: `go vet ./...` (no warnings) and `gofmt -l ./api/gen` (no diffs).

## 5. Tests — ✅ all pass

```bash
make test
# e2e:        4/4 PASS
# integration: 5/5 PASS
```

**e2e** (`apps/api-go/test/e2e`):
1. `TestHealthz_Success`
2. `TestReadyz_Success`
3. `TestNotFound_HasCanonicalEnvelope`
4. `TestRequestIDPropagation`

**integration** (`apps/api-go/test/integration`):
1. `TestHealthz_PingsDB`
2. `TestReadyz_PingsDB`
3. `TestUsers_CRUD_HappyPath`
4. `TestUsers_GetMissing_NotFoundEnvelope`
5. `TestUsers_PostMissingEmail_BadRequestEnvelope`

**unit** (also run via `go test ./...`):
- `internal/auth` ✅
- `internal/config` ✅
- `internal/errs` ✅

No regressions.

## 6. Blockers / follow-ups for the other 2 agents (T7/T9, T8)

The Go side now has 5 typed request DTOs ready for the auth handler:

| Generated type | Fields | Go package |
|---|---|---|
| `gen.RegisterDto` | `Email`, `Password`, `Name` | `apps/api-go/api/gen` |
| `gen.LoginDto` | `Email`, `Password` | `apps/api-go/api/gen` |
| `gen.OAuthCallbackDto` | `Code`, `State` | `apps/api-go/api/gen` |
| `gen.PasswordResetRequestDto` | `Email` | `apps/api-go/api/gen` |
| `gen.PasswordResetConfirmDto` | `Token`, `NewPassword` | `apps/api-go/api/gen` |

(Note: the Go types inherit the NestJS class names `*Dto`, not `*Request`. The task brief mentioned "RegisterRequest" as an example but the ogen convention preserves the source schema name `RegisterDto`. If T7/T9 want `*Request` aliases, that's a separate follow-up — they should NOT silently rename in handler code without confirming with the orchestrator.)

**What this unblocks:**
- T7/T9 can now write the auth handler with full type safety: `func (h *Handler) RegisterV1(ctx, req *gen.RegisterDto) (*gen.AuthControllerRegisterV1Created, error)` — the request body is decoded/validated by ogen-generated code, not `map[string]any`.
- T8 (write `apps/api-go/test/contract/auth_test.go` if planned) can use the generated types directly as golden fixtures for round-trip tests.

**What this does NOT fix (out of scope for T11):**
- The other 10 empty request DTOs (`GenerateCourseDto`, `CreateNoteDto`, etc.) still emit `properties: {}`. T2 finding remediation tracks those — they block Phase 2/3, not Phase 1 auth.
- The 257 empty response bodies — same as above, separate `@ApiOkResponse` work.
- The 8 `any`-fallback query parameters — Phase 2 follow-up.
