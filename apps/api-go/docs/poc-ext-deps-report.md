# Phase 0 external dependency PoC report

**Date**: 2026-08-10
**Scope**: prove 4 Go SDKs can replace the Node SDKs before committing to a full migration. Single `go run ./cmd/poc-ext-deps` invocation, hermetic (localhost + Stripe test API only).
**Outcome**: 4 pass, 0 fail, 0 skipped (all local services were up: MinIO on 9010, Redis on 6380).

## TL;DR

| # | PoC              | Status | Note |
|---|------------------|--------|------|
| 1 | S3 / MinIO       | PASS   | aws-sdk-go-v2 round-trip + presign + HeadObject all match Node SDK behavior |
| 2 | Redis            | PASS   | go-redis/v9 PING + SET/GET + INCR match ioredis semantics; missing-key returns `redis.Nil` |
| 3 | Stripe           | PASS   | stripe-go/v79 webhook.ConstructEvent does constant-time HMAC-SHA256 verify; tampered payload rejected |
| 4 | SAML             | PASS   | crewjam/saml SP-initiated end-to-end signature verify + attribute extraction works; **3 real parity gaps with `@node-saml/node-saml` v5** (see below) |

Two Phase 1 config-naming fixes are required but neither blocks the migration.

## How to run

```bash
cd apps/api-go
docker-compose up -d minio redis            # from repo root if not already up
go run ./cmd/poc-ext-deps
```

The PoC loads connection settings from `apps/api-go/internal/config` (no hardcoding). Each PoC prints `==[N/4] title==`, intermediate steps, and a final `-> STATUS: note` line. The end of stdout has a 4-line summary and an overall line.

If MinIO/Redis is down, the relevant PoC prints `SKIPPED` with the docker-compose command to start it.

## Per-PoC findings

### [1/4] S3 / MinIO — `github.com/aws/aws-sdk-go-v2/service/s3` — PASS

**What ran**: PutObject + GetObject round-trip (38-byte payload, content-type `text/plain`); `s3.NewPresignClient.PresignGetObject` with 1h expiry; `HeadObject`; cleanup DeleteObject.

**Parity with Node `apps/api/src/modules/uploads/storage/s3-storage.service.ts`**:
- `forcePathStyle: true` → required for MinIO; same as Node SDK config.
- Presign URL contains `X-Amz-Signature=...&X-Amz-Expires=3600` → matches Node's `getSignedUrl(client, new GetObjectCommand(...), { expiresIn: 3600 })`.
- HeadObject returns `ContentLength` + `ContentType` → same fields Node reads in `headObject()`.
- Bucket auto-create on first run mirrors the lazy-init Node does via `OnModuleInit`.

**Note (not a parity gap, but worth recording)**: the AWS SDK v2 trailing-checksum middleware requires the request body to be `io.ReadSeeker`. We use `bytes.NewReader(payload)` — equivalent in spirit to what the Node SDK does because the Node SDK uses native streams. Phase 1 service code should always pass a `*bytes.Reader` or `*os.File` to `PutObject`, never a raw `[]byte` cast to `io.Reader`.

**Config alignment**: `apps/api-go/internal/config` already ships defaults that match the live `docker-compose` (`S3_ENDPOINT=http://127.0.0.1:9010`, `S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin`, `S3_BUCKET=ai-academy`). The PoC ran successfully against the live MinIO with no env overrides.

### [2/4] Redis — `github.com/redis/go-redis/v9` — PASS

**What ran**: `PING` → `PONG`; `SET key val EX 60` + `GET` + `TTL`; `INCR` (3 times to verify monotonic counter); negative `GET` of a non-existent key.

**Parity with Node (`apps/api/src/common/redis/redis.service.ts` + `@nest-lab/throttler-storage-redis`)**:
- `rdb.Ping(ctx).Result()` → `"PONG"` matches Node's `client.ping() === "PONG"`.
- `Set(ctx, key, val, 60s)` returns no error → matches `client.set(key, val, 'EX', 60)`.
- `Incr(ctx, key)` returns int64 → matches `client.incr(key)` used by `ThrottlerStorageRedisService` internally.
- `rdb.Get(ctx, missing).Result()` returns `redis.Nil` → ioredis returns `null`. Both are typed `error` in Go; both should be checked with `errors.Is(err, redis.Nil)`.

**What needs Phase 1 work (not a blocker)**: the Node app uses `ThrottlerStorageRedisService` from `@nest-lab/throttler-storage-redis`, which is a drop-in throttler storage. The Go side has no equivalent — Phase 1 should build a small rate-limit middleware (~50 LoC) that wraps `go-redis` with the same `INCR + EXPIRE` pattern. The PoC confirms the primitives work.

### [3/4] Stripe — `github.com/stripe/stripe-go/v79` — PASS

**What ran**: build a `PaymentIntentParams` and serialize it via the same `form.Values` encoder the SDK uses internally; synthesize a `payment_intent.succeeded` webhook event; compute `Stripe-Signature: t=<ts>,v1=<hex(hmac-sha256(secret, "<ts>.<body>"))>`; call `webhook.ConstructEventWithOptions` (constant-time compare, `IgnoreAPIVersionMismatch` so synthesized payloads without `api_version` work); tampered-payload negative test.

**Parity with Node `stripe@17`**:
- Same v1 signature scheme (`t=...,v1=...`).
- Same `stripe.webhooks.constructEvent` semantics: HMAC-SHA256, constant-time compare, returns an `Event` struct on success and an `Error` on tampered payload / wrong signature.
- `paymentintent.New()` is the package-level equivalent of Node's `stripe.paymentIntents.create(params)`.
- Form-encoder output for `PaymentIntentParams`:
  ```
  amount=2000&automatic_payment_methods[enabled]=true&currency=usd&metadata[orderId]=...&metadata[userId]=...
  ```
  is what the SDK POSTs to `https://api.stripe.com/v1/payment_intents` (we did not hit the network).

**Phase 1 work (not a blocker, not parity-critical)**: the Node service has not yet wired Stripe webhooks (see comment at `apps/api/src/modules/orders/orders.service.ts:352` — "P1-6 Stripe webhook 接入后改用 async refund"). When Phase 1 T13 lands, the Go side can drop in `webhook.ConstructEvent` with the same `STRIPE_WEBHOOK_SECRET` env var.

**Config env-var name mismatch (not a parity gap, just naming)**:
- Go config: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` (`internal/config/config.go:31-32`).
- Node `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- The PoC reads both, so either works, but the project should pick one. Recommendation: align Go to the Node names (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and update `internal/config` defaults. Tracking: Phase 1 T6.

### [4/4] SAML — `github.com/crewjam/saml` — PASS (with 3 documented parity gaps)

**What ran**:
- Generated a self-signed RSA-2048 cert via `openssl req -x509 ... -subj /CN=poc-idp` (cached in `os.MkdirTemp`).
- Built an `saml.EntityDescriptor` IdP metadata descriptor manually (cert + SSO endpoints).
- Built an `samlsp.Middleware` SP (`samlsp.New`) pointing at that IdP metadata.
- SP called `MakeAuthenticationRequest` → got a real `saml.AuthnRequest` with a populated `ID`.
- Built a low-level `saml.IdpAuthnRequest` directly (same struct `samlidp.Server` uses internally), populated an `saml.Session`, called `saml.DefaultAssertionMaker{}.MakeAssertion` and `idpReq.MakeResponse()` → got a real RSA-SHA256-signed SAML Response.
- Posted the signed XML back to `sp.ServiceProvider.ParseResponse` via a synthetic `*http.Request` with `PostForm["SAMLResponse"]`. Verification succeeded; assertion was extracted with NameID + 7 attributes.
- The default attribute names emitted by `DefaultAssertionMaker` are OID-style (`urn:oid:1.3.6.1.4.1.5923.1.1.1.6` for email etc.), not friendly names like `User.email`. The PoC finds the email by scanning for the value containing `@`.

**Parity with Node `@node-saml/node-saml` v5 (apps/api/src/modules/auth/providers/sso.provider.ts)**:

| # | Topic | Node | Go (crewjam) | Verdict |
|---|-------|------|--------------|---------|
| a | Default signature algorithm | RSA-SHA256 | RSA-SHA256 | ✅ identical |
| b | NameID format handling | transient / emailAddress / persistent | transient / emailAddress / persistent | ✅ identical |
| c | Attribute extraction | returns flat `profile` object; auto-extracts `email` from 3 claim names (`email`, `mail`, `http://schemas.xmlsoap.org/.../emailaddress`) | returns flat `[]AttributeStatement` with OID or string-name attributes; app must map | ⚠️ **adapter needed** |
| d | IdP trust config | single `idpCert: string` parameter | requires full `*saml.EntityDescriptor` (cert + SSO endpoint + NameID formats) | ⚠️ **config schema change** |
| e | WantAssertionsSigned / WantAuthnResponseSigned | both configurable independently | `crewjam` does not expose `WantAuthnResponseSigned` separately; if IdP has a signing cert, Response is always signed. WantAssertionsSigned default is true. | ⚠️ **behavioural diff, but stronger (always signs)** |

**(c) detail**: the Node code does `profile.email ?? profile.mail ?? profile['http://schemas.../emailaddress']`. The Go code has no such helper — Phase 1 T6 needs a ~30 LoC adapter in `apps/api-go/internal/auth/saml/attrs.go` that walks `assertion.AttributeStatements[*].Attributes` and matches on `Name` (e.g. `"email"`, `"mail"`, `"urn:oid:0.9.2342.19200300.100.1.3"`) and on the OID-derived friendly names. This is mechanical, not a blocker.

**(d) detail**: `apps/api-go/internal/config` exposes `SAMLEntityID`, `SAMLCert`, `SAMLKey` as raw strings. The Node SDK accepts just `cert`. The Go SDK wants the IdP metadata XML (or a URL to fetch it from). Phase 1 T6 should:
- Replace `SAMLCert` with `SAMLIdPMetadataURL` (or `SAMLIdPMetadataXML`).
- Drop `SAMLEntityID` — it's part of the IdP metadata.
- On boot, fetch+parse the metadata, build `saml.EntityDescriptor`, store it in the service struct.

**(e) detail**: Node's `wantAuthnResponseSigned: true` is honored — if the IdP doesn't sign the Response, Node throws. The Go SDK signs the Response whenever the IdP has a signing key (which any real IdP does). Result: Go is strictly stricter than Node here, which is desirable. The current Node `SsoProvider` (`apps/api/src/modules/auth/providers/sso.provider.ts:42-43`) sets both flags to `true`; the Go equivalent will be at least as secure by default.

**Encryption gap (intentionally not tested)**: `@node-saml/node-saml` supports encrypted assertions/responses (e.g. Okta's "Encrypted Assertions" config). `crewjam/saml` does support `EncryptedAssertion` (via `saml/xmlenc`) but the API surface for it is less ergonomic. None of our current IdP integrations use assertion encryption, so we recommend deferring this parity check until a real IdP is onboarded. **Flag this in the Phase 1 SSO spike design doc.**

## Configuration observations (not SDK gaps)

These are discrepancies between `apps/api-go/internal/config` and the live `.env`/`docker-compose`. They are Phase 1 fix-ups, not migration blockers — but they would surface immediately during integration tests.

1. **Godotenv scope is CWD-bound**: `internal/config/config.go:41` calls `godotenv.Load()` with no path, so it only finds `.env` in the process's current working directory. Running `go run ./cmd/poc-ext-deps` from `apps/api-go/` loads no `.env`; the defaults take effect. Running from the repo root would load `/.env` and override `REDIS_PORT`, `MYSQL_PORT`, etc. Phase 1 should walk up to the repo root, or document that `.env` must live in `apps/api-go/`.

2. **S3 env-var names already aligned** (the original plan had `MINIO_*` and `S3_*` mixed; the current `internal/config/config.go` defaults are `S3_ENDPOINT=http://127.0.0.1:9010`, `S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin`, `S3_BUCKET=ai-academy`, which match the live `docker-compose` published ports + creds). No fix needed.

3. **Stripe env-var name mismatch**: see PoC #3 above. One-line fix in `internal/config/config.go` to rename `STRIPE_SECRET` → `STRIPE_SECRET_KEY` (or accept both in `viper`).

4. **SAML env-var schema needs rework**: see PoC #4 (d) above. Replace `SAMLEntityID / SAMLCert / SAMLKey` with `SAMLIdPMetadataURL` (or `_XML`) + `SAMLEntityID` for the SP side. Phase 1 T6.

## Blockers for Phase 1

None of the four PoCs blocked the migration in the strict sense — every SDK can do the job. The two real items that Phase 1 must address before the SSO module is mergeable are:

- **(B1)** SAML attribute-mapping adapter (the crewjam `AttributeStatements` → Node `AuthIdentity` shape). ~30 LoC, mechanical, no decisions needed.
- **(B2)** SAML config schema: replace `SAMLCert` with `SAMLIdPMetadataURL`/`_XML`. Required because `crewjam/saml` cannot trust an IdP from a raw cert string the way `node-saml` can.

The other items (Stripe env-var rename, godotenv CWD scoping, samlidp encryption parity) are quality-of-life, not blockers.

## Files added

- `apps/api-go/cmd/poc-ext-deps/main.go` — single-file PoC runner, ~840 LoC.
- `apps/api-go/docs/poc-ext-deps-report.md` — this file.
- `go.mod` / `go.sum` — added: `aws-sdk-go-v2`, `aws-sdk-go-v2/config`, `aws-sdk-go-v2/credentials`, `aws-sdk-go-v2/service/s3`, `aws/smithy-go`, `beevik/etree`, `crewjam/saml`, `crewjam/saml/samlsp`, `redis/go-redis/v9`, `stripe/stripe-go/v79`, `stripe/stripe-go/v79/form`, `stripe/stripe-go/v79/paymentintent`, `stripe/stripe-go/v79/webhook`, and their transitive deps.

No files in `apps/api/` were touched. No files in `apps/api-go/internal/`, `apps/api-go/cmd/server/`, or `apps/api-go/Dockerfile` were modified.
