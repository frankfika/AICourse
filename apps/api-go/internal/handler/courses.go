// Package handler — Fiber HTTP handlers for the courses module.
//
// Phase 2 T12-1: ports the 6 endpoints of
// apps/api/src/modules/courses/courses.controller.ts. The list and detail
// endpoints are public (OptionalJwtAuthGuard in NestJS); the create /
// update / delete / link endpoints are admin-only.
package handler

import (
	"strconv"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/courses"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// CoursesHandler bundles the service + JWT verifier for the courses routes.
type CoursesHandler struct {
	svc    *courses.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewCoursesHandler builds a handler.
func NewCoursesHandler(svc *courses.Service, tokens auth.TokenIssuer, log *zap.Logger) *CoursesHandler {
	return &CoursesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all /api/v1/courses/* routes.
//
// Public routes (list, get): no middleware — public catalog.
// Admin routes: requireAuth + requireRole("admin").
func (h *CoursesHandler) Mount(router fiber.Router) {
	g := router.Group("/courses")

	// Public list + detail. Optional auth so admins can see drafts.
	g.Get("/", middleware.OptionalAuth(h.tokens), h.list)
	g.Get("/:id", middleware.OptionalAuth(h.tokens), h.get)

	// Admin-only mutations.
	adminOnly := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}
	g.Post("/", append(adminOnly, h.create)...)
	g.Patch("/:id", append(adminOnly, h.update)...)
	g.Delete("/:id", append(adminOnly, h.delete)...)
	g.Post("/:id/degrees", append(adminOnly, h.linkDegrees)...)
}

// list returns the public course catalog. Admins get the optional
// status filter to see draft / archived.
//
//	GET /api/v1/courses?status=&courseType=&search=&page=&limit=
func (h *CoursesHandler) list(c *fiber.Ctx) error {
	isAdmin := h.isAdmin(c)
	p := courses.ListParams{
		Status:     c.Query("status", ""),
		CourseType: c.Query("courseType", ""),
		Search:     c.Query("search", ""),
	}
	p.Page, _ = strconv.Atoi(c.Query("page", "1"))
	p.Limit, _ = strconv.Atoi(c.Query("limit", "20"))

	// Public callers can never bypass the published filter by passing
	// status=draft. Admin path is the only one that gets draft visibility.
	if !isAdmin && p.Status == "draft" {
		return errs.Forbidden("only admin can filter by status=draft")
	}

	res, err := h.svc.List(c.Context(), p, isAdmin)
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(res.Data))
	for _, x := range res.Data {
		out = append(out, publicCourseView(x))
	}
	return c.JSON(fiber.Map{
		"data":  out,
		"total": res.Total,
		"page":  res.Page,
		"limit": res.Limit,
	})
}

// get returns a single course. Admin sees draft/archived; public sees
// only published.
//
//	GET /api/v1/courses/:id
func (h *CoursesHandler) get(c *fiber.Ctx) error {
	isAdmin := h.isAdmin(c)
	includeDraft := isAdmin
	crs, err := h.svc.Get(c.Context(), c.Params("id"), includeDraft)
	if err != nil {
		return err
	}
	return c.JSON(publicCourseView(crs))
}

// create inserts a new course. Admin only.
//
//	POST /api/v1/courses
func (h *CoursesHandler) create(c *fiber.Ctx) error {
	in, err := bindAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Create(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicCourseView(out))
}

// update applies a partial update. Admin only.
//
//	PATCH /api/v1/courses/:id
func (h *CoursesHandler) update(c *fiber.Ctx) error {
	in, err := bindAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Update(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(publicCourseView(out))
}

// delete hard-deletes a course. Admin only.
//
//	DELETE /api/v1/courses/:id
func (h *CoursesHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"message": "Course deleted"})
}

// linkDegrees appends the course to each specified degree. Admin only.
//
//	POST /api/v1/courses/:id/degrees
func (h *CoursesHandler) linkDegrees(c *fiber.Ctx) error {
	var body struct {
		DegreeIDs []string `json:"degreeIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if len(body.DegreeIDs) == 0 {
		return errs.BadRequest("degreeIds is required")
	}
	for _, id := range body.DegreeIDs {
		if !isUUID(id) {
			return errs.BadRequest("degreeIds must be UUIDs")
		}
	}
	res, err := h.svc.LinkDegrees(c.Context(), c.Params("id"), body.DegreeIDs)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"appended": res.Appended,
		"skipped":  res.Skipped,
		"total":    res.Total,
		"degrees":  res.Degrees,
	})
}

// isAdmin reads the JWT claims (if any) and checks role. Returns false
// for unauthenticated callers — public list still works for them.
func (h *CoursesHandler) isAdmin(c *fiber.Ctx) bool {
	claims := middleware.GetClaims(c)
	return claims != nil && claims.Role == "admin"
}

// bindAPIInput parses the request body into the courses.APIInput
// shape. Rejects malformed bodies with a 400.
func bindAPIInput(c *fiber.Ctx) (courses.APIInput, error) {
	var raw struct {
		Title          string `json:"title"`
		Description    string `json:"description"`
		LearningPoints string `json:"learningPoints"`
		Instructor     string `json:"instructor"`
		Level          string `json:"level"`
		Duration       string `json:"duration"`
		Thumbnail      string `json:"thumbnail"`
		Tags           string `json:"tags"`
		CostType       string `json:"costType"`
		Price          string `json:"price"`
		Status         string `json:"status"`
		CourseType     string `json:"courseType"`
		ExternalURL    string `json:"externalUrl"`
		SourceVideoURL string `json:"sourceVideoUrl"`
		SourcePlatform string `json:"sourcePlatform"`
		IndustryID     string `json:"industryId"`
		CategoryID     string `json:"categoryId"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return courses.APIInput{}, errs.BadRequest("invalid request body")
	}
	return courses.APIInput(raw), nil
}

// publicCourseView is the public course shape (same as NestJS).
func publicCourseView(c db.Course) fiber.Map {
	external := ""
	if c.ExternalUrl.Valid {
		external = c.ExternalUrl.String
	}
	srcVideo := ""
	if c.SourceVideoUrl.Valid {
		srcVideo = c.SourceVideoUrl.String
	}
	srcPlatform := ""
	if c.SourcePlatform.Valid {
		srcPlatform = c.SourcePlatform.String
	}
	industry := ""
	if c.IndustryID.Valid {
		industry = c.IndustryID.String
	}
	category := ""
	if c.CategoryID.Valid {
		category = c.CategoryID.String
	}
	return fiber.Map{
		"id":             c.ID,
		"title":          c.Title,
		"description":    c.Description,
		"learningPoints": c.LearningPoints,
		"instructor":     c.Instructor,
		"level":          string(c.Level),
		"duration":       c.Duration,
		"thumbnail":      c.Thumbnail,
		"tags":           c.Tags,
		"costType":       string(c.CostType),
		"price":          c.Price,
		"status":         string(c.Status),
		"courseType":     string(c.CourseType),
		"externalUrl":    external,
		"sourceVideoUrl": srcVideo,
		"sourcePlatform": srcPlatform,
		"industryId":     industry,
		"categoryId":     category,
		"createdAt":      c.CreatedAt,
		"updatedAt":      c.UpdatedAt,
	}
}

// isUUID is a minimal v4-ish UUID shape check. We just need the length
// and dashes here; full v4 validation is the backend's job in NestJS
// too (class-validator @IsUUID).
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	if strings.Count(s, "-") != 4 {
		return false
	}
	return true
}
