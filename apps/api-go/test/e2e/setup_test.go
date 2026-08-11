// Package e2e runs end-to-end tests against a fully wired apps/api-go instance.
//
// Phase 0 scope: in-process Fiber app + httptest client. No external services.
// Phase 1 scope: docker-compose up MySQL/Redis/MinIO + dockertest harness.
package e2e

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// newTestApp returns a Fiber app wired identically to cmd/server/main.go,
// but with relaxed rate limiting so e2e tests don't accidentally trip the limiter.
//
// We deliberately do NOT call main() — the binary's role is to launch the
// server in production. Tests need a deterministic in-process app.
func newTestApp(t *testing.T) *fiber.App {
	t.Helper()

	// Note: t.Setenv() cannot be combined with t.Parallel() (Go 1.22+).
	// The package-wide TestMain below sets the env once.

	cfg, err := config.Load()
	require.NoError(t, err, "config must load in test mode")

	log, err := logger.New("test")
	require.NoError(t, err)
	t.Cleanup(func() { _ = log.Sync() })

	app := fiber.New(fiber.Config{
		AppName:               "ai-academy-api-go-test",
		BodyLimit:             100 * 1024,
		ReadTimeout:           0,
		WriteTimeout:          0,
		IdleTimeout:           0,
		DisableStartupMessage: true,
		ErrorHandler:          errs.Handler(log),
	})

	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type,Authorization,X-Request-Id",
		AllowCredentials: false,
	}))

	// Register the same routes as cmd/server/main.go.
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":     "ok",
			"env":        cfg.Env,
			"version":    cfg.Version,
			"request_id": c.Locals("requestid"),
		})
	})
	app.Get("/readyz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ready"})
	})
	app.Use(func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "Route not found: "+c.Method()+" "+c.Path())
	})

	return app
}

// do is a thin wrapper around app.Test that returns the parsed body + status.
func do(t *testing.T, app *fiber.App, method, path string, headers map[string]string, body []byte) (int, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := app.Test(req, -1)
	require.NoError(t, err, "app.Test must not error")
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, raw
}

// decodeEnvelope asserts the response body is the canonical NestJS error envelope.
func decodeEnvelope(t *testing.T, raw []byte) errs.Envelope {
	t.Helper()
	var env errs.Envelope
	err := json.Unmarshal(raw, &env)
	require.NoError(t, err, "response body must be valid JSON envelope: %s", string(raw))
	return env
}

// TestMain silences noisy logs during the suite. If a test fails the
// verbose logger output is invaluable, but for the happy path it's noise.
func TestMain(m *testing.M) {
	// Set env once at package level. Tests using t.Parallel() can no longer
	// call t.Setenv() in their bodies (Go 1.22+ restriction).
	_ = os.Setenv("NODE_ENV", "test")
	_ = os.Setenv("API_PORT", "0")
	// 32+ char JWT secret that passes the placeholder check in config.validate().
	_ = os.Setenv("JWT_SECRET", "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011")
	_ = os.Setenv("LOG_LEVEL", "warn")
	// Enable only email_password for the auth e2e (avoids OAuth/SSO env checks).
	_ = os.Setenv("AUTH_PROVIDERS", "email_password")
	os.Exit(m.Run())
}

// _ keeps zap import live even if no test logs yet.
var _ = zap.NewNop
