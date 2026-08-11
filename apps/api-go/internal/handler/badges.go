// Package handler — Fiber HTTP handlers for the badges module.
//
// Phase 2 T14-2: ports the 6 endpoints of
// apps/api/src/modules/badges/badges.controller.ts.
//
// Routes:
//
//	GET    /badges              list active (public)
//	GET    /badges/me           my badge wall (auth)
//	POST   /badges              create (admin)
//	PATCH  /badges/:id          update (admin)
//	DELETE /badges/:id          delete (admin)
//	GET    /badges/admin/stats  admin stats (admin)
package handler

import (
	"encoding/json"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/badges"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// BadgesHandler bundles the service + JWT verifier.
type BadgesHandler struct {
	svc    *badges.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewBadgesHandler builds a handler.
func NewBadgesHandler(svc *badges.Service, tokens auth.TokenIssuer, log *zap.Logger) *BadgesHandler {
	return &BadgesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all badge routes. /badges (list) and /admin/stats
// are auth-conditional; /me requires auth; admin routes require admin.
func (h *BadgesHandler) Mount(router fiber.Router) {
	router.Get("/badges", h.listActive)
	router.Get("/badges/me", middleware.RequireAuth(h.tokens), h.me)

	// Admin routes — RequireAuth + RequireRole("admin")
	admin := router.Group("/badges", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"))
	admin.Post("/", h.create)
	admin.Patch("/:id", h.update)
	admin.Delete("/:id", h.delete)
	admin.Get("/admin/stats", h.adminStats)
}

func (h *BadgesHandler) listActive(c *fiber.Ctx) error {
	rows, err := h.svc.ListActive(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *BadgesHandler) me(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.GetMyBadges(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *BadgesHandler) create(c *fiber.Ctx) error {
	var body struct {
		Code          string          `json:"code"`
		Name          string          `json:"name"`
		Description   string          `json:"description"`
		Icon          string          `json:"icon"`
		Category      string          `json:"category"`
		CriteriaType  string          `json:"criteriaType"`
		CriteriaValue int32           `json:"criteriaValue"`
		CriteriaJson  json.RawMessage `json:"criteriaJson"`
		Points        int32           `json:"points"`
		IsActive      *bool           `json:"isActive"`
		OrderIndex    int32           `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Create(c.Context(), badges.APIInput{
		Code:          body.Code,
		Name:          body.Name,
		Description:   body.Description,
		Icon:          body.Icon,
		Category:      body.Category,
		CriteriaType:  body.CriteriaType,
		CriteriaValue: body.CriteriaValue,
		CriteriaJson:  body.CriteriaJson,
		Points:        body.Points,
		IsActive:      body.IsActive,
		OrderIndex:    body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *BadgesHandler) update(c *fiber.Ctx) error {
	var body struct {
		Code          string          `json:"code"`
		Name          string          `json:"name"`
		Description   string          `json:"description"`
		Icon          string          `json:"icon"`
		Category      string          `json:"category"`
		CriteriaType  string          `json:"criteriaType"`
		CriteriaValue int32           `json:"criteriaValue"`
		CriteriaJson  json.RawMessage `json:"criteriaJson"`
		Points        int32           `json:"points"`
		IsActive      *bool           `json:"isActive"`
		OrderIndex    int32           `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Update(c.Context(), c.Params("id"), badges.APIInput{
		Code:          body.Code,
		Name:          body.Name,
		Description:   body.Description,
		Icon:          body.Icon,
		Category:      body.Category,
		CriteriaType:  body.CriteriaType,
		CriteriaValue: body.CriteriaValue,
		CriteriaJson:  body.CriteriaJson,
		Points:        body.Points,
		IsActive:      body.IsActive,
		OrderIndex:    body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *BadgesHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *BadgesHandler) adminStats(c *fiber.Ctx) error {
	stats, err := h.svc.GetAdminStats(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(stats)
}
