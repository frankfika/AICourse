// Package handler — Fiber HTTP handlers for the reviews module.
//
// Phase 2 T15-4: ports the 5 endpoints of
// apps/api/src/modules/reviews/reviews.controller.ts.
//
// Routes:
//
//	GET  /courses/:id/reviews     public list
//	POST /courses/:id/reviews     auth create
//	POST /reviews/:id/helpful     auth like
//	GET  /reviews                  admin list
//	DELETE /reviews/:id            admin soft-delete
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/reviews"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// ReviewsHandler bundles the service + JWT verifier.
type ReviewsHandler struct {
	svc    *reviews.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewReviewsHandler builds a handler.
func NewReviewsHandler(svc *reviews.Service, tokens auth.TokenIssuer, log *zap.Logger) *ReviewsHandler {
	return &ReviewsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all review routes.
func (h *ReviewsHandler) Mount(router fiber.Router) {
	// Per-course public list + auth create
	router.Get("/courses/:id/reviews", h.listByCourse)
	router.Post("/courses/:id/reviews", middleware.RequireAuth(h.tokens), h.create)

	// Per-review auth actions
	auth := router.Group("/reviews", middleware.RequireAuth(h.tokens))
	auth.Post("/:id/helpful", h.helpful)

	// Admin list + soft-delete
	admin := router.Group("/reviews", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"))
	admin.Get("/", h.listAll)
	admin.Delete("/:id", h.softDelete)
}

func (h *ReviewsHandler) listByCourse(c *fiber.Ctx) error {
	rows, err := h.svc.ListByCourse(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ReviewsHandler) create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Rating  int32  `json:"rating"`
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Create(c.Context(), claims.UserID, c.Params("id"), reviews.APIInput{
		Rating:  body.Rating,
		Content: body.Content,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *ReviewsHandler) helpful(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.MarkHelpful(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *ReviewsHandler) listAll(c *fiber.Ctx) error {
	courseID := c.Query("courseId")
	rating := int32(c.QueryInt("rating", 0))
	onlyDeleted := c.QueryBool("onlyDeleted", false)
	rows, err := h.svc.ListAll(c.Context(), courseID, rating, onlyDeleted)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *ReviewsHandler) softDelete(c *fiber.Ctx) error {
	if err := h.svc.SoftDelete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
