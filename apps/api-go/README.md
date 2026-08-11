# apps/api-go — AI Academy API (Go rewrite)

**Status**: Phase 0 skeleton (2026-08-10). Decision log in `docs/go-migration-execution-plan.md`.

## What this is

The NestJS/TypeScript backend at `apps/api/` is being migrated to Go. This directory
hosts the new implementation. The migration uses an **OpenAPI-first + Strangler Fig**
path so the public surface (HTTP routes, error envelope) stays 1:1 compatible until
the gateway flips traffic.

## Stack

- **HTTP**: Fiber v2 (Express-style, minimal migration friction from the previous NestJS)
- **Validation**: `go-playground/validator/v10` (replaces `class-validator` + `zod`)
- **Logging**: `go.uber.org/zap` (structured JSON in prod, console in dev)
- **Config**: `viper` + `joho/godotenv` (drop-in `.env` compatibility)
- **Auth**: `golang-jwt/jwt/v5` (phase 1)
- **SAML**: `crewjam/saml` (phase 0 POC, see below)
- **DB**: `sqlc` + `go-migrate` + `ariga/atlas` (phase 0 schema migration)
- **Cache / rate limit**: `redis/go-redis/v9` (phase 1)
- **Object storage**: `aws-sdk-go-v2` (S3 / MinIO compatible)
- **Payments**: `stripe/stripe-go`
- **Metrics**: `prometheus/client_golang` on a separate listener (port 9090)
- **Runtime**: `gcr.io/distroless/static-debian12:nonroot`, target image < 50MB

## Layout

```
apps/api-go/
├── cmd/server/        — main entry, wires config + logger + fiber + middleware
├── internal/
│   ├── config/        — env loading, .env compatibility
│   ├── errs/          — global error handler, NestJS-compatible JSON envelope
│   ├── logger/        — zap setup
│   ├── metrics/       — Prometheus collectors (scaffold; phase 1 adds HTTP/db/redis)
│   ├── middleware/    — reserved
│   ├── handler/       — HTTP handlers (phase 1+)
│   ├── service/       — business logic (phase 1+)
│   ├── repo/          — sqlc-generated query layer (phase 0 T4)
│   ├── model/         — domain types (phase 0 T4)
│   └── validator/     — go-playground/validator wrappers (phase 1)
├── db/
│   ├── migrations/    — atlas / go-migrate SQL files (phase 0 T4)
│   └── queries/       — sqlc .sql files (phase 0 T4)
├── api/               — OpenAPI 3.0 spec + ogen-generated code (phase 0 T2)
├── test/              — dockertest-based e2e (phase 0 T5)
├── scripts/           — one-shot scripts (openapi export, schema diff, etc.)
├── Dockerfile         — multi-stage, distroless/static final image
└── README.md
```

## Run locally (Phase 0)

Prereqs: Go 1.23+, the same `.env` from `apps/api/.env` (we load the same vars).

```bash
cd apps/api-go
go run ./cmd/server
# In another terminal:
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/readyz
curl http://127.0.0.1:9090/metrics
```

## Endpoints shipped in Phase 0

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness probe + version + request_id |
| GET | `/readyz` | Readiness (Phase 0: trivially ready) |
| GET | `/metrics` | Prometheus scrape (separate listener, port 9090) |
| ANY | unmatched | 404 with NestJS-shaped envelope |

## Error contract (NestJS parity)

Every error response is JSON with this shape (matches `AllExceptionsFilter`):

```json
{
  "statusCode": 404,
  "message": "Route not found: GET /api/v1/foo",
  "error": "NOT_FOUND",
  "timestamp": "2026-08-10T13:52:47Z",
  "path": "/api/v1/foo",
  "requestId": "7796a26c-9aac-487c-822b-2f60c1e646e8"
}
```

## What's next

- **T2** — Export OpenAPI 3.0 spec from NestJS, drop into `api/openapi.yaml`, generate Go server stubs via ogen.
- **T3** — POCs for S3 / Redis / Stripe / SAML using the chosen Go SDKs.
- **T4** — Translate Prisma schema to SQL DDL, run sqlc, validate first 5 models against live MySQL.
- **T5** — Testing harness (testify + dockertest), first e2e on auth/login.

See `docs/go-migration-execution-plan.md` for the full phase plan.
