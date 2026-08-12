// Package handler — Fiber HTTP handlers for the ai module.
//
// Phase 2 T21: ports the 9 endpoints of
// apps/api/src/modules/ai/{ai,ai-config,ai-user-config}.controller.ts.
//
// Routes:
//
//	Admin (require role=admin):
//	  GET    /api/v1/admin/ai/config
//	  PUT    /api/v1/admin/ai/config
//	  DELETE /api/v1/admin/ai/config/:provider
//	  POST   /api/v1/admin/ai/config/test
//
//	User AI config (any authenticated user):
//	  GET    /api/v1/ai/config/providers
//	  PUT    /api/v1/ai/config/providers
//	  DELETE /api/v1/ai/config/providers/:provider
//
// The former /admin/ai-config and /ai/user-config routes remain aliases.
//
//	Generate (admin-only, returns 503 until a real provider is wired):
//	  POST   /api/v1/ai/generate-course
//	  POST   /api/v1/ai/generate-degree
//
// The 2 generate endpoints never fabricate drafts. They return 503 until a
// real provider call is implemented.
package handler

import (
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/ai"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// AIHandler bundles the service + JWT verifier.
type AIHandler struct {
	svc    *ai.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewAIHandler builds a handler.
func NewAIHandler(svc *ai.Service, tokens auth.TokenIssuer, log *zap.Logger) *AIHandler {
	return &AIHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the NestJS/Web-compatible AI config paths and retains the
// original Go migration paths as backwards-compatible aliases.
func (h *AIHandler) Mount(router fiber.Router) {
	adminOnly := []fiber.Handler{
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	}
	userOnly := []fiber.Handler{middleware.RequireAuth(h.tokens)}

	// NestJS/Web admin contract. Register the static /test route before the
	// provider parameter route so future same-method additions cannot be
	// swallowed by :provider.
	router.Get("/admin/ai/config", append(adminOnly, h.adminList)...)
	router.Put("/admin/ai/config", append(adminOnly, h.adminUpsert)...)
	router.Post("/admin/ai/config/test", append(adminOnly, h.adminTest)...)
	router.Delete("/admin/ai/config/:provider", append(adminOnly, h.adminDelete)...)

	// NestJS/Web per-user contract. Exact /providers routes precede the
	// parameter route and require authentication (but no admin role).
	router.Get("/ai/config/providers", append(userOnly, h.userList)...)
	router.Put("/ai/config/providers", append(userOnly, h.userUpsert)...)
	router.Delete("/ai/config/providers/:provider", append(userOnly, h.userDelete)...)

	// Legacy Go migration aliases (require role=admin).
	adminCfg := router.Group("/admin/ai-config",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	adminCfg.Get("/providers", h.adminList)
	adminCfg.Put("/providers", h.adminUpsert)
	adminCfg.Delete("/providers/:provider", h.adminDelete)
	adminCfg.Post("/test", h.adminTest)

	// Legacy per-user aliases.
	userCfg := router.Group("/ai/user-config", middleware.RequireAuth(h.tokens))
	userCfg.Get("/providers", h.userList)
	userCfg.Put("/providers", h.userUpsert)
	userCfg.Delete("/providers/:provider", h.userDelete)

	// Generate endpoints (admin-only, explicitly unavailable for now).
	gen := router.Group("/ai",
		middleware.RequireAuth(h.tokens),
		middleware.RequireRole("admin"),
	)
	gen.Post("/generate-course", h.generateCourse)
	gen.Post("/generate-degree", h.generateDegree)
}

// ============================================================
// Admin handlers
// ============================================================

func (h *AIHandler) adminList(c *fiber.Ctx) error {
	rows, err := h.svc.ListConfigs(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"data":  rows,
		"total": len(rows),
	})
}

func (h *AIHandler) adminUpsert(c *fiber.Ctx) error {
	var body struct {
		Provider string  `json:"provider"`
		APIKey   string  `json:"apiKey"`
		Model    string  `json:"model"`
		BaseURL  *string `json:"baseUrl"`
		IsActive *bool   `json:"isActive"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	body.Provider = strings.TrimSpace(body.Provider)
	if body.Provider == "" {
		return errs.BadRequest("provider 必填")
	}
	row, err := h.svc.UpsertConfig(c.Context(), ai.UpsertConfigInput{
		Provider: body.Provider,
		APIKey:   body.APIKey,
		Model:    body.Model,
		BaseURL:  body.BaseURL,
		IsActive: body.IsActive,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *AIHandler) adminDelete(c *fiber.Ctx) error {
	provider := strings.TrimSpace(c.Params("provider"))
	if provider == "" {
		return errs.BadRequest("provider 必填")
	}
	res, err := h.svc.DeleteConfig(c.Context(), provider)
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func (h *AIHandler) adminTest(c *fiber.Ctx) error {
	res, err := h.svc.TestConnection(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(res)
}

// ============================================================
// User handlers
// ============================================================

func (h *AIHandler) userList(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListUserConfigs(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"data":  rows,
		"total": len(rows),
	})
}

func (h *AIHandler) userUpsert(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Provider string  `json:"provider"`
		APIKey   string  `json:"apiKey"`
		Model    string  `json:"model"`
		BaseURL  *string `json:"baseUrl"`
		IsActive *bool   `json:"isActive"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	body.Provider = strings.TrimSpace(body.Provider)
	if body.Provider == "" {
		return errs.BadRequest("provider 必填")
	}
	row, err := h.svc.UpsertUserConfig(c.Context(), claims.UserID, ai.UpsertUserConfigInput{
		Provider: body.Provider,
		APIKey:   body.APIKey,
		Model:    body.Model,
		BaseURL:  body.BaseURL,
		IsActive: body.IsActive,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *AIHandler) userDelete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	provider := strings.TrimSpace(c.Params("provider"))
	if provider == "" {
		return errs.BadRequest("provider 必填")
	}
	if err := h.svc.DeleteUserConfig(c.Context(), claims.UserID, provider); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true, "provider": provider})
}

// ============================================================
// Generate handlers (admin-only; service returns unavailable)
// ============================================================

func (h *AIHandler) generateCourse(c *fiber.Ctx) error {
	var body struct {
		Topic string `json:"topic"`
		Hint  string `json:"hint"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	draft, err := h.svc.GenerateCourse(c.Context(), ai.GenerateCourseInput{
		Topic: body.Topic,
		Hint:  body.Hint,
	})
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"draft": draft})
}

func (h *AIHandler) generateDegree(c *fiber.Ctx) error {
	var body struct {
		Topic string `json:"topic"`
		Hint  string `json:"hint"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	draft, err := h.svc.GenerateDegree(c.Context(), ai.GenerateDegreeInput{
		Topic: body.Topic,
		Hint:  body.Hint,
	})
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"draft": draft})
}
