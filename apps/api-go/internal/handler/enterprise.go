// Package handler — Fiber HTTP handlers for the enterprise module.
//
// Phase 2 T22: ports the 4 endpoints of
// apps/api/src/modules/enterprise/enterprise.controller.ts.
//
// Routes:
//
//	POST   /api/v1/enterprise/inquiries        public, rate-limited at gateway
//	GET    /api/v1/enterprise/inquiries        admin
//	PATCH  /api/v1/enterprise/inquiries/:id/status   admin
//	DELETE /api/v1/enterprise/inquiries/:id    admin
package handler

import (
	"net/mail"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/enterprise"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// EnterpriseHandler bundles the service + JWT verifier.
type EnterpriseHandler struct {
	svc    *enterprise.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewEnterpriseHandler builds a handler.
func NewEnterpriseHandler(svc *enterprise.Service, tokens auth.TokenIssuer, log *zap.Logger) *EnterpriseHandler {
	return &EnterpriseHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all enterprise routes.
func (h *EnterpriseHandler) Mount(router fiber.Router) {
	// Public POST — anyone can submit an inquiry. NestJS uses
	// @Throttle({ default: { limit: 3, ttl: 60000 } }); the global
	// Fiber limiter (cmd/server/main.go:111) already applies a default
	// of 100 req/min per IP+request-id, which is the right floor for
	// the public inquiry endpoint. A tighter per-IP-only throttle can
	// be layered later if abuse appears.
	router.Post("/enterprise/inquiries", h.create)

	// Admin reads + writes.
	admin := router.Group("/enterprise",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	admin.Get("/inquiries", h.list)
	admin.Patch("/inquiries/:id/status", h.updateStatus)
	admin.Delete("/inquiries/:id", h.delete)
}

func (h *EnterpriseHandler) create(c *fiber.Ctx) error {
	var body struct {
		Name        string `json:"name"`
		Email       string `json:"email"`
		Company     string `json:"company"`
		TeamSize    string `json:"teamSize"`
		Phone       string `json:"phone"`
		Topic       string `json:"topic"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.TrimSpace(body.Email)
	body.Company = strings.TrimSpace(body.Company)
	body.Topic = strings.TrimSpace(body.Topic)
	if _, err := mail.ParseAddress(body.Email); err != nil {
		return errs.BadRequest("email is invalid")
	}
	row, err := h.svc.Create(c.Context(), enterprise.CreateInput{
		Name:        body.Name,
		Email:       body.Email,
		Company:     body.Company,
		TeamSize:    body.TeamSize,
		Phone:       strings.TrimSpace(body.Phone),
		Topic:       body.Topic,
		Description: strings.TrimSpace(body.Description),
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *EnterpriseHandler) list(c *fiber.Ctx) error {
	rows, err := h.svc.List(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *EnterpriseHandler) updateStatus(c *fiber.Ctx) error {
	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateStatus(c.Context(), c.Params("id"), body.Status)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *EnterpriseHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
