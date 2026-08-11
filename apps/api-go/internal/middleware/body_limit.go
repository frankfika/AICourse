package middleware

import (
	"io"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// LimitRequestBodyExceptLocalUpload preserves the API's small JSON body limit
// while allowing the signature-authorized local PUT route to stream directly
// to its own stricter signed-size limiter.
func LimitRequestBodyExceptLocalUpload(maxBytes int64) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodPut && strings.HasPrefix(c.Path(), "/api/v1/uploads/_local_upload/") {
			return c.Next()
		}
		contentLength := c.Request().Header.ContentLength()
		if contentLength > 0 && int64(contentLength) > maxBytes {
			return fiber.ErrRequestEntityTooLarge
		}
		stream := c.Context().RequestBodyStream()
		if stream == nil {
			if int64(len(c.Request().Body())) > maxBytes {
				return fiber.ErrRequestEntityTooLarge
			}
			return c.Next()
		}
		body, err := io.ReadAll(io.LimitReader(stream, maxBytes+1))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "failed to read request body")
		}
		if int64(len(body)) > maxBytes {
			return fiber.ErrRequestEntityTooLarge
		}
		c.Request().SetBodyRaw(body)
		return c.Next()
	}
}
