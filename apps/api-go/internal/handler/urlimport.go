// Package handler — Fiber HTTP handlers for the url-import module.
//
// Phase 2 T22: ports the 2 endpoints of
// apps/api/src/modules/url-import/url-import.controller.ts. Both
// are admin-only and registered under /api/v1/courses/* (matching
// the NestJS path which mounts the controller with @Controller('courses')).
//
// Routes:
//
//	POST /api/v1/courses/import-from-url          single URL → stub task
//	POST /api/v1/courses/import-batch-from-urls   up to 20 URLs → stub tasks
//
// Both endpoints return 501-style stub data: the real metadata fetch
// (YouTube oEmbed / Bilibili API) and Gemini course-draft generation
// ship in T22.1. T22 persists a url_imports row for each accepted
// URL so the admin inbox has a record of attempted imports.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/urlimport"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// UrlImportHandler bundles the service + JWT verifier.
type UrlImportHandler struct {
	svc    *urlimport.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewUrlImportHandler builds a handler.
func NewUrlImportHandler(svc *urlimport.Service, tokens auth.TokenIssuer, log *zap.Logger) *UrlImportHandler {
	return &UrlImportHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the import routes. Both go on /api/v1/courses/*
// with admin-only auth, matching the NestJS controller.
func (h *UrlImportHandler) Mount(router fiber.Router) {
	admin := router.Group("/courses",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	admin.Post("/import-from-url", h.importSingle)
	admin.Post("/import-batch-from-urls", h.importBatch)
}

func (h *UrlImportHandler) importSingle(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		URL string `json:"url"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.ImportSingle(c.Context(), claims.UserID, body.URL)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusAccepted).JSON(row)
}

func (h *UrlImportHandler) importBatch(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		URLs []string `json:"urls"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	summary, err := h.svc.ImportBatch(c.Context(), claims.UserID, body.URLs)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusAccepted).JSON(summary)
}
