// Package errs implements the global error contract.
//
// The previous NestJS API used AllExceptionsFilter (apps/api/src/common/filters/all-exceptions.filter.ts)
// which converts every error to a stable JSON envelope:
//
//	{ "statusCode": 4xx, "message": "...", "error": "...", "timestamp": "..." }
//
// We preserve that envelope so the frontend (apps/web) sees the same shape and
// our migration can flip traffic at the gateway without re-coding error handling.
package errs

import (
	"errors"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// Envelope is the JSON shape every error response must take.
type Envelope struct {
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	Error      string `json:"error,omitempty"`
	Timestamp  string `json:"timestamp"`
	Path       string `json:"path,omitempty"`
	RequestID  string `json:"requestId,omitempty"`
}

// AppError is a typed error that carries an HTTP status and a stable error code.
type AppError struct {
	StatusCode int
	Code       string
	Message    string
	Cause      error
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error { return e.Cause }

// Constructor helpers.
func NotFound(msg string) *AppError {
	return &AppError{StatusCode: 404, Code: "NOT_FOUND", Message: msg}
}
func BadRequest(msg string) *AppError {
	return &AppError{StatusCode: 400, Code: "BAD_REQUEST", Message: msg}
}
func Unauthorized(msg string) *AppError {
	return &AppError{StatusCode: 401, Code: "UNAUTHORIZED", Message: msg}
}
func Forbidden(msg string) *AppError {
	return &AppError{StatusCode: 403, Code: "FORBIDDEN", Message: msg}
}
func Conflict(msg string) *AppError {
	return &AppError{StatusCode: 409, Code: "CONFLICT", Message: msg}
}
func ServiceUnavailable(msg string) *AppError {
	return &AppError{StatusCode: 503, Code: "SERVICE_UNAVAILABLE", Message: msg}
}
func Internal(msg string, cause error) *AppError {
	return &AppError{StatusCode: 500, Code: "INTERNAL", Message: msg, Cause: cause}
}

// Handler returns the global error handler passed to fiber.Config.ErrorHandler.
func Handler(log *zap.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		// Default status: 500. Promote fiber.* / *AppError / sentinel.
		status := fiber.StatusInternalServerError
		code := "INTERNAL"
		message := "Internal server error"

		var fe *fiber.Error
		var ae *AppError
		switch {
		case errors.As(err, &ae):
			status = ae.StatusCode
			code = ae.Code
			message = ae.Message
		case errors.As(err, &fe):
			status = fe.Code
			code = httpCodeName(fe.Code)
			message = fe.Message
		default:
			// Unknown error: log full stack for ops, return generic to client.
			log.Error("unhandled error",
				zap.Error(err),
				zap.String("path", c.Path()),
				zap.String("request_id", c.Locals("requestid").(string)),
			)
		}

		// Never leak stack traces / framework internals on 5xx — mirrors NestJS filter.
		if status >= 500 {
			fields := []zap.Field{
				zap.Int("status", status),
				zap.String("code", code),
				zap.String("message", message),
				zap.String("path", c.Path()),
				zap.String("request_id", c.Locals("requestid").(string)),
			}
			if ae != nil && ae.Cause != nil {
				fields = append(fields, zap.String("cause", ae.Cause.Error()))
			}
			log.Error("request failed", fields...)
		}

		env := Envelope{
			StatusCode: status,
			Message:    message,
			Error:      code,
			Timestamp:  time.Now().UTC().Format(time.RFC3339),
			Path:       c.Path(),
			RequestID:  c.Locals("requestid").(string),
		}
		return c.Status(status).JSON(env)
	}
}

func httpCodeName(code int) string {
	switch code {
	case 400:
		return "BAD_REQUEST"
	case 401:
		return "UNAUTHORIZED"
	case 403:
		return "FORBIDDEN"
	case 404:
		return "NOT_FOUND"
	case 409:
		return "CONFLICT"
	case 422:
		return "UNPROCESSABLE_ENTITY"
	case 429:
		return "RATE_LIMITED"
	default:
		return "ERROR"
	}
}
