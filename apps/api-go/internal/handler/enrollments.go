// Package handler — Fiber HTTP handlers for the enrollments module.
//
// Phase 2 T13-1: ports the 2 endpoints of
// apps/api/src/modules/enrollments/enrollments.controller.ts.
//
// Routes:
//
//	GET   /enrollments/me                list current user's enrollments
//	POST  /enrollments/courses/:id/free  enroll in a free course
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/enrollments"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// EnrollmentsHandler bundles the service + JWT verifier.
type EnrollmentsHandler struct {
	svc    *enrollments.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewEnrollmentsHandler builds a handler.
func NewEnrollmentsHandler(svc *enrollments.Service, tokens auth.TokenIssuer, log *zap.Logger) *EnrollmentsHandler {
	return &EnrollmentsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all enrollment routes.
func (h *EnrollmentsHandler) Mount(router fiber.Router) {
	auth := router.Group("/enrollments", middleware.RequireAuth(h.tokens))
	auth.Get("/me", h.list)
	auth.Post("/courses/:id/free", h.enrollFree)
}

func (h *EnrollmentsHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.FindByUser(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *EnrollmentsHandler) enrollFree(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.EnrollFreeCourse(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}
