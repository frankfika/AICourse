# T2 finding — DTO `ApiProperty` 装饰器 patch

**Date**: 2026-08-10
**Owner**: Mavis (root orchestrator)
**File to modify**: `apps/api/src/modules/auth/auth.dto.ts`
**Why**: Phase 0 T2 found that 15 NestJS DTOs emit empty `{}` in the OpenAPI
spec because they have no `@ApiProperty()` decorators. Without these, ogen
generates empty Go request structs and we lose all compile-time type safety
on the most error-prone surface (login, register, payment, AI generation).

**Action**: Apply the patch below to add `@ApiProperty` to all 4 auth DTOs.
This must be the **first** item in Phase 1 T11, before any Go-side auth
handler is written.

## Patch (apply to `apps/api/src/modules/auth/auth.dto.ts`)

```diff
--- a/apps/api/src/modules/auth/auth.dto.ts
+++ b/apps/api/src/modules/auth/auth.dto.ts
@@ -1,20 +1,55 @@
-import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
+import { ApiProperty } from '@nestjs/swagger';
+import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

 export class RegisterDto {
+  @ApiProperty({
+    description: 'User email, must be RFC 5321 compliant',
+    example: 'user@example.com',
+    maxLength: 320,
+  })
   @IsEmail()
   email: string;

+  @ApiProperty({
+    description: 'Password, 12-128 chars, must include uppercase, lowercase, digit, and symbol',
+    example: 'GoodPass!1234',
+    minLength: 12,
+    maxLength: 128,
+  })
   @IsString()
   @MinLength(12)
   @MaxLength(128)
   @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
     message: '密码必须包含大小写字母、数字和符号',
   })
   password: string;

+  @ApiProperty({
+    description: 'Display name shown in UI',
+    example: '陈大文',
+    maxLength: 120,
+  })
   @IsString()
   name: string;
 }

 export class LoginDto {
+  @ApiProperty({
+    description: 'Registered email',
+    example: 'user@example.com',
+  })
   @IsEmail()
   email: string;

+  @ApiProperty({
+    description: 'Plaintext password (TLS only, never logged)',
+    example: 'GoodPass!1234',
+  })
   @IsString()
   password: string;
 }

 export class OAuthCallbackDto {
+  @ApiProperty({
+    description: 'OAuth2 authorization code from the IdP redirect',
+    minLength: 1,
+    maxLength: 2048,
+  })
   @IsString()
   @MinLength(1)
   @MaxLength(2048)
   code: string;

+  @ApiProperty({
+    description: 'Opaque state token, must match what we issued in the auth URL',
+    minLength: 20,
+    maxLength: 4096,
+  })
   @IsString()
   @MinLength(20)
   @MaxLength(4096)
   state: string;
 }

 export class PasswordResetRequestDto {
+  @ApiProperty({
+    description: 'Account email to send the reset link to',
+    example: 'user@example.com',
+    maxLength: 320,
+  })
   @IsEmail()
   @MaxLength(320)
   email: string;
 }

 export class PasswordResetConfirmDto {
+  @ApiProperty({
+    description: 'Reset token from the email link',
+    minLength: 32,
+    maxLength: 256,
+  })
   @IsString()
   @MinLength(32)
   @MaxLength(256)
   token: string;

+  @ApiProperty({
+    description: 'New password, 12-128 chars, must include uppercase, lowercase, digit, and symbol',
+    example: 'NewPass!5678',
+    minLength: 12,
+    maxLength: 128,
+  })
   @IsString()
   @MinLength(12)
   @MaxLength(128)
   @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
     message: '新密码必须包含大小写字母、数字和符号',
   })
   newPassword: string;
 }
```

## Verification (after applying the patch)

1. **Re-export the spec**:
   ```bash
   cd apps/api
   pnpm install --frozen-lockfile
   pnpm db:generate  # regenerate Prisma client (no schema change but force regeneration)
   pnpm build
   pnpm start &
   curl -s http://127.0.0.1:3000/api/docs-json -o /tmp/new-spec.json
   pkill -f "node dist/src/main"
   ```

2. **Diff against Phase 0 spec** (`apps/api-go/api/openapi.yaml`):
   ```bash
   cd apps/api-go
   # convert new spec to yaml
   python3 -c "import json,yaml; print(yaml.safe_dump(json.load(open('/tmp/new-spec.json')), sort_keys=False))" > /tmp/new-spec.yaml
   diff api/openapi.yaml /tmp/new-spec.yaml | head -50
   ```
   Expected: the 4 auth DTO schemas should now have `properties` blocks.
   The 257 operation responses still have empty bodies (those need separate
   `@ApiOkResponse` decorators; addressed in T2 finding remediation, not T11).

3. **Regenerate Go server types**:
   ```bash
   ogen --target apps/api-go/api/gen --config apps/api-go/api/oapi-codegen.yml \
        --clean apps/api-go/api/openapi.yaml
   go build ./...  # must still compile
   ```

4. **Smoke test**:
   ```bash
   cd apps/api-go
   go run ./cmd/server &
   curl -s -X POST http://127.0.0.1:8080/api/v1/auth/register \
        -H 'Content-Type: application/json' \
        -d '{"email":"test@example.com","password":"GoodPass!1234","name":"Test User"}'
   # Without an actual handler, this returns 404 (route not implemented yet).
   # The important thing is that the request body is now typed Go-side.
   ```

## What this does NOT fix

The 11 other empty DTOs (`GenerateCourseDto`, `CreateNoteDto`, etc.) and
the 257 empty response bodies need separate `@ApiProperty` / `@ApiOkResponse`
work. Those land alongside their parent controller in Phase 1 (auth DTOs
above) and Phase 2/3 (the others).

The 8 query parameters that fall back to `any` (T2 report §3) are a Phase 2
follow-up; they don't block the auth flow.

## Companion work for Phase 1 T6

This patch is one half of T6. The other half is the Go-side abstraction
(`apps/api-go/internal/auth/`) which I have already written (T6 deliverable
done, see `internal/auth/{provider,email_password,oauth,sso,service,config}.go`).
After applying this DTO patch, re-export the spec, regenerate, and the Go
side will have typed `RegisterRequest` / `LoginRequest` / etc. structs ready
for the auth handler (T7).
