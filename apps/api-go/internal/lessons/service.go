// Package lessons — service layer.
//
// Phase 2 T12-3: business logic for /api/v1/chapters/:chapterId/lessons/*
// and /api/v1/lessons/:id. Mirrors
// apps/api/src/modules/courses/lessons.controller.ts 1:1.
//
// Also exposes SoftDeleteByChapter which the chapters service calls as
// a cascade hook — that completes the stub left in T12-2.
package lessons

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the lessons business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// APIInput is the API-shaped create/update payload.
type APIInput struct {
	Title         string
	Description   string
	VideoURL      string
	VideoDuration *int32 // optional
	IsPreview     *bool  // optional
	OrderIndex    *int32 // optional; auto-assigned on create when nil
}

// ListByChapter returns all non-deleted lessons for a chapter.
func (s *Service) ListByChapter(ctx context.Context, chapterID string) ([]db.Lesson, error) {
	exists, err := s.repo.ChapterExists(ctx, chapterID)
	if err != nil {
		return nil, errs.Internal("check chapter", err)
	}
	if !exists {
		return nil, errs.NotFound("Chapter not found")
	}
	rows, err := s.repo.ListByChapter(ctx, chapterID)
	if err != nil {
		return nil, errs.Internal("list lessons", err)
	}
	return rows, nil
}

// Create inserts a new lesson. orderIndex may be nil for auto-assign.
func (s *Service) Create(ctx context.Context, chapterID string, in APIInput) (db.Lesson, error) {
	if err := s.validateTitle(in.Title); err != nil {
		return db.Lesson{}, err
	}
	if err := s.validateURL(in.VideoURL, "videoUrl"); err != nil {
		return db.Lesson{}, err
	}
	if in.VideoDuration != nil && *in.VideoDuration < 0 {
		return db.Lesson{}, errs.BadRequest("videoDuration must be ≥ 0")
	}
	exists, err := s.repo.ChapterExists(ctx, chapterID)
	if err != nil {
		return db.Lesson{}, errs.Internal("check chapter", err)
	}
	if !exists {
		return db.Lesson{}, errs.NotFound("Chapter not found")
	}

	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	} else {
		max, err := s.repo.MaxOrderIndex(ctx, chapterID)
		if err != nil {
			return db.Lesson{}, errs.Internal("max order index", err)
		}
		orderIdx = max + 1
	}

	isPreview := false
	if in.IsPreview != nil {
		isPreview = *in.IsPreview
	}

	out, err := s.repo.Create(ctx, CreateInput{
		ChapterID:     chapterID,
		Title:         in.Title,
		Description:   nullableString(in.Description),
		VideoURL:      nullableString(in.VideoURL),
		VideoDuration: nullableInt32(in.VideoDuration),
		OrderIndex:    orderIdx,
		IsPreview:     isPreview,
	})
	if err != nil {
		return db.Lesson{}, errs.Internal("create lesson", err)
	}
	s.writeAudit(ctx, "lesson.create", out.ID, chapterID)
	return out, nil
}

// Update applies a partial update. Reads the current row first to
// fill in unchanged fields.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (db.Lesson, error) {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return db.Lesson{}, errs.NotFound("Lesson not found")
		}
		return db.Lesson{}, errs.Internal("lookup lesson", err)
	}
	if in.Title != "" {
		if err := s.validateTitle(in.Title); err != nil {
			return db.Lesson{}, err
		}
	}
	if in.VideoURL != "" {
		if err := s.validateURL(in.VideoURL, "videoUrl"); err != nil {
			return db.Lesson{}, err
		}
	}
	if in.VideoDuration != nil && *in.VideoDuration < 0 {
		return db.Lesson{}, errs.BadRequest("videoDuration must be ≥ 0")
	}

	title := before.Title
	if in.Title != "" {
		title = in.Title
	}
	desc := before.Description
	if in.Description != "" || (in.Description == "" && in.Title != "") {
		// PATCH clears description when explicitly set to empty.
		desc = nullableString(in.Description)
	}
	videoURL := before.VideoUrl
	if in.VideoURL != "" {
		videoURL = nullableString(in.VideoURL)
	}
	videoDur := before.VideoDuration
	if in.VideoDuration != nil {
		videoDur = nullableInt32(in.VideoDuration)
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	isPreview := before.IsPreview
	if in.IsPreview != nil {
		isPreview = *in.IsPreview
	}

	if err := s.repo.Update(ctx, id, UpdatePatch{
		Title: title, Description: desc, VideoURL: videoURL,
		VideoDuration: videoDur, OrderIndex: orderIdx, IsPreview: isPreview,
	}); err != nil {
		return db.Lesson{}, errs.Internal("update lesson", err)
	}
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return db.Lesson{}, errs.Internal("reload lesson", err)
	}
	s.writeAudit(ctx, "lesson.update", id, before.ChapterID)
	return after, nil
}

// Delete soft-deletes a lesson. Also cascades to resources in the
// same soft-delete pass (NestJS does the same in the resources
// service hook; here we call the resources cascade hook after
// successful soft-delete).
func (s *Service) Delete(ctx context.Context, id string) error {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Lesson not found")
		}
		return errs.Internal("lookup lesson", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete lesson", err)
	}
	// Cascade soft-delete to resources. The hook is a no-op stub until
	// T12-4 ships; the lesson soft-delete is still applied.
	if _, err := ResourceSoftDeleteByLesson(ctx, s.repo.conn, id); err != nil {
		s.log.Warn("resource cascade soft-delete failed", zap.String("lessonID", id), zap.Error(err))
	}
	s.writeAudit(ctx, "lesson.delete", id, before.ChapterID)
	return nil
}

// ReorderResult is the response shape for POST /lessons/reorder.
type ReorderResult struct {
	OK    bool     `json:"ok"`
	Count int      `json:"count"`
	IDs   []string `json:"ids"`
}

// Reorder accepts a list of lesson ids and re-assigns orderIndex based
// on the array position. Validates that every id belongs to the
// supplied chapterId (NestJS does the same).
func (s *Service) Reorder(ctx context.Context, chapterID string, ids []string) (ReorderResult, error) {
	if len(ids) == 0 {
		return ReorderResult{}, errs.BadRequest("ids must be a non-empty array")
	}
	refs, err := s.repo.LessonsByIDs(ctx, ids)
	if err != nil {
		return ReorderResult{}, errs.Internal("lookup lessons", err)
	}
	if int64(len(refs)) != int64(len(ids)) {
		return ReorderResult{}, errs.BadRequest(
			"some lesson ids not found: expected " + itoa(len(ids)) + ", got " + itoa(len(refs)))
	}
	for _, r := range refs {
		if r.ChapterID != chapterID {
			return ReorderResult{}, errs.Forbidden(
				"lessons do not belong to chapter " + chapterID)
		}
	}
	for i, id := range ids {
		if err := s.repo.Update(ctx, id, UpdatePatch{
			Title: "", Description: sql.NullString{}, VideoURL: sql.NullString{},
			VideoDuration: sql.NullInt32{}, OrderIndex: int32(i), IsPreview: false,
		}); err != nil {
			return ReorderResult{}, errs.Internal("reorder lesson "+id, err)
		}
	}
	s.writeAudit(ctx, "lesson.reorder", chapterID, chapterID)
	return ReorderResult{OK: true, Count: len(ids), IDs: ids}, nil
}

// writeAudit is a best-effort audit log write.
func (s *Service) writeAudit(ctx context.Context, action, entityID, chapterID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, details, created_at)
		VALUES (UUID(), ?, 'lesson', ?, JSON_OBJECT('chapterId', ?), NOW(3))
	`, action, entityID, chapterID)
	if err != nil {
		s.log.Warn("audit log write failed", zap.String("action", action), zap.Error(err))
	}
}

// ============ validators ============

func (s *Service) validateTitle(t string) error {
	if strings.TrimSpace(t) == "" {
		return errs.BadRequest("title is required")
	}
	if len(t) > 191 {
		return errs.BadRequest("title too long (max 191)")
	}
	return nil
}

// validateURL mirrors the SafeUrl decorator: only http/https allowed.
// Empty string is OK (means "no change" on update).
func (s *Service) validateURL(url, field string) error {
	if url == "" {
		return nil
	}
	if len(url) > 500 {
		return errs.BadRequest(field + " too long")
	}
	low := strings.ToLower(url)
	if !strings.HasPrefix(low, "http://") && !strings.HasPrefix(low, "https://") {
		return errs.BadRequest(field + " must be http(s)://")
	}
	return nil
}

func nullableString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

func nullableInt32(n *int32) sql.NullInt32 {
	if n == nil {
		return sql.NullInt32{}
	}
	return sql.NullInt32{Int32: *n, Valid: true}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	digits := []byte{}
	for nn := n; nn > 0; nn /= 10 {
		digits = append([]byte{byte('0' + nn%10)}, digits...)
	}
	if neg {
		return "-" + string(digits)
	}
	return string(digits)
}
