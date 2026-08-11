// Package lessons — repo layer.
//
// Phase 2 T12-3: thin wrapper around internal/repo/db for the lessons
// module. Mirrors apps/api/src/modules/courses/lessons.controller.ts.
package lessons

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("lessons: not found")

// Repo is the lessons data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByChapter returns all non-deleted lessons for a chapter, ordered
// by orderIndex ASC.
func (r *Repo) ListByChapter(ctx context.Context, chapterID string) ([]db.Lesson, error) {
	rows, err := r.q.ListLessonsByChapter(ctx, chapterID)
	if err != nil {
		return nil, fmt.Errorf("lessons.repo: list: %w", err)
	}
	return rows, nil
}

// GetByID looks up a lesson by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Lesson, error) {
	l, err := r.q.GetLessonByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Lesson{}, ErrNotFound
		}
		return db.Lesson{}, fmt.Errorf("lessons.repo: get: %w", err)
	}
	return l, nil
}

// CreateInput is the create-lesson payload.
type CreateInput struct {
	ChapterID     string
	Title         string
	Description   sql.NullString
	VideoURL      sql.NullString
	VideoDuration sql.NullInt32
	OrderIndex    int32
	IsPreview     bool
}

// Create inserts a new lesson.
func (r *Repo) Create(ctx context.Context, in CreateInput) (db.Lesson, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateLesson(ctx, db.CreateLessonParams{
		ID: id, ChapterID: in.ChapterID, Title: in.Title,
		Description: in.Description, VideoUrl: in.VideoURL,
		VideoDuration: in.VideoDuration, OrderIndex: in.OrderIndex,
		IsPreview: in.IsPreview, CreatedAt: now,
	}); err != nil {
		return db.Lesson{}, fmt.Errorf("lessons.repo: create: %w", err)
	}
	return db.Lesson{
		ID: id, ChapterID: in.ChapterID, Title: in.Title,
		Description: in.Description, VideoUrl: in.VideoURL,
		VideoDuration: in.VideoDuration, OrderIndex: in.OrderIndex,
		IsPreview: in.IsPreview, CreatedAt: now,
	}, nil
}

// UpdatePatch is a partial update. The service layer reads the current
// row first to fill in unchanged fields.
type UpdatePatch struct {
	Title         string
	Description   sql.NullString
	VideoURL      sql.NullString
	VideoDuration sql.NullInt32
	OrderIndex    int32
	IsPreview     bool
}

// Update applies a partial update.
func (r *Repo) Update(ctx context.Context, id string, p UpdatePatch) error {
	if err := r.q.UpdateLesson(ctx, db.UpdateLessonParams{
		Title: p.Title, Description: p.Description, VideoUrl: p.VideoURL,
		VideoDuration: p.VideoDuration, OrderIndex: p.OrderIndex,
		IsPreview: p.IsPreview, ID: id,
	}); err != nil {
		return fmt.Errorf("lessons.repo: update: %w", err)
	}
	return nil
}

// SoftDelete sets deleted_at = now. Idempotent.
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.SoftDeleteLesson(ctx, db.SoftDeleteLessonParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		ID:        id,
	}); err != nil {
		return fmt.Errorf("lessons.repo: soft delete: %w", err)
	}
	return nil
}

// MaxOrderIndex returns the next available orderIndex for a chapter.
func (r *Repo) MaxOrderIndex(ctx context.Context, chapterID string) (int32, error) {
	v, err := r.q.MaxLessonOrderIndex(ctx, chapterID)
	if err != nil {
		return 0, fmt.Errorf("lessons.repo: max order index: %w", err)
	}
	switch x := v.(type) {
	case int32:
		return x, nil
	case int64:
		return int32(x), nil
	case int:
		return int32(x), nil
	}
	return 0, nil
}

// LessonRef is the slim shape used by reorder ownership checks.
type LessonRef struct {
	ID        string
	ChapterID string
}

// LessonsByIDs returns lessons matching the supplied ids.
func (r *Repo) LessonsByIDs(ctx context.Context, ids []string) ([]LessonRef, error) {
	rows, err := r.q.LessonsByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("lessons.repo: by ids: %w", err)
	}
	out := make([]LessonRef, 0, len(rows))
	for _, r := range rows {
		out = append(out, LessonRef{ID: r.ID, ChapterID: r.ChapterID})
	}
	return out, nil
}

// ChapterExists checks whether a chapter row exists. Used to validate
// chapterId in lesson create.
func (r *Repo) ChapterExists(ctx context.Context, chapterID string) (bool, error) {
	var n int
	if err := r.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM chapters WHERE id = ? AND deleted_at IS NULL`, chapterID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

// SoftDeleteByChapter is the cascade hook used by chapters.Service.Delete
// to soft-delete all lessons under a chapter. Returns rows affected.
func (r *Repo) SoftDeleteByChapter(ctx context.Context, chapterID string) (int64, error) {
	now := time.Now().UTC()
	n, err := r.q.SoftDeleteLessonsByChapter(ctx, db.SoftDeleteLessonsByChapterParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		ChapterID: chapterID,
	})
	if err != nil {
		return 0, fmt.Errorf("lessons.repo: soft delete by chapter: %w", err)
	}
	return n, nil
}

// ResourceSoftDeleteByLesson is the cascade hook used by lessons.Service.Delete
// to soft-delete all resources under a lesson. Stub — replaced at
// boot by mountResources() in cmd/server/main.go. Until the resources
// module is wired, no resources are cascaded; lessons soft-delete still
// works and any orphan resources will be picked up in a follow-up
// sweep. Safe because resources have hard FK CASCADE to lessons
// (DB-level cascade still works on physical delete).
var ResourceSoftDeleteByLesson = func(_ context.Context, _ *sql.DB, _ string) (int64, error) {
	return 0, nil
}
