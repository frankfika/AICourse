// Package handler — Fiber HTTP handlers for the notes module.
//
// Phase 2 T15-3: ports the 5 endpoints of
// apps/api/src/modules/notes/notes.controller.ts.
//
// Routes:
//
//	GET  /lessons/:lessonId/notes   list my notes
//	POST /lessons/:lessonId/notes   create
//	PATCH /notes/:id                 update (owner only)
//	DELETE /notes/:id                delete (owner only)
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/notes"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// NotesHandler bundles the service + JWT verifier.
type NotesHandler struct {
	svc    *notes.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewNotesHandler builds a handler.
func NewNotesHandler(svc *notes.Service, tokens auth.TokenIssuer, log *zap.Logger) *NotesHandler {
	return &NotesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all note routes.
func (h *NotesHandler) Mount(router fiber.Router) {
	// Per-lesson routes
	lesson := router.Group("/lessons/:lessonId/notes", middleware.RequireAuth(h.tokens))
	lesson.Get("/", h.list)
	lesson.Post("/", h.create)

	// Per-note routes (update + delete)
	note := router.Group("/notes", middleware.RequireAuth(h.tokens))
	note.Patch("/:id", h.update)
	note.Delete("/:id", h.delete)
}

func (h *NotesHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.List(c.Context(), claims.UserID, c.Params("lessonId"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *NotesHandler) create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Content     string `json:"content"`
		PositionSec *int32 `json:"positionSec"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Create(c.Context(), claims.UserID, c.Params("lessonId"), notes.APIInput{
		Content:     body.Content,
		PositionSec: body.PositionSec,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *NotesHandler) update(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Content     string `json:"content"`
		PositionSec *int32 `json:"positionSec"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Update(c.Context(), claims.UserID, c.Params("id"), notes.APIInput{
		Content:     body.Content,
		PositionSec: body.PositionSec,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *NotesHandler) delete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.Delete(c.Context(), claims.UserID, c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
