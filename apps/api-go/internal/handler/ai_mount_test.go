package handler

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type aiRouteTokenIssuer struct{}

func (aiRouteTokenIssuer) Issue(context.Context, string, string, string) (auth.TokenPair, error) {
	return auth.TokenPair{}, errors.New("not implemented")
}

func (aiRouteTokenIssuer) Verify(_ context.Context, token string) (auth.Claims, error) {
	switch token {
	case "admin-token":
		return auth.Claims{UserID: "admin-1", Role: "admin"}, nil
	case "user-token":
		return auth.Claims{UserID: "user-1", Role: "student"}, nil
	default:
		return auth.Claims{}, auth.ErrInvalidToken
	}
}

func (aiRouteTokenIssuer) RotateRefreshToken(context.Context, string) (auth.TokenPair, error) {
	return auth.TokenPair{}, errors.New("not implemented")
}

func (aiRouteTokenIssuer) RevokeRefreshToken(context.Context, string) error {
	return errors.New("not implemented")
}

func newAIRouteTestApp() *fiber.App {
	log := zap.NewNop()
	app := fiber.New(fiber.Config{ErrorHandler: errs.Handler(log)})
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("requestid", "test-request")
		return c.Next()
	})
	v1 := app.Group("/api/v1")
	NewAIHandler(nil, aiRouteTokenIssuer{}, log).Mount(v1)
	return app
}

func TestAIMountIncludesNestAndLegacyConfigRoutes(t *testing.T) {
	app := newAIRouteTestApp()
	routes := make(map[string]int)
	order := make(map[string]int)
	for i, route := range app.GetRoutes(true) {
		key := route.Method + " " + route.Path
		routes[key]++
		if _, exists := order[key]; !exists {
			order[key] = i
		}
	}

	want := []string{
		"GET /api/v1/admin/ai/config",
		"PUT /api/v1/admin/ai/config",
		"POST /api/v1/admin/ai/config/test",
		"DELETE /api/v1/admin/ai/config/:provider",
		"GET /api/v1/ai/config/providers",
		"PUT /api/v1/ai/config/providers",
		"DELETE /api/v1/ai/config/providers/:provider",
		"GET /api/v1/admin/ai-config/providers",
		"PUT /api/v1/admin/ai-config/providers",
		"DELETE /api/v1/admin/ai-config/providers/:provider",
		"POST /api/v1/admin/ai-config/test",
		"GET /api/v1/ai/user-config/providers",
		"PUT /api/v1/ai/user-config/providers",
		"DELETE /api/v1/ai/user-config/providers/:provider",
	}
	for _, key := range want {
		require.Equalf(t, 1, routes[key], "route %s should be mounted exactly once", key)
	}
	require.Less(t, order["POST /api/v1/admin/ai/config/test"], order["DELETE /api/v1/admin/ai/config/:provider"])
	require.Less(t, order["GET /api/v1/ai/config/providers"], order["DELETE /api/v1/ai/config/providers/:provider"])
}

func TestAIConfigCompatibilityRoutesRequireAuthentication(t *testing.T) {
	app := newAIRouteTestApp()
	requests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/admin/ai/config"},
		{"PUT", "/api/v1/admin/ai/config"},
		{"POST", "/api/v1/admin/ai/config/test"},
		{"DELETE", "/api/v1/admin/ai/config/gemini"},
		{"GET", "/api/v1/ai/config/providers"},
		{"PUT", "/api/v1/ai/config/providers"},
		{"DELETE", "/api/v1/ai/config/providers/gemini"},
	}
	for _, tt := range requests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			resp, err := app.Test(req)
			require.NoError(t, err)
			require.Equal(t, 401, resp.StatusCode)
		})
	}
}

func TestAIAdminConfigCompatibilityRoutesRejectNonAdmin(t *testing.T) {
	app := newAIRouteTestApp()
	for _, tt := range []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/admin/ai/config"},
		{"PUT", "/api/v1/admin/ai/config"},
		{"POST", "/api/v1/admin/ai/config/test"},
		{"DELETE", "/api/v1/admin/ai/config/gemini"},
	} {
		req := httptest.NewRequest(tt.method, tt.path, nil)
		req.Header.Set("Authorization", "Bearer user-token")
		resp, err := app.Test(req)
		require.NoError(t, err)
		require.Equal(t, 403, resp.StatusCode)
	}
}
