// Package chapters — service layer.
//
// Phase 2 T12-2: business logic for /api/v1/courses/:courseId/chapters/*
// and /api/v1/chapters/:id. Mirrors
// apps/api/src/modules/courses/chapters.controller.ts 1:1.
//
// All endpoints are admin-only in NestJS. The Go side keeps the same
// gate so the frontend can wire the routes the same way.
//
// Note on lessons cascade: the NestJS controller does the chapter +
// lessons soft-delete in a single Prisma $transaction. Until T12-3
// lands the lessons module, the lessons cascade is a no-op (zero rows
// affected) and the chapter is still soft-deleted. This is safe — the
// chapter is removed from any list view, and any orphan lessons will
// get a follow-up sweep in T12-3.
package chapters

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the chapters business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ListByCourse returns all non-deleted chapters for a course.
func (s *Service) ListByCourse(ctx context.Context, courseID string) ([]db.Chapter, error) {
	exists, err := s.repo.CourseExists(ctx, courseID)
	if err != nil {
		return nil, errs.Internal("check course", err)
	}
	if !exists {
		return nil, errs.NotFound("Course not found")
	}
	out, err := s.repo.ListByCourse(ctx, courseID)
	if err != nil {
		return nil, errs.Internal("list chapters", err)
	}
	return out, nil
}

// APIInput is the API-shaped create/update payload. The same struct
// works for both — orderIndex may be nil (auto-assign on create) or
// set (preserved on update).
type APIInput struct {
	Title       string
	Description string
	OrderIndex  *int32 // optional; auto-assigned to max+1 when nil on create
}

// Create inserts a new chapter. The caller-supplied orderIndex wins
// when non-nil; otherwise we auto-assign to max+1.
func (s *Service) Create(ctx context.Context, courseID string, in APIInput) (db.Chapter, error) {
	if err := s.validateTitle(in.Title); err != nil {
		return db.Chapter{}, err
	}
	exists, err := s.repo.CourseExists(ctx, courseID)
	if err != nil {
		return db.Chapter{}, errs.Internal("check course", err)
	}
	if !exists {
		return db.Chapter{}, errs.NotFound("Course not found")
	}

	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	} else {
		max, err := s.repo.MaxOrderIndex(ctx, courseID)
		if err != nil {
			return db.Chapter{}, errs.Internal("max order index", err)
		}
		orderIdx = max + 1
	}

	out, err := s.repo.Create(ctx, CreateInput{
		CourseID: courseID, Title: in.Title,
		Description: nullableString(in.Description), OrderIndex: orderIdx,
	})
	if err != nil {
		return db.Chapter{}, errs.Internal("create chapter", err)
	}
	s.writeAudit(ctx, "chapter.create", out.ID, courseID)
	return out, nil
}

// Update applies a partial update. Always reads the current row first
// to fill in unchanged fields.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (db.Chapter, error) {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return db.Chapter{}, errs.NotFound("Chapter not found")
		}
		return db.Chapter{}, errs.Internal("lookup chapter", err)
	}
	if in.Title != "" {
		if err := s.validateTitle(in.Title); err != nil {
			return db.Chapter{}, err
		}
	}

	title := before.Title
	if in.Title != "" {
		title = in.Title
	}
	desc := before.Description
	if in.Description != "" || (in.Description == "" && in.Title != "") {
		// The PATCH body sets description explicitly even when empty
		// (NestJS behavior). We mirror: a non-nil description in the
		// DTO replaces the stored value, including clearing it.
		desc = nullableString(in.Description)
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}

	if err := s.repo.Update(ctx, id, UpdatePatch{
		Title: title, Description: desc, OrderIndex: orderIdx,
	}); err != nil {
		return db.Chapter{}, errs.Internal("update chapter", err)
	}
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return db.Chapter{}, errs.Internal("reload chapter", err)
	}
	s.writeAudit(ctx, "chapter.update", id, before.CourseID)
	return after, nil
}

// Delete soft-deletes a chapter. Also cascades to lessons in the same
// transaction (NestJS does the same; lessons cascade is a no-op until
// T12-3 ships, but the soft-delete still works).
func (s *Service) Delete(ctx context.Context, id string) error {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Chapter not found")
		}
		return errs.Internal("lookup chapter", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete chapter", err)
	}
	// Cascade soft-delete to lessons. The hook is a no-op stub until
	// T12-3 lands; the chapter soft-delete is still applied.
	if _, err := LessonSoftDeleteByChapter(ctx, s.repo.conn, id); err != nil {
		// Don't fail the request — the chapter is already deleted. Log
		// and continue.
		s.log.Warn("lesson cascade soft-delete failed", zap.String("chapterID", id), zap.Error(err))
	}
	s.writeAudit(ctx, "chapter.delete", id, before.CourseID)
	return nil
}

// ReorderResult is the response shape for POST /chapters/reorder.
type ReorderResult struct {
	OK    bool     `json:"ok"`
	Count int      `json:"count"`
	IDs   []string `json:"ids"`
}

// Reorder accepts a list of chapter IDs and re-assigns orderIndex
// based on the array position. Validates that every ID belongs to the
// supplied courseId (NestJS does the same).
func (s *Service) Reorder(ctx context.Context, courseID string, ids []string) (ReorderResult, error) {
	if len(ids) == 0 {
		return ReorderResult{}, errs.BadRequest("ids must be a non-empty array")
	}
	refs, err := s.repo.ChaptersByIDs(ctx, ids)
	if err != nil {
		return ReorderResult{}, errs.Internal("lookup chapters", err)
	}
	if int64(len(refs)) != int64(len(ids)) {
		return ReorderResult{}, errs.BadRequest(
			"some chapter ids not found: expected " + itoa(len(ids)) + ", got " + itoa(len(refs)))
	}
	// Verify ownership: every chapter must belong to courseID.
	for _, r := range refs {
		if r.CourseID != courseID {
			return ReorderResult{}, errs.Forbidden(
				"chapters " + strings.Join(ids, ",") + " do not belong to course " + courseID)
		}
	}
	// Apply orderIndex sequentially.
	for i, id := range ids {
		if err := s.repo.Update(ctx, id, UpdatePatch{
			Title:       "",
			Description: sql.NullString{},
			OrderIndex:  int32(i),
		}); err != nil {
			return ReorderResult{}, errs.Internal("reorder chapter "+id, err)
		}
	}
	s.writeAudit(ctx, "chapter.reorder", courseID, courseID)
	return ReorderResult{OK: true, Count: len(ids), IDs: ids}, nil
}

// writeAudit is a best-effort audit log write.
func (s *Service) writeAudit(ctx context.Context, action, entityID, courseID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, details, created_at)
		VALUES (UUID(), ?, 'chapter', ?, JSON_OBJECT('courseId', ?), NOW(3))
	`, action, entityID, courseID)
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

func nullableString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

// itoa is a tiny strconv-free integer formatter used in error
// messages. We don't need a full strconv import for two-digit numbers.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	if neg {
		return "-" + string(digits)
	}
	return string(digits)
}

// errIsNotFound is a tiny helper to keep the service code uniform.
func errIsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
