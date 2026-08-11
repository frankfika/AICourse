// Package handler — Fiber HTTP handlers for the auth identities API.
//
// Phase 2 T11: ports the 2 identity-management endpoints of
// apps/api/src/modules/auth/auth.controller.ts that operate on
// UserProviderAccount rows (the rest — register/login/refresh/logout/me
// — already live in auth.go from Phase 1).
//
//   - GET    /auth/identities                  — list current user's bindings
//   - DELETE /auth/identities/:id              — unlink one binding
//
// OAuth/SAML link start and callback are owned by AuthHandler. Keeping a
// single owner matters because Fiber dispatches duplicate routes to the first
// registered handler, which can otherwise leave stale implementations hidden.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/users"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// IdentitiesHandler bundles the users service + JWT verifier.
type IdentitiesHandler struct {
	svc    *users.Service
	tokens auth.TokenIssuer
}

// NewIdentitiesHandler builds a handler.
func NewIdentitiesHandler(svc *users.Service, tokens auth.TokenIssuer, log *zap.Logger) *IdentitiesHandler {
	return &IdentitiesHandler{svc: svc, tokens: tokens}
}

// Mount registers the /auth/identities routes on the given Fiber app/group.
// Provider link routes are registered by AuthHandler.Mount.
func (h *IdentitiesHandler) Mount(router fiber.Router) {
	g := router.Group("/auth")
	g.Get("/identities", middleware.RequireAuth(h.tokens), h.list)
	g.Delete("/identities/:id", middleware.RequireAuth(h.tokens), h.unlink)
}

// list returns the current user's active provider bindings.
//
//	GET /api/v1/auth/identities
func (h *IdentitiesHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListIdentities(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	// Map to a public shape, hiding providerUserId (privacy: it's the
	// user's email or OAuth sub, both PII).
	out := make([]fiber.Map, 0, len(rows))
	for _, r := range rows {
		entry := fiber.Map{
			"id":         r.ID,
			"provider":   r.Provider,
			"isPrimary":  r.IsPrimary,
			"linkedAt":   r.LinkedAt,
			"lastUsedAt": r.LastUsedAt,
		}
		if r.Email.Valid {
			entry["email"] = r.Email.String
		} else {
			entry["email"] = nil
		}
		if r.DisplayName.Valid {
			entry["displayName"] = r.DisplayName.String
		} else {
			entry["displayName"] = nil
		}
		out = append(out, entry)
	}
	return c.JSON(fiber.Map{"identities": out})
}

// unlink removes a provider binding for the current user.
//
//	DELETE /api/v1/auth/identities/:id
func (h *IdentitiesHandler) unlink(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	if err := h.svc.UnlinkIdentity(c.Context(), claims.UserID, id); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
