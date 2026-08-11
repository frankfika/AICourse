// Package handler — Fiber HTTP handlers for the audit module.
//
// Phase 2 T24: 1 endpoint.
//
//	GET /api/v1/audit-logs  admin
//
// Admin-only: mirrors the NestJS controller's
// `UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.admin)`.
package handler

import (
	"strconv"

	"github.com/frankfika/ai-academy/api-go/internal/audit"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// AuditHandler bundles the audit service + JWT verifier.
type AuditHandler struct {
	svc    *audit.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewAuditHandler builds a handler.
func NewAuditHandler(svc *audit.Service, tokens auth.TokenIssuer, log *zap.Logger) *AuditHandler {
	return &AuditHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the admin list route.
func (h *AuditHandler) Mount(router fiber.Router) {
	admin := router.Group("/audit-logs",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	admin.Get("/", h.list)
}

// list returns the paginated audit log.
//
//	GET /api/v1/audit-logs?userId=&entity=&action=&relatedUserId=&page=&limit=
func (h *AuditHandler) list(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	res, err := h.svc.List(c.Context(), audit.ListParams{
		UserID:        c.Query("userId", ""),
		Entity:        c.Query("entity", ""),
		Action:        c.Query("action", ""),
		RelatedUserID: c.Query("relatedUserId", ""),
		Page:          page,
		Limit:         limit,
	})
	if err != nil {
		return err
	}
	return c.JSON(res)
}
