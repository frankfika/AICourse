// Package handler — Fiber HTTP handlers for the site module.
//
// Phase 2 T22: single public endpoint.
//
//	GET /api/v1/site/stats   homepage / AuthShell hero numbers
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/site"
	"github.com/gofiber/fiber/v2"
)

// SiteHandler is a thin wrapper around site.Service. No JWT — the
// route is intentionally public.
type SiteHandler struct {
	svc *site.Service
}

// NewSiteHandler builds a handler.
func NewSiteHandler(svc *site.Service) *SiteHandler {
	return &SiteHandler{svc: svc}
}

// Mount registers the public stats route.
func (h *SiteHandler) Mount(router fiber.Router) {
	router.Get("/site/stats", h.getStats)
}

func (h *SiteHandler) getStats(c *fiber.Ctx) error {
	stats, err := h.svc.GetStats(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(stats)
}
