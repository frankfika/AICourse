// Package handler — Fiber HTTP handlers for the chapters module.
//
// Phase 2 T12-2: ports the 5 endpoints of
// apps/api/src/modules/courses/chapters.controller.ts. All admin-only.
//
// Routes (all under /api/v1):
//
//	GET    /courses/:courseId/chapters         list (admin)
//	POST   /courses/:courseId/chapters         create (admin)
//	POST   /courses/:courseId/chapters/reorder reorder (admin)
//	PATCH  /chapters/:id                       update (admin)
//	DELETE /chapters/:id                       soft-delete (admin, cascades to lessons)
package handler

import (
	"strconv"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/chapters"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// ChaptersHandler bundles the service + JWT verifier.
type ChaptersHandler struct {
	svc    *chapters.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewChaptersHandler builds a handler.
func NewChaptersHandler(svc *chapters.Service, tokens auth.TokenIssuer, log *zap.Logger) *ChaptersHandler {
	return &ChaptersHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all chapter routes on the supplied router.
//
// NestJS uses a single controller with two paths: `courses` (with
// `:courseId/chapters` and `:courseId/chapters/reorder`) and
// `chapters` (with `:id` for update/delete). The Go side mirrors that
// by mounting both groups.
func (h *ChaptersHandler) Mount(router fiber.Router) {
	adminOnly := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}

	// IMPORTANT: don't pass the handler to Group() — that makes it a
	// middleware that runs for ALL methods (including POST), which
	// would call listByCourse with an empty courseId. The Group
	// middleware set should only contain the auth middlewares.
	//
	// Each route here is fully-qualified within the /courses group.
	// The listByCourse handler is bound to GET /:courseId/chapters
	// (not to GET "/") so the route matches the NestJS contract.
	courseChapters := router.Group("/courses", adminOnly...)
	courseChapters.Get("/:courseId/chapters", h.listByCourse)
	courseChapters.Post("/:courseId/chapters", h.create)
	courseChapters.Post("/:courseId/chapters/reorder", h.reorder)

	chaptersGrp := router.Group("/chapters", adminOnly...)
	chaptersGrp.Patch("/:id", h.update)
	chaptersGrp.Delete("/:id", h.delete)
}

// listByCourse returns all chapters of a course. Admin only.
//
//	GET /api/v1/courses/:courseId/chapters
func (h *ChaptersHandler) listByCourse(c *fiber.Ctx) error {
	courseID := c.Params("courseId")
	rows, err := h.svc.ListByCourse(c.Context(), courseID)
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(rows))
	for _, r := range rows {
		out = append(out, publicChapterView(r))
	}
	return c.JSON(out)
}

// create inserts a new chapter. Admin only.
//
//	POST /api/v1/courses/:courseId/chapters
func (h *ChaptersHandler) create(c *fiber.Ctx) error {
	courseID := c.Params("courseId")
	in, err := bindChapterAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Create(c.Context(), courseID, in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicChapterView(out))
}

// reorder reassigns orderIndex based on the array position. Admin only.
//
//	POST /api/v1/courses/:courseId/chapters/reorder
func (h *ChaptersHandler) reorder(c *fiber.Ctx) error {
	courseID := c.Params("courseId")
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	res, err := h.svc.Reorder(c.Context(), courseID, body.IDs)
	if err != nil {
		return err
	}
	return c.JSON(res)
}

// update applies a partial update. Admin only.
//
//	PATCH /api/v1/chapters/:id
func (h *ChaptersHandler) update(c *fiber.Ctx) error {
	in, err := bindChapterAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Update(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(publicChapterView(out))
}

// delete soft-deletes a chapter. Admin only.
//
//	DELETE /api/v1/chapters/:id
func (h *ChaptersHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ============ helpers ============

// bindChapterAPIInput parses a chapter create/update body into the
// chapters.APIInput struct. The same shape works for both.
func bindChapterAPIInput(c *fiber.Ctx) (chapters.APIInput, error) {
	var raw struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		OrderIndex  *int32 `json:"orderIndex"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return chapters.APIInput{}, errs.BadRequest("invalid request body")
	}
	return chapters.APIInput{
		Title: raw.Title, Description: raw.Description, OrderIndex: raw.OrderIndex,
	}, nil
}

// publicChapterView is the JSON shape returned to clients. Mirrors
// the NestJS controller's `findMany` result (excluding the soft-delete
// metadata).
func publicChapterView(c db.Chapter) fiber.Map {
	desc := ""
	if c.Description.Valid {
		desc = c.Description.String
	}
	return fiber.Map{
		"id":          c.ID,
		"courseId":    c.CourseID,
		"title":       c.Title,
		"description": desc,
		"orderIndex":  c.OrderIndex,
		"createdAt":   c.CreatedAt,
	}
}

// itoaLocal is a strconv.Itoa alias used in error messages. Kept as
// a separate function so the import in service.go doesn't leak.
func itoaLocal(n int) string {
	return strconv.Itoa(n)
}
