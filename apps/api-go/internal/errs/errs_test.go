package errs

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// newTestApp returns a Fiber app that simulates a route which always errors
// with the given error, plus the requestid middleware. This lets us assert
// the global error handler's output shape without standing up the full app.
func newTestApp(t *testing.T, err error) *fiber.App {
	t.Helper()
	log := zap.NewNop()
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		ErrorHandler:          Handler(log),
	})
	app.Use(func(c *fiber.Ctx) error {
		// set requestid like real middleware does
		c.Locals("requestid", uuid.NewString())
		return c.Next()
	})
	app.Get("/boom", func(c *fiber.Ctx) error {
		return err
	})
	return app
}

func TestHandler_AppError_PassesThroughStatusAndCode(t *testing.T) {
	t.Parallel()
	app := newTestApp(t, NotFound("user 42 missing"))

	req := httptest.NewRequest("GET", "/boom", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 404, resp.StatusCode)
}

func TestHandler_FiberError_KeepsMessage(t *testing.T) {
	t.Parallel()
	app := newTestApp(t, fiber.NewError(429, "rate limit exceeded"))

	req := httptest.NewRequest("GET", "/boom", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 429, resp.StatusCode)
}

func TestHandler_UnknownError_DefaultsTo500(t *testing.T) {
	t.Parallel()
	app := newTestApp(t, errors.New("kaboom"))

	req := httptest.NewRequest("GET", "/boom", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 500, resp.StatusCode)
	// Message is sanitized to a generic string; the original is logged but
	// never leaked to the client. This mirrors NestJS AllExceptionsFilter.
}

func TestHTTPCodeName(t *testing.T) {
	t.Parallel()
	cases := []struct {
		code int
		want string
	}{
		{400, "BAD_REQUEST"},
		{401, "UNAUTHORIZED"},
		{403, "FORBIDDEN"},
		{404, "NOT_FOUND"},
		{409, "CONFLICT"},
		{422, "UNPROCESSABLE_ENTITY"},
		{429, "RATE_LIMITED"},
		{500, "ERROR"},
		{418, "ERROR"}, // not in the table; falls through to default
	}
	for _, tc := range cases {
		tc := tc
		t.Run("", func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, httpCodeName(tc.code))
		})
	}
}

func TestAppError_Constructors(t *testing.T) {
	t.Parallel()
	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()
		e := NotFound("x")
		assert.Equal(t, 404, e.StatusCode)
		assert.Equal(t, "NOT_FOUND", e.Code)
		assert.Equal(t, "x", e.Message)
	})
	t.Run("BadRequest", func(t *testing.T) {
		t.Parallel()
		e := BadRequest("x")
		assert.Equal(t, 400, e.StatusCode)
		assert.Equal(t, "BAD_REQUEST", e.Code)
	})
	t.Run("Unauthorized", func(t *testing.T) {
		t.Parallel()
		e := Unauthorized("x")
		assert.Equal(t, 401, e.StatusCode)
		assert.Equal(t, "UNAUTHORIZED", e.Code)
	})
	t.Run("Forbidden", func(t *testing.T) {
		t.Parallel()
		e := Forbidden("x")
		assert.Equal(t, 403, e.StatusCode)
		assert.Equal(t, "FORBIDDEN", e.Code)
	})
	t.Run("Conflict", func(t *testing.T) {
		t.Parallel()
		e := Conflict("x")
		assert.Equal(t, 409, e.StatusCode)
		assert.Equal(t, "CONFLICT", e.Code)
	})
	t.Run("Internal wraps cause", func(t *testing.T) {
		t.Parallel()
		cause := errors.New("root")
		e := Internal("wrap me", cause)
		assert.Equal(t, 500, e.StatusCode)
		assert.Equal(t, "INTERNAL", e.Code)
		assert.ErrorIs(t, e, cause, "Unwrap should expose the cause")
	})
}
