// Package handler — Fiber HTTP handlers for the admin module.
//
// Phase 2 T24: 1 endpoint (admin dashboard stats).
//
//	GET /api/v1/admin/stats
//
// Admin-only: mirrors the NestJS controller's
// `UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.admin)`.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/admin"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// AdminHandler bundles the admin service + JWT verifier.
type AdminHandler struct {
	svc    *admin.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewAdminHandler builds a handler.
func NewAdminHandler(svc *admin.Service, tokens auth.TokenIssuer, log *zap.Logger) *AdminHandler {
	return &AdminHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the admin stats route.
func (h *AdminHandler) Mount(router fiber.Router) {
	admin := router.Group("/admin",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	admin.Get("/stats", h.stats)
}

// stats returns the admin dashboard rollup.
//
//	GET /api/v1/admin/stats
func (h *AdminHandler) stats(c *fiber.Ctx) error {
	res, err := h.svc.GetStats(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(res)
}
