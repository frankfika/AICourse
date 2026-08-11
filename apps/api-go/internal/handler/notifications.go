// Package handler — Fiber HTTP handlers for the notifications module.
//
// Phase 2 T16-1: ports the 6 endpoints of
// apps/api/src/modules/notification/notification.controller.ts.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/notifications"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// NotificationsHandler bundles the service + JWT verifier.
type NotificationsHandler struct {
	svc    *notifications.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewNotificationsHandler builds a handler.
func NewNotificationsHandler(svc *notifications.Service, tokens auth.TokenIssuer, log *zap.Logger) *NotificationsHandler {
	return &NotificationsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all notification routes.
func (h *NotificationsHandler) Mount(router fiber.Router) {
	auth := router.Group("/notifications", middleware.RequireAuth(h.tokens))
	auth.Get("/", h.list)
	auth.Get("/unread-count", h.unreadCount)
	auth.Post("/:id/read", h.markRead)
	auth.Post("/read-all", h.markAllRead)
	auth.Delete("/:id", h.delete)
	auth.Post("/clear-read", h.clearRead)
}

func (h *NotificationsHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	res, err := h.svc.List(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func (h *NotificationsHandler) unreadCount(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	n, err := h.svc.UnreadCount(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"unreadCount": n})
}

func (h *NotificationsHandler) markRead(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.MarkRead(c.Context(), claims.UserID, c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *NotificationsHandler) markAllRead(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.MarkAllRead(c.Context(), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *NotificationsHandler) delete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.Delete(c.Context(), claims.UserID, c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *NotificationsHandler) clearRead(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.ClearRead(c.Context(), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
