// Package handler — Fiber HTTP handlers for the lessons module.
//
// Phase 2 T12-3: ports the 5 endpoints of
// apps/api/src/modules/courses/lessons.controller.ts. All admin-only.
//
// Routes:
//
//	GET    /chapters/:chapterId/lessons         list
//	POST   /chapters/:chapterId/lessons         create
//	POST   /chapters/:chapterId/lessons/reorder reorder
//	PATCH  /lessons/:id                        update
//	DELETE /lessons/:id                        soft-delete
package handler

import (
	"strconv"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/lessons"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// LessonsHandler bundles the service + JWT verifier.
type LessonsHandler struct {
	svc    *lessons.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewLessonsHandler builds a handler.
func NewLessonsHandler(svc *lessons.Service, tokens auth.TokenIssuer, log *zap.Logger) *LessonsHandler {
	return &LessonsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all lesson routes.
func (h *LessonsHandler) Mount(router fiber.Router) {
	adminOnly := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}

	chapterLessons := router.Group("/chapters", adminOnly...)
	chapterLessons.Get("/:chapterId/lessons", h.listByChapter)
	chapterLessons.Post("/:chapterId/lessons", h.create)
	chapterLessons.Post("/:chapterId/lessons/reorder", h.reorder)

	lessonsGrp := router.Group("/lessons", adminOnly...)
	lessonsGrp.Patch("/:id", h.update)
	lessonsGrp.Delete("/:id", h.delete)
}

// listByChapter returns lessons for a chapter.
//
//	GET /api/v1/chapters/:chapterId/lessons
func (h *LessonsHandler) listByChapter(c *fiber.Ctx) error {
	chapterID := c.Params("chapterId")
	rows, err := h.svc.ListByChapter(c.Context(), chapterID)
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(rows))
	for _, r := range rows {
		out = append(out, publicLessonView(r))
	}
	return c.JSON(out)
}

// create inserts a new lesson.
//
//	POST /api/v1/chapters/:chapterId/lessons
func (h *LessonsHandler) create(c *fiber.Ctx) error {
	chapterID := c.Params("chapterId")
	in, err := bindLessonAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Create(c.Context(), chapterID, in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicLessonView(out))
}

// reorder reassigns orderIndex by array position.
//
//	POST /api/v1/chapters/:chapterId/lessons/reorder
func (h *LessonsHandler) reorder(c *fiber.Ctx) error {
	chapterID := c.Params("chapterId")
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	res, err := h.svc.Reorder(c.Context(), chapterID, body.IDs)
	if err != nil {
		return err
	}
	return c.JSON(res)
}

// update applies a partial update.
//
//	PATCH /api/v1/lessons/:id
func (h *LessonsHandler) update(c *fiber.Ctx) error {
	in, err := bindLessonAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Update(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(publicLessonView(out))
}

// delete soft-deletes a lesson.
//
//	DELETE /api/v1/lessons/:id
func (h *LessonsHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ============ helpers ============

func bindLessonAPIInput(c *fiber.Ctx) (lessons.APIInput, error) {
	var raw struct {
		Title         string `json:"title"`
		Description   string `json:"description"`
		VideoURL      string `json:"videoUrl"`
		VideoDuration *int32 `json:"videoDuration"`
		IsPreview     *bool  `json:"isPreview"`
		OrderIndex    *int32 `json:"orderIndex"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return lessons.APIInput{}, errs.BadRequest("invalid request body")
	}
	return lessons.APIInput{
		Title:         raw.Title,
		Description:   raw.Description,
		VideoURL:      raw.VideoURL,
		VideoDuration: raw.VideoDuration,
		IsPreview:     raw.IsPreview,
		OrderIndex:    raw.OrderIndex,
	}, nil
}

// publicLessonView mirrors the NestJS controller's findMany result.
func publicLessonView(l db.Lesson) fiber.Map {
	desc := ""
	if l.Description.Valid {
		desc = l.Description.String
	}
	videoURL := ""
	if l.VideoUrl.Valid {
		videoURL = l.VideoUrl.String
	}
	videoDur := int32(0)
	if l.VideoDuration.Valid {
		videoDur = l.VideoDuration.Int32
	}
	return fiber.Map{
		"id":            l.ID,
		"chapterId":     l.ChapterID,
		"title":         l.Title,
		"description":   desc,
		"videoUrl":      videoURL,
		"videoDuration": videoDur,
		"orderIndex":    l.OrderIndex,
		"isPreview":     l.IsPreview,
		"createdAt":     l.CreatedAt,
	}
}

// itoa is a strconv.Itoa alias. Kept local so the import doesn't
// leak into the rest of the handler package.
func itoa(n int) string { return strconv.Itoa(n) }
