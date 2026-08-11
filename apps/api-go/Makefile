# apps/api-go Makefile
#
# Conventions:
#   make help          — list targets
#   make test          — full suite (e2e + integration, requires Docker)
#   make test-fast     — unit + e2e only (no MySQL container)
#   make build         — distroless static binary
#   make run           — run the API locally
#   make lint          — go vet + gofmt
#   make db-verify     — apply db/migrations/0001_init.sql to a scratch DB
#   make openapi-export — re-export openapi.yaml from running NestJS
#   make schema-diff   — compare NestJS Prisma schema vs Go DDL
#
# Phase 0+ only. Phase 1+ adds sqlc/ogen/db targets as the toolchain lands.

.PHONY: help test test-fast build run lint db-verify openapi-export schema-diff clean

GO            ?= go
GOFLAGS       ?= -trimpath
LDFLAGS       ?= -s -w
BIN_DIR       ?= bin
SERVER_BIN    ?= $(BIN_DIR)/server
APP_VERSION   ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
MYSQL_HOST    ?= 127.0.0.1
MYSQL_PORT    ?= 3307
MYSQL_USER    ?= root
MYSQL_PASS    ?= ai_academy_root

help: ## list available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

test: ## run full test suite (e2e + integration, needs Docker)
	$(GO) test -race -count=1 ./test/...

test-fast: ## unit + e2e only, no MySQL container
	$(GO) test -race -count=1 ./internal/... ./test/e2e/...

test-coverage: ## coverage report (Phase 1+ gate: 70%)
	$(GO) test -count=1 -coverprofile=coverage.out -covermode=atomic ./internal/... ./test/...
	$(GO) tool cover -func=coverage.out | tail -1
	$(GO) tool cover -html=coverage.out -o coverage.html

build: ## build distroless static binary
	mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	  $(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o $(SERVER_BIN) ./cmd/server
	@ls -lh $(SERVER_BIN)

run: ## run the API locally (uses .env)
	$(GO) run ./cmd/server

lint: ## go vet + gofmt
	$(GO) vet ./cmd/server ./internal/... ./test/...
	@test -z "$$(gofmt -l ./cmd ./internal ./test)" || (echo "gofmt diff:" && gofmt -d ./cmd ./internal ./test && exit 1)

db-verify: ## apply db/migrations/0001_init.sql to a scratch DB
	@docker run --rm -i --network host -v "$(PWD)/db/migrations/0001_init.sql:/tmp/0001.sql" \
	  mysql:8.0 sh -c "until mysqladmin ping -h $(MYSQL_HOST) -P $(MYSQL_PORT) -u$(MYSQL_USER) -p$(MYSQL_PASS) --silent 2>/dev/null; do sleep 1; done && \
	  mysql -h $(MYSQL_HOST) -P $(MYSQL_PORT) -u$(MYSQL_USER) -p$(MYSQL_PASS) -e 'DROP DATABASE IF EXISTS aicourse_schema_verify; CREATE DATABASE aicourse_schema_verify;' && \
	  mysql -h $(MYSQL_HOST) -P $(MYSQL_PORT) -u$(MYSQL_USER) -p$(MYSQL_PASS) aicourse_schema_verify < /tmp/0001.sql && \
	  echo 'Tables created:' && mysql -h $(MYSQL_HOST) -P $(MYSQL_PORT) -u$(MYSQL_USER) -p$(MYSQL_PASS) aicourse_schema_verify -e 'SHOW TABLES;' | tail -n +2 | wc -l"

openapi-export: ## re-export openapi.yaml from the running NestJS API
	@API_PORT=$$(grep '^API_PORT=' ../../apps/api/.env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]'); \
	 API_PORT=$${API_PORT:-3000}; \
	 curl -fsS "http://127.0.0.1:$${API_PORT}/api/docs-json" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" > api/openapi.json && \
	 python3 -c "import json,sys; spec=json.load(open('api/openapi.json')); import yaml; print(yaml.safe_dump(spec, sort_keys=False, allow_unicode=True))" > api/openapi.yaml && \
	 echo "Exported $$(grep -c '^  /api/' api/openapi.yaml) paths to api/openapi.yaml"

schema-diff: ## compare NestJS Prisma schema vs Go DDL (counts only — visual diff in db/docs/schema-diff.md)
	@echo "Prisma models:  $$(grep -c '^model' ../../prisma/schema.prisma)"
	@echo "Prisma enums:   $$(grep -c '^enum' ../../prisma/schema.prisma)"
	@echo "Go DDL tables:  $$(grep -c 'CREATE TABLE' db/schema.sql)"
	@echo "Go DDL enums:   $$(grep -cE 'ENUM\\(' db/schema.sql)"
	@echo "Go migration:   $$(ls db/migrations/*.sql | head -1)"

clean: ## remove build artifacts
	rm -rf $(BIN_DIR) coverage.out coverage.html
