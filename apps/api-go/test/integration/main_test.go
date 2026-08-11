// Package integration exercises the full request → handler → repo → MySQL path
// using a real MySQL container (started by dockertest) and a Fiber app bound
// to an ephemeral port.
//
// Phase 0: harness only. Phase 1 wires in the auth handler so we can verify
// "POST /api/v1/auth/login returns a JWT" against a real DB row.
package integration

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"go.uber.org/zap"
)

var (
	testDB     *sql.DB
	testApp    *fiber.App
	testLog    *zap.Logger
	testConfig *config.Config
)

// TestMain spins a MySQL 8 container via dockertest, applies the schema
// (placeholder until Phase 0 T4 produces db/migrations/0001_init.sql),
// and tears everything down on exit.
//
// We use dockertest rather than the repo's docker-compose MySQL because:
//   - dockertest gives us a fresh, isolated DB per test run
//   - we don't conflict with whatever else is running locally
//   - this is the canonical Go pattern for db integration tests
func TestMain(m *testing.M) {
	// Force test-friendly env.
	_ = os.Setenv("NODE_ENV", "test")
	_ = os.Setenv("API_PORT", "0")
	_ = os.Setenv("JWT_SECRET", "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011")
	_ = os.Setenv("LOG_LEVEL", "warn")

	pool, err := dockertest.NewPool("")
	if err != nil {
		log.Fatalf("dockertest pool: %v", err)
	}

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	if err != nil {
		log.Fatalf("dockertest run mysql: %v", err)
	}

	// Exponential backoff retry; dockertest's recommended pattern.
	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		resource.GetPort("3306/tcp"))

	if err := pool.Retry(func() error {
		var err error
		testDB, err = sql.Open("mysql", dsn)
		if err != nil {
			return err
		}
		return testDB.Ping()
	}); err != nil {
		log.Fatalf("mysql never came up: %v", err)
	}

	// Apply schema. Phase 0 placeholder: a single table we'll use for the
	// first integration test. Phase 0 T4 will replace this with the full
	// 0001_init.sql produced by the schema translation agent.
	if err := applyPlaceholderSchema(testDB); err != nil {
		log.Fatalf("apply schema: %v", err)
	}

	// Wire the Fiber app.
	var cfgErr error
	testConfig, cfgErr = config.Load()
	if cfgErr != nil {
		log.Fatalf("config load: %v", cfgErr)
	}
	testLog, err = logger.New("test")
	if err != nil {
		log.Fatalf("logger: %v", err)
	}
	testApp = buildTestApp(testConfig, testLog, testDB)

	// Run the suite.
	code := m.Run()

	// Teardown.
	testLog.Sync() //nolint:errcheck
	_ = testDB.Close()
	if err := pool.Purge(resource); err != nil {
		log.Printf("dockertest purge: %v", err)
	}
	os.Exit(code)
}

// applyPlaceholderSchema creates one table (id + email + created_at) so
// we can validate the integration harness end-to-end. Phase 0 T4 will
// replace this with the full Prisma-derived DDL.
func applyPlaceholderSchema(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id           CHAR(36) NOT NULL PRIMARY KEY,
			email        VARCHAR(255) NOT NULL UNIQUE,
			display_name VARCHAR(120) NOT NULL DEFAULT '',
			created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
	`)
	return err
}

// buildTestApp wires the Fiber app with the same middleware chain as
// cmd/server/main.go. It is parameterized over the DB so the same
// harness can be used as Phase 1+ adds handlers.
func buildTestApp(cfg *config.Config, log *zap.Logger, db *sql.DB) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "ai-academy-api-go-integration",
		BodyLimit:             100 * 1024,
		DisableStartupMessage: true,
		ErrorHandler:          errs.Handler(log),
	})

	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))

	app.Get("/healthz", func(c *fiber.Ctx) error {
		// Phase 0: ping DB to make the healthz check meaningful.
		ctx, cancel := context.WithTimeout(c.Context(), 500*time.Millisecond)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			return errs.Internal("database unavailable", err)
		}
		return c.JSON(fiber.Map{
			"status":  "ok",
			"env":     cfg.Env,
			"version": cfg.Version,
		})
	})

	app.Get("/readyz", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), 500*time.Millisecond)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "database not ready")
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	// Phase 0 placeholder endpoint: GET /api/v1/test/users?email=...
	app.Get("/api/v1/test/users", func(c *fiber.Ctx) error {
		email := c.Query("email")
		if email == "" {
			return errs.BadRequest("email query parameter is required")
		}
		var id, name string
		err := db.QueryRowContext(c.Context(),
			"SELECT id, display_name FROM users WHERE email = ?", email).
			Scan(&id, &name)
		if err == sql.ErrNoRows {
			return errs.NotFound("user not found")
		}
		if err != nil {
			return errs.Internal("db query failed", err)
		}
		return c.JSON(fiber.Map{
			"id":          id,
			"email":       email,
			"displayName": name,
			"requestId":   c.Locals("requestid"),
		})
	})

	// Phase 0 placeholder endpoint: POST /api/v1/test/users
	app.Post("/api/v1/test/users", func(c *fiber.Ctx) error {
		var body struct {
			Email       string `json:"email"`
			DisplayName string `json:"displayName"`
		}
		if err := c.BodyParser(&body); err != nil {
			return errs.BadRequest("invalid json body")
		}
		if body.Email == "" {
			return errs.BadRequest("email is required")
		}
		id := uuid.NewString()
		_, err := db.ExecContext(c.Context(),
			"INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)",
			id, body.Email, body.DisplayName)
		if err != nil {
			return errs.Internal("insert failed", err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"id":          id,
			"email":       body.Email,
			"displayName": body.DisplayName,
		})
	})

	app.Use(func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "Route not found: "+c.Method()+" "+c.Path())
	})

	_ = uuid.New() // keep import
	return app
}
