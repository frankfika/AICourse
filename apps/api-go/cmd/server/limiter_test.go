package main

import (
	"net"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/valyala/fasthttp"
)

func TestGlobalLimiterStableIPBuckets(t *testing.T) {
	app := fiber.New()
	app.Use(requestid.New(requestid.Config{Generator: func() string { return uuid.NewString() }}))
	app.Use(limiter.New(globalLimiterConfig()))
	app.Get("/", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	do := func(ip string) int {
		ctx := &fasthttp.RequestCtx{}
		ctx.Init(&fasthttp.Request{}, &net.TCPAddr{IP: net.ParseIP(ip), Port: 12345}, nil)
		ctx.Request.Header.SetMethod(http.MethodGet)
		ctx.Request.SetRequestURI("/")
		ctx.Request.Header.SetHost("example.test")
		// A spoofed forwarding header must not merge/change the direct-peer
		// bucket because the app has no trusted proxy configuration.
		ctx.Request.Header.Set("X-Forwarded-For", "203.0.113.250")
		app.Handler()(ctx)
		return ctx.Response.StatusCode()
	}

	for i := 0; i < 100; i++ {
		require.Equal(t, http.StatusOK, do("192.0.2.10"), "request %d", i+1)
	}
	require.Equal(t, http.StatusTooManyRequests, do("192.0.2.10"))
	require.Equal(t, http.StatusOK, do("192.0.2.11"), "a different client IP must have an independent bucket")
}
