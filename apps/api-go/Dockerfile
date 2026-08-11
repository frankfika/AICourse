# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for apps/api-go.
# Final image is distroless/static — no shell, no package manager,
# scratch + ca-certificates + tzdata only. Target: < 50MB.

# ---- Stage 1: build ----
FROM golang:1.23-bookworm AS build

WORKDIR /src

# Cache go.mod/go.sum first.
COPY apps/api-go/go.mod apps/api-go/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Build static binary.
COPY apps/api-go/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- Stage 2: runtime ----
FROM gcr.io/distroless/static-debian12:nonroot AS api-go

COPY --from=build /out/server /usr/local/bin/server

EXPOSE 8080 9090
USER nonroot:nonroot

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8080 \
    METRICS_PORT=9090

ENTRYPOINT ["/usr/local/bin/server"]
