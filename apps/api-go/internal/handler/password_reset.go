package handler

import (
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/gofiber/fiber/v2"
)

type PasswordResetHandler struct {
	svc *auth.PasswordResetService
}

func NewPasswordResetHandler(svc *auth.PasswordResetService) *PasswordResetHandler {
	return &PasswordResetHandler{svc: svc}
}

func (h *PasswordResetHandler) Mount(router fiber.Router) {
	g := router.Group("/auth/password-reset")
	g.Get("/capability", h.capability)
	g.Post("/request", h.request)
	g.Post("/confirm", h.confirm)
}

func (h *PasswordResetHandler) capability(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"enabled": h.svc.Capability()})
}

func (h *PasswordResetHandler) request(c *fiber.Ctx) error {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if len(body.Email) > 320 || !auth.ValidateEmailPublic(strings.TrimSpace(body.Email)) {
		return errs.BadRequest("valid email is required")
	}
	if err := h.svc.Request(c.Context(), body.Email); err != nil {
		return err
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"accepted": true})
}

func (h *PasswordResetHandler) confirm(c *fiber.Ctx) error {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if err := h.svc.Confirm(c.Context(), body.Token, body.NewPassword); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"changed": true})
}
