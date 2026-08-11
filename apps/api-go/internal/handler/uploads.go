// Package handler — Fiber HTTP handlers for the uploads module.
//
// Phase 2 T16-3: ports the 2 endpoints of
// apps/api/src/modules/uploads/uploads.controller.ts.
//
// Routes (both require JWT auth):
//
//	POST /uploads/sign      → returns presigned upload URL
//	POST /uploads/complete  → confirms upload + writes back to entity
package handler

import (
	"errors"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/uploads"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"strconv"
	"strings"
)

// UploadsHandler bundles the service + JWT verifier.
type UploadsHandler struct {
	svc    *uploads.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewUploadsHandler builds a handler.
func NewUploadsHandler(svc *uploads.Service, tokens auth.TokenIssuer, log *zap.Logger) *UploadsHandler {
	return &UploadsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers the upload routes.
func (h *UploadsHandler) Mount(router fiber.Router) {
	g := router.Group("/uploads", middleware.RequireAuth(h.tokens))
	g.Post("/sign", h.sign)
	g.Post("/complete", h.complete)
}

// MountLocal registers signature-authorized PUT and public-read routes for
// LocalFileStorage. It is intentionally separate from Mount so production
// object-storage deployments never expose local filesystem handlers.
func (h *UploadsHandler) MountLocal(router fiber.Router, storage *uploads.LocalFileStorage) {
	router.Put("/uploads/_local_upload/*", func(c *fiber.Ctx) error {
		key := strings.TrimPrefix(c.Params("*"), "/")
		contentType := uploads.NormalizeContentType(c.Get(fiber.HeaderContentType))
		if contentType == "" || contentType != uploads.NormalizeContentType(c.Query("contentType")) {
			return errs.BadRequest("Content-Type does not match signed upload")
		}
		maxBytes, err := strconv.ParseInt(c.Query("maxBytes"), 10, 64)
		if err != nil {
			return errs.BadRequest("invalid signed maxBytes")
		}
		expires, err := strconv.ParseInt(c.Query("expires"), 10, 64)
		if err != nil {
			return errs.BadRequest("invalid signed expiry")
		}
		if err := storage.PutPresigned(c.Context(), key, contentType, maxBytes, expires, c.Query("signature"), c.Context().RequestBodyStream()); err != nil {
			switch {
			case errors.Is(err, uploads.ErrInvalidUploadSignature), errors.Is(err, uploads.ErrUploadExpired):
				return errs.Forbidden("invalid or expired local upload URL")
			case errors.Is(err, uploads.ErrUploadTooLarge):
				return fiber.NewError(fiber.StatusRequestEntityTooLarge, "upload exceeds signed size")
			case errors.Is(err, uploads.ErrContentTypeMismatch):
				return errs.BadRequest("uploaded content does not match Content-Type")
			case errors.Is(err, uploads.ErrObjectAlreadyExists):
				return errs.Conflict("upload key already exists")
			case errors.Is(err, uploads.ErrInvalidObjectKey):
				return errs.BadRequest("invalid upload key")
			default:
				return errs.Internal("write local upload", err)
			}
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
	router.Get("/uploads/files/*", func(c *fiber.Ctx) error {
		f, meta, err := storage.OpenObject(c.Context(), strings.TrimPrefix(c.Params("*"), "/"))
		if err != nil {
			if errors.Is(err, uploads.ErrObjectNotFound) || errors.Is(err, uploads.ErrInvalidObjectKey) {
				return errs.NotFound("upload object not found")
			}
			return errs.Internal("read local upload", err)
		}
		c.Set(fiber.HeaderContentType, meta.ContentType)
		c.Set("X-Content-Type-Options", "nosniff")
		normalized := uploads.NormalizeContentType(meta.ContentType)
		if !strings.HasPrefix(normalized, "image/") && !strings.HasPrefix(normalized, "video/") && !strings.HasPrefix(normalized, "audio/") {
			c.Set(fiber.HeaderContentDisposition, "attachment")
		}
		return c.SendStream(f, int(meta.Size))
	})
}

func (h *UploadsHandler) sign(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Scope    string `json:"scope"`
		Filename string `json:"filename"`
		MimeType string `json:"mimeType"`
		Size     int64  `json:"size"`
		RefID    string `json:"refId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if body.Scope == "" || body.Filename == "" || body.MimeType == "" || body.Size <= 0 {
		return errs.BadRequest("scope, filename, mimeType, size required")
	}
	out, err := h.svc.Sign(c.Context(), claims.UserID, claims.Role, uploads.SignInput{
		Scope:    body.Scope,
		Filename: body.Filename,
		MimeType: body.MimeType,
		Size:     body.Size,
		RefID:    body.RefID,
	})
	if err != nil {
		return err
	}
	return c.JSON(out)
}

func (h *UploadsHandler) complete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Scope string `json:"scope"`
		Key   string `json:"key"`
		RefID string `json:"refId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if body.Scope == "" || body.Key == "" {
		return errs.BadRequest("scope, key required")
	}
	out, err := h.svc.Complete(c.Context(), claims.UserID, claims.Role, uploads.CompleteInput{
		Scope: body.Scope,
		Key:   body.Key,
		RefID: body.RefID,
	})
	if err != nil {
		return err
	}
	return c.JSON(out)
}
