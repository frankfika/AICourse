// Package handler — Fiber HTTP handlers for the certificates module.
//
// Phase 2 T14-3: ports the 4 endpoints of
// apps/api/src/modules/certificates/certificates.controller.ts.
//
// Routes:
//
//	GET    /certificates                my certificates (auth)
//	GET    /certificates/verify/:serial public verify (anonymous)
//	GET    /certificates/:id            public detail
//	POST   /certificates/revoke/:id     admin revoke
//
// Route ordering matters: /verify/:serial must be registered before
// /:id so the static segment wins over the dynamic one.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/certificates"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// CertificatesHandler bundles the service + JWT verifier.
type CertificatesHandler struct {
	svc    *certificates.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewCertificatesHandler builds a handler.
func NewCertificatesHandler(svc *certificates.Service, tokens auth.TokenIssuer, log *zap.Logger) *CertificatesHandler {
	return &CertificatesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all certificate routes.
func (h *CertificatesHandler) Mount(router fiber.Router) {
	// /certificates (mine) — auth required
	router.Get("/certificates", middleware.RequireAuth(h.tokens), h.list)
	// /certificates/verify/:serial — public, MUST be before /:id
	router.Get("/certificates/verify/:serial", h.verify)
	// /certificates/:id — public
	router.Get("/certificates/:id", h.get)
	// /certificates/revoke/:id — admin
	admin := router.Group("/certificates", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"))
	admin.Post("/revoke/:id", h.revoke)
}

func (h *CertificatesHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	typ := c.Query("type")
	rows, err := h.svc.FindMyCertificates(c.Context(), claims.UserID, typ)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CertificatesHandler) verify(c *fiber.Ctx) error {
	serial := c.Params("serial")
	res, err := h.svc.VerifyCertificate(c.Context(), serial)
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func (h *CertificatesHandler) get(c *fiber.Ctx) error {
	row, err := h.svc.FindCertificateByID(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CertificatesHandler) revoke(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.RevokeCertificate(c.Context(), c.Params("id"), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(row)
}
