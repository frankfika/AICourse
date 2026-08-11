// Package chapters — repo layer.
//
// Phase 2 T12-2: thin wrapper around internal/repo/db (sqlc-generated)
// for the chapters module. Mirrors
// apps/api/src/modules/courses/chapters.controller.ts.
package chapters

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
var ErrNotFound = errors.New("chapters: not found")

// Repo is the chapters data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByCourse returns all non-deleted chapters for a course, ordered
// by orderIndex ASC.
func (r *Repo) ListByCourse(ctx context.Context, courseID string) ([]db.Chapter, error) {
	rows, err := r.q.ListChaptersByCourse(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("chapters.repo: list: %w", err)
	}
	return rows, nil
}

// GetByID looks up a single chapter, filtering out soft-deleted.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Chapter, error) {
	c, err := r.q.GetChapterByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Chapter{}, ErrNotFound
		}
		return db.Chapter{}, fmt.Errorf("chapters.repo: get: %w", err)
	}
	return c, nil
}

// GetByIDIncludingDeleted is the admin variant.
func (r *Repo) GetByIDIncludingDeleted(ctx context.Context, id string) (db.Chapter, error) {
	c, err := r.q.GetChapterByIDIncludingDeleted(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Chapter{}, ErrNotFound
		}
		return db.Chapter{}, fmt.Errorf("chapters.repo: get incl deleted: %w", err)
	}
	return c, nil
}

// CreateInput is the create-chapter payload.
type CreateInput struct {
	CourseID    string
	Title       string
	Description sql.NullString
	OrderIndex  int32
}

// Create inserts a new chapter.
func (r *Repo) Create(ctx context.Context, in CreateInput) (db.Chapter, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateChapter(ctx, db.CreateChapterParams{
		ID: id, CourseID: in.CourseID, Title: in.Title,
		Description: in.Description, OrderIndex: in.OrderIndex, CreatedAt: now,
	}); err != nil {
		return db.Chapter{}, fmt.Errorf("chapters.repo: create: %w", err)
	}
	return db.Chapter{
		ID: id, CourseID: in.CourseID, Title: in.Title,
		Description: in.Description, OrderIndex: in.OrderIndex, CreatedAt: now,
	}, nil
}

// UpdatePatch is a partial update. The service layer reads the current
// row first to fill in unchanged fields, since UpdateChapter takes
// all 3 fields.
type UpdatePatch struct {
	Title       string
	Description sql.NullString
	OrderIndex  int32
}

// Update applies a partial update.
func (r *Repo) Update(ctx context.Context, id string, p UpdatePatch) error {
	if err := r.q.UpdateChapter(ctx, db.UpdateChapterParams{
		Title: p.Title, Description: p.Description, OrderIndex: p.OrderIndex, ID: id,
	}); err != nil {
		return fmt.Errorf("chapters.repo: update: %w", err)
	}
	return nil
}

// SoftDelete sets deleted_at = now. Idempotent.
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.SoftDeleteChapter(ctx, db.SoftDeleteChapterParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		ID:        id,
	}); err != nil {
		return fmt.Errorf("chapters.repo: soft delete: %w", err)
	}
	return nil
}

// MaxOrderIndex returns the next available orderIndex for a course.
// (-1 → 0 for the first chapter.)
func (r *Repo) MaxOrderIndex(ctx context.Context, courseID string) (int32, error) {
	v, err := r.q.MaxChapterOrderIndex(ctx, courseID)
	if err != nil {
		return 0, fmt.Errorf("chapters.repo: max order index: %w", err)
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

// ChaptersByIDs returns chapters matching the supplied ids, used by
// reorder to verify ownership (NestJS does the same).
type ChapterRef struct {
	ID       string
	CourseID string
}

func (r *Repo) ChaptersByIDs(ctx context.Context, ids []string) ([]ChapterRef, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := r.q.ChaptersByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("chapters.repo: by ids: %w", err)
	}
	out := make([]ChapterRef, 0, len(rows))
	for _, c := range rows {
		out = append(out, ChapterRef{ID: c.ID, CourseID: c.CourseID})
	}
	return out, nil
}

// CourseExists checks whether a course row exists. Used to validate
// courseId in chapter create.
func (r *Repo) CourseExists(ctx context.Context, courseID string) (bool, error) {
	var n int
	if err := r.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM courses WHERE id = ?`, courseID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

// LessonSoftDeleteByChapter is the cascade-soft-delete of all lessons
// under a chapter. The ChapterService.Delete calls this in a tx.
// Implemented in the lessons module; this is a no-op stub until T12-3
// ships.
var LessonSoftDeleteByChapter = func(_ context.Context, _ *sql.DB, _ string) (int64, error) {
	return 0, nil
}
