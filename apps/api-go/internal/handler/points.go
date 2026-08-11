// Package handler — Fiber HTTP handlers for the points module.
//
// Phase 2 T16-2: ports the 1 endpoint of
// apps/api/src/modules/points/points.controller.ts.
//
// Routes:
//
//	GET /points/me  auth: user's points, level, and recent transactions
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/points"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// PointsHandler bundles the service + JWT verifier.
type PointsHandler struct {
	svc    *points.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewPointsHandler builds a handler.
func NewPointsHandler(svc *points.Service, tokens auth.TokenIssuer, log *zap.Logger) *PointsHandler {
	return &PointsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the single point route.
func (h *PointsHandler) Mount(router fiber.Router) {
	auth := router.Group("/points", middleware.RequireAuth(h.tokens))
	auth.Get("/me", h.getMyPoints)
}

func (h *PointsHandler) getMyPoints(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	dto, err := h.svc.GetUserPoints(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(dto)
}
