// Package handler — Fiber HTTP handlers for the learning_events module.
//
// Phase 2 T15-2: ports the 4 endpoints of
// apps/api/src/modules/learning-events/learning-events.controller.ts.
//
// Routes:
//
//	POST /learning-events                  create one
//	POST /learning-events/batch            create many
//	GET  /learning-events/me               list mine
//	GET  /learning-events/lesson/:lessonId  admin/instructor list
package handler

import (
	"encoding/json"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/learningevents"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// LearningEventsHandler bundles the service + JWT verifier.
type LearningEventsHandler struct {
	svc    *learningevents.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewLearningEventsHandler builds a handler.
func NewLearningEventsHandler(svc *learningevents.Service, tokens auth.TokenIssuer, log *zap.Logger) *LearningEventsHandler {
	return &LearningEventsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all learning-events routes.
func (h *LearningEventsHandler) Mount(router fiber.Router) {
	auth := router.Group("/learning-events", middleware.RequireAuth(h.tokens))
	auth.Post("/", h.createOne)
	auth.Post("/batch", h.createBatch)
	auth.Get("/me", h.listMine)

	// /lesson/:lessonId is admin/instructor only.
	admin := router.Group("/learning-events", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin", "instructor"))
	admin.Get("/lesson/:lessonId", h.listByLesson)
}

func (h *LearningEventsHandler) createOne(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		LessonID    string          `json:"lessonId"`
		EventType   string          `json:"eventType"`
		PositionSec *int32          `json:"positionSec"`
		DurationMs  *int32          `json:"durationMs"`
		Metadata    json.RawMessage `json:"metadata"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.CreateOne(c.Context(), claims.UserID, learningevents.APIInput{
		LessonID:    body.LessonID,
		EventType:   body.EventType,
		PositionSec: body.PositionSec,
		DurationMs:  body.DurationMs,
		Metadata:    body.Metadata,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"event": dto})
}

func (h *LearningEventsHandler) createBatch(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Events []struct {
			LessonID    string          `json:"lessonId"`
			EventType   string          `json:"eventType"`
			PositionSec *int32          `json:"positionSec"`
			DurationMs  *int32          `json:"durationMs"`
			Metadata    json.RawMessage `json:"metadata"`
		} `json:"events"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	inputs := make([]learningevents.APIInput, 0, len(body.Events))
	for _, e := range body.Events {
		inputs = append(inputs, learningevents.APIInput{
			LessonID:    e.LessonID,
			EventType:   e.EventType,
			PositionSec: e.PositionSec,
			DurationMs:  e.DurationMs,
			Metadata:    e.Metadata,
		})
	}
	count, err := h.svc.CreateBatch(c.Context(), claims.UserID, inputs)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"count": count})
}

func (h *LearningEventsHandler) listMine(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	limit := 50
	if l := c.QueryInt("limit", 0); l > 0 {
		limit = l
	}
	rows, err := h.svc.ListMine(c.Context(), claims.UserID, limit)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *LearningEventsHandler) listByLesson(c *fiber.Ctx) error {
	limit := 50
	if l := c.QueryInt("limit", 0); l > 0 {
		limit = l
	}
	rows, err := h.svc.ListByLesson(c.Context(), c.Params("lessonId"), limit)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}
