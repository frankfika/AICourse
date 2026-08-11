// Package handler — Fiber HTTP handlers for the progress module.
//
// Phase 2 T15-1: ports the 4 endpoints of
// apps/api/src/modules/progress/progress.controller.ts.
//
// Routes:
//
//	GET  /progress/me                       list all my progress
//	GET  /progress/me/stats                 learning stats (dashboard)
//	GET  /progress/courses/:courseId        progress for a specific course
//	POST /progress/lessons/:lessonId/complete  mark lesson done
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/progress"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// ProgressHandler bundles the service + JWT verifier.
type ProgressHandler struct {
	svc    *progress.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewProgressHandler builds a handler.
func NewProgressHandler(svc *progress.Service, tokens auth.TokenIssuer, log *zap.Logger) *ProgressHandler {
	return &ProgressHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all progress routes.
func (h *ProgressHandler) Mount(router fiber.Router) {
	auth := router.Group("/progress", middleware.RequireAuth(h.tokens))
	auth.Get("/me", h.myProgress)
	auth.Get("/me/stats", h.myStats)
	auth.Get("/courses/:courseId", h.courseProgress)
	auth.Post("/lessons/:lessonId/complete", h.completeLesson)
}

func (h *ProgressHandler) myProgress(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.GetMyProgress(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ProgressHandler) myStats(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	stats, err := h.svc.GetLearningStats(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(stats)
}

func (h *ProgressHandler) courseProgress(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.GetCourseProgress(c.Context(), claims.UserID, c.Params("courseId"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ProgressHandler) completeLesson(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.CompleteLesson(c.Context(), claims.UserID, c.Params("lessonId"))
	if err != nil {
		return err
	}
	return c.JSON(row)
}
