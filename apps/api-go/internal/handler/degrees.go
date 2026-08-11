// Package handler — Fiber HTTP handlers for the degrees module.
//
// Phase 2 T14-1: ports the 6 endpoints of
// apps/api/src/modules/degrees/degrees.controller.ts.
//
// Routes:
//
//	GET    /degrees                 list (public; admin can see drafts)
//	GET    /degrees/:id             get one (OptionalAuth for admin see-draft)
//	POST   /degrees                 create (admin)
//	PATCH  /degrees/:id             update (admin)
//	DELETE /degrees/:id             delete (admin; refuses if enrollments exist)
//	POST   /degrees/:id/courses     link courses (admin)
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/degrees"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// DegreesHandler bundles the service + JWT verifier.
type DegreesHandler struct {
	svc    *degrees.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewDegreesHandler builds a handler.
func NewDegreesHandler(svc *degrees.Service, tokens auth.TokenIssuer, log *zap.Logger) *DegreesHandler {
	return &DegreesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all degree routes. Public list + get are anonymous;
// admin routes require RequireRole("admin").
func (h *DegreesHandler) Mount(router fiber.Router) {
	// Public reads (admin can use OptionalAuth to see drafts)
	// IMPORTANT: list + get need OptionalAuth so admin's Bearer token
	// is recognized and they see drafts. Without it, claims are always
	// nil and isAdmin is always false, so drafts are hidden from admins.
	router.Get("/degrees", middleware.OptionalAuth(h.tokens), h.list)
	router.Get("/degrees/:id", middleware.OptionalAuth(h.tokens), h.get)

	// Admin writes — RequireAuth + RequireRole("admin")
	admin := router.Group("/degrees", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"))
	admin.Post("/", h.create)
	admin.Patch("/:id", h.update)
	admin.Delete("/:id", h.delete)
	admin.Post("/:id/courses", h.linkCourses)
}

func (h *DegreesHandler) list(c *fiber.Ctx) error {
	// Anyone (admin or not) can list. Admin sees drafts if no status filter.
	isAdmin := false
	if claims := middleware.GetClaims(c); claims != nil && claims.Role == "admin" {
		isAdmin = true
	}
	status := c.Query("status")
	search := c.Query("search")
	rows, err := h.svc.List(c.Context(), status, search, isAdmin)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *DegreesHandler) get(c *fiber.Ctx) error {
	includeDraft := false
	if claims := middleware.GetClaims(c); claims != nil && claims.Role == "admin" {
		includeDraft = true
	}
	row, err := h.svc.GetByID(c.Context(), c.Params("id"), includeDraft)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *DegreesHandler) create(c *fiber.Ctx) error {
	var body struct {
		Title          string `json:"title"`
		Description    string `json:"description"`
		LearningPoints string `json:"learningPoints"`
		Price          string `json:"price"`
		Icon           string `json:"icon"`
		CostType       string `json:"costType"`
		Thumbnail      string `json:"thumbnail"`
		Status         string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Create(c.Context(), degrees.APIInput{
		Title:          body.Title,
		Description:    body.Description,
		LearningPoints: body.LearningPoints,
		Price:          body.Price,
		Icon:           body.Icon,
		CostType:       body.CostType,
		Thumbnail:      body.Thumbnail,
		Status:         body.Status,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *DegreesHandler) update(c *fiber.Ctx) error {
	var body struct {
		Title          string `json:"title"`
		Description    string `json:"description"`
		LearningPoints string `json:"learningPoints"`
		Price          string `json:"price"`
		Icon           string `json:"icon"`
		CostType       string `json:"costType"`
		Thumbnail      string `json:"thumbnail"`
		Status         string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Update(c.Context(), c.Params("id"), degrees.APIInput{
		Title:          body.Title,
		Description:    body.Description,
		LearningPoints: body.LearningPoints,
		Price:          body.Price,
		Icon:           body.Icon,
		CostType:       body.CostType,
		Thumbnail:      body.Thumbnail,
		Status:         body.Status,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *DegreesHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *DegreesHandler) linkCourses(c *fiber.Ctx) error {
	var body struct {
		Courses []struct {
			CourseID   string `json:"courseId"`
			OrderIndex int32  `json:"orderIndex"`
		} `json:"courses"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	req := degrees.LinkCoursesRequest{
		Courses: make([]degrees.CourseLink, 0, len(body.Courses)),
	}
	for _, c := range body.Courses {
		req.Courses = append(req.Courses, degrees.CourseLink{
			CourseID:   c.CourseID,
			OrderIndex: c.OrderIndex,
		})
	}
	if err := h.svc.LinkCourses(c.Context(), c.Params("id"), req); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
