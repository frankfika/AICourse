// Package handler — Fiber HTTP handlers for the resources module.
//
// Phase 2 T12-4: ports the 4 endpoints of
// apps/api/src/modules/courses/resources.controller.ts +
// resource-item.controller.ts. All admin-only.
//
// Routes:
//
//	GET    /lessons/:lessonId/resources    list
//	POST   /lessons/:lessonId/resources    create
//	PATCH  /resources/:id                 update
//	DELETE /resources/:id                 soft-delete
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/frankfika/ai-academy/api-go/internal/resources"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// ResourcesHandler bundles the service + JWT verifier.
type ResourcesHandler struct {
	svc    *resources.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewResourcesHandler builds a handler.
func NewResourcesHandler(svc *resources.Service, tokens auth.TokenIssuer, log *zap.Logger) *ResourcesHandler {
	return &ResourcesHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all resource routes.
func (h *ResourcesHandler) Mount(router fiber.Router) {
	adminOnly := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}

	// Lesson-scoped routes (list + create).
	lessonResources := router.Group("/lessons", adminOnly...)
	lessonResources.Get("/:lessonId/resources", h.listByLesson)
	lessonResources.Post("/:lessonId/resources", h.create)

	// Resource-scoped routes (update + delete).
	resourcesGrp := router.Group("/resources", adminOnly...)
	resourcesGrp.Patch("/:id", h.update)
	resourcesGrp.Delete("/:id", h.delete)
}

// listByLesson returns resources for a lesson.
//
//	GET /api/v1/lessons/:lessonId/resources
func (h *ResourcesHandler) listByLesson(c *fiber.Ctx) error {
	rows, err := h.svc.ListByLesson(c.Context(), c.Params("lessonId"))
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(rows))
	for _, r := range rows {
		out = append(out, publicResourceView(r))
	}
	return c.JSON(out)
}

// create inserts a new resource.
//
//	POST /api/v1/lessons/:lessonId/resources
func (h *ResourcesHandler) create(c *fiber.Ctx) error {
	in, err := bindResourceAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Create(c.Context(), c.Params("lessonId"), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicResourceView(out))
}

// update applies a partial update.
//
//	PATCH /api/v1/resources/:id
func (h *ResourcesHandler) update(c *fiber.Ctx) error {
	in, err := bindResourceAPIInput(c)
	if err != nil {
		return err
	}
	out, err := h.svc.Update(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(publicResourceView(out))
}

// delete soft-deletes a resource.
//
//	DELETE /api/v1/resources/:id
func (h *ResourcesHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ============ helpers ============

func bindResourceAPIInput(c *fiber.Ctx) (resources.APIInput, error) {
	var raw struct {
		Title    string `json:"title"`
		URL      string `json:"url"`
		Type     string `json:"type"`
		IsLocked *bool  `json:"isLocked"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return resources.APIInput{}, errs.BadRequest("invalid request body")
	}
	return resources.APIInput{
		Title: raw.Title, URL: raw.URL, Type: raw.Type, IsLocked: raw.IsLocked,
	}, nil
}

func publicResourceView(r db.Resource) fiber.Map {
	return fiber.Map{
		"id":        r.ID,
		"lessonId":  r.LessonID,
		"title":     r.Title,
		"url":       r.Url,
		"type":      string(r.Type),
		"isLocked":  r.IsLocked,
		"createdAt": r.CreatedAt,
	}
}
