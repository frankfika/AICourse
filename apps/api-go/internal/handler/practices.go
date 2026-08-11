// Package handler — Fiber HTTP handlers for the practices module.
//
// Phase 2 T14-4: ports the 11 endpoints of
// apps/api/src/modules/practices/practices.controller.ts.
//
// Routes:
//
//	GET    /practices/courses/:courseId                  public list (projectUrl gated)
//	GET    /practices/courses/:courseId/access           auth (must be enrolled for paid)
//	GET    /practices/admin/courses/:courseId            admin: all projects
//	GET    /practices/:id                                get (projectUrl gated)
//	POST   /practices                                    admin: create
//	PATCH  /practices/:id                                admin: update
//	DELETE /practices/:id                                admin: delete
//	GET    /practices/user/progress                      auth: my progress
//	POST   /practices/:id/start                          auth: start
//	POST   /practices/:id/complete                       auth: complete
//	POST   /practices/:id/skip                           auth: skip
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/practices"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// PracticesHandler bundles the service + JWT verifier.
type PracticesHandler struct {
	svc    *practices.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewPracticesHandler builds a handler.
func NewPracticesHandler(svc *practices.Service, tokens auth.TokenIssuer, log *zap.Logger) *PracticesHandler {
	return &PracticesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all practice routes.
func (h *PracticesHandler) Mount(router fiber.Router) {
	// Public list (projectUrl gated to admin/enrolled) — needs
	// OptionalAuth so admin tokens are recognized.
	router.Get("/practices/courses/:courseId", middleware.OptionalAuth(h.tokens), h.list)
	// Auth list (must be enrolled for paid courses)
	router.Get("/practices/courses/:courseId/access", middleware.RequireAuth(h.tokens), h.listAccessible)
	// Admin list (all projects)
	router.Get("/practices/admin/courses/:courseId", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.listAdmin)
	// Get one — also needs OptionalAuth for the same reason
	router.Get("/practices/:id", middleware.OptionalAuth(h.tokens), h.get)
	// Auth user actions
	auth := router.Group("/practices", middleware.RequireAuth(h.tokens))
	auth.Get("/user/progress", h.userProgress)
	auth.Post("/:id/start", h.start)
	auth.Post("/:id/complete", h.complete)
	auth.Post("/:id/skip", h.skip)
	// Admin CRUD
	admin := router.Group("/practices", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"))
	admin.Post("/", h.create)
	admin.Patch("/:id", h.update)
	admin.Delete("/:id", h.delete)
}

func (h *PracticesHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var userID string
	var isAdmin bool
	if claims != nil {
		userID = claims.UserID
		isAdmin = claims.Role == "admin"
	}
	rows, err := h.svc.ListByCourse(c.Context(), c.Params("courseId"), userID, isAdmin)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *PracticesHandler) listAccessible(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	// For accessible list, just call the public list with the auth'd user
	rows, err := h.svc.ListByCourse(c.Context(), c.Params("courseId"), claims.UserID, claims.Role == "admin")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *PracticesHandler) listAdmin(c *fiber.Ctx) error {
	rows, err := h.svc.ListAllByCourse(c.Context(), c.Params("courseId"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *PracticesHandler) get(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var userID string
	var isAdmin bool
	if claims != nil {
		userID = claims.UserID
		isAdmin = claims.Role == "admin"
	}
	row, err := h.svc.GetByID(c.Context(), c.Params("id"), userID, isAdmin)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *PracticesHandler) userProgress(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	courseID := c.Query("courseId")
	rows, err := h.svc.GetUserProgress(c.Context(), claims.UserID, courseID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *PracticesHandler) start(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.StartProject(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *PracticesHandler) complete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		SubmissionURL string `json:"submissionUrl"`
		Notes         string `json:"notes"`
	}
	_ = c.BodyParser(&body)
	row, err := h.svc.CompleteProject(c.Context(), claims.UserID, c.Params("id"), practices.CompleteInput{
		SubmissionURL: body.SubmissionURL,
		Notes:         body.Notes,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *PracticesHandler) skip(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.SkipProject(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *PracticesHandler) create(c *fiber.Ctx) error {
	var body struct {
		CourseID      string `json:"courseId"`
		Title         string `json:"title"`
		Description   string `json:"description"`
		ProjectURL    string `json:"projectUrl"`
		ThumbnailURL  string `json:"thumbnailUrl"`
		Difficulty    string `json:"difficulty"`
		EstimatedTime int32  `json:"estimatedTime"`
		Tags          string `json:"tags"`
		ProjectType   string `json:"projectType"`
		OrderIndex    int32  `json:"orderIndex"`
		Requirements  string `json:"requirements"`
		Objectives    string `json:"objectives"`
		IsActive      *bool  `json:"isActive"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Create(c.Context(), practices.APIInput{
		CourseID:      body.CourseID,
		Title:         body.Title,
		Description:   body.Description,
		ProjectURL:    body.ProjectURL,
		ThumbnailURL:  body.ThumbnailURL,
		Difficulty:    body.Difficulty,
		EstimatedTime: body.EstimatedTime,
		Tags:          body.Tags,
		ProjectType:   body.ProjectType,
		OrderIndex:    body.OrderIndex,
		Requirements:  body.Requirements,
		Objectives:    body.Objectives,
		IsActive:      body.IsActive,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *PracticesHandler) update(c *fiber.Ctx) error {
	var body struct {
		Title         string `json:"title"`
		Description   string `json:"description"`
		ProjectURL    string `json:"projectUrl"`
		ThumbnailURL  string `json:"thumbnailUrl"`
		Difficulty    string `json:"difficulty"`
		EstimatedTime int32  `json:"estimatedTime"`
		Tags          string `json:"tags"`
		ProjectType   string `json:"projectType"`
		OrderIndex    int32  `json:"orderIndex"`
		Requirements  string `json:"requirements"`
		Objectives    string `json:"objectives"`
		IsActive      *bool  `json:"isActive"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.Update(c.Context(), c.Params("id"), practices.APIInput{
		Title:         body.Title,
		Description:   body.Description,
		ProjectURL:    body.ProjectURL,
		ThumbnailURL:  body.ThumbnailURL,
		Difficulty:    body.Difficulty,
		EstimatedTime: body.EstimatedTime,
		Tags:          body.Tags,
		ProjectType:   body.ProjectType,
		OrderIndex:    body.OrderIndex,
		Requirements:  body.Requirements,
		Objectives:    body.Objectives,
		IsActive:      body.IsActive,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *PracticesHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}
