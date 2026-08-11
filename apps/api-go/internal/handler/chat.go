// Package handler — Fiber HTTP handlers for the chat module.
//
// Phase 2 T17: ports the 5 endpoints of
// apps/api/src/modules/chat/chat.controller.ts.
//
// Routes (all require JWT auth):
//
//	POST   /chat/sessions
//	GET    /chat/sessions
//	GET    /chat/sessions/:id/messages
//	POST   /chat/sessions/:id/messages
//	DELETE /chat/sessions/:id
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/chat"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// ChatHandler bundles the service + JWT verifier.
type ChatHandler struct {
	svc    *chat.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewChatHandler builds a handler.
func NewChatHandler(svc *chat.Service, tokens auth.TokenIssuer, log *zap.Logger) *ChatHandler {
	return &ChatHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all chat routes.
func (h *ChatHandler) Mount(router fiber.Router) {
	g := router.Group("/chat", middleware.RequireAuth(h.tokens))
	g.Post("/sessions", h.createSession)
	g.Get("/sessions", h.listSessions)
	g.Get("/sessions/:id/messages", h.listMessages)
	g.Post("/sessions/:id/messages", h.sendMessage)
	g.Delete("/sessions/:id", h.deleteSession)
}

func (h *ChatHandler) createSession(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Title string `json:"title"`
	}
	_ = c.BodyParser(&body) // title is optional
	id, title, err := h.svc.CreateSession(c.Context(), claims.UserID, chat.CreateSessionInput{
		Title: body.Title,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"sessionId": id,
		"title":     title,
	})
}

func (h *ChatHandler) listSessions(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListSessions(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ChatHandler) listMessages(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListMessages(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ChatHandler) sendMessage(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if body.Content == "" {
		return errs.BadRequest("content required")
	}
	res, err := h.svc.SendMessage(c.Context(), claims.UserID, c.Params("id"), chat.SendMessageInput{
		Content: body.Content,
	})
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func (h *ChatHandler) deleteSession(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.DeleteSession(c.Context(), claims.UserID, c.Params("id")); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).JSON(nil)
}
