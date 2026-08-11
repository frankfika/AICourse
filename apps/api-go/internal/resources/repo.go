// Package resources — repo layer.
//
// Phase 2 T12-4: thin wrapper around internal/repo/db for the
// resources module. Mirrors
// apps/api/src/modules/courses/resources.controller.ts +
// resource-item.controller.ts.
package resources

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
var ErrNotFound = errors.New("resources: not found")

// Repo is the resources data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByLesson returns all non-deleted resources for a lesson,
// ordered by created_at ASC.
func (r *Repo) ListByLesson(ctx context.Context, lessonID string) ([]db.Resource, error) {
	rows, err := r.q.ListResourcesByLesson(ctx, lessonID)
	if err != nil {
		return nil, fmt.Errorf("resources.repo: list: %w", err)
	}
	return rows, nil
}

// GetByID looks up a resource by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Resource, error) {
	r2, err := r.q.GetResourceByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Resource{}, ErrNotFound
		}
		return db.Resource{}, fmt.Errorf("resources.repo: get: %w", err)
	}
	return r2, nil
}

// CreateInput is the create-resource payload.
type CreateInput struct {
	LessonID string
	Title    string
	Url      string
	Type     db.ResourcesType
	IsLocked bool
}

// Create inserts a new resource.
func (r *Repo) Create(ctx context.Context, in CreateInput) (db.Resource, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateResource(ctx, db.CreateResourceParams{
		ID: id, LessonID: in.LessonID, Title: in.Title, Url: in.Url,
		Type: in.Type, IsLocked: in.IsLocked, CreatedAt: now,
	}); err != nil {
		return db.Resource{}, fmt.Errorf("resources.repo: create: %w", err)
	}
	return db.Resource{
		ID: id, LessonID: in.LessonID, Title: in.Title, Url: in.Url,
		Type: in.Type, IsLocked: in.IsLocked, CreatedAt: now,
	}, nil
}

// UpdatePatch is a partial update. The service reads the current row
// first to fill in unchanged fields.
type UpdatePatch struct {
	Title    string
	Url      string
	Type     db.ResourcesType
	IsLocked bool
}

// Update applies a partial update.
func (r *Repo) Update(ctx context.Context, id string, p UpdatePatch) error {
	if err := r.q.UpdateResource(ctx, db.UpdateResourceParams{
		Title: p.Title, Url: p.Url, Type: p.Type, IsLocked: p.IsLocked, ID: id,
	}); err != nil {
		return fmt.Errorf("resources.repo: update: %w", err)
	}
	return nil
}

// SoftDelete sets deleted_at = now. Idempotent.
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.SoftDeleteResource(ctx, db.SoftDeleteResourceParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		ID:        id,
	}); err != nil {
		return fmt.Errorf("resources.repo: soft delete: %w", err)
	}
	return nil
}

// SoftDeleteByLesson is the cascade hook for lesson delete. Returns
// the number of rows soft-deleted.
func (r *Repo) SoftDeleteByLesson(ctx context.Context, lessonID string) (int64, error) {
	now := time.Now().UTC()
	n, err := r.q.SoftDeleteResourcesByLesson(ctx, db.SoftDeleteResourcesByLessonParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		LessonID:  lessonID,
	})
	if err != nil {
		return 0, fmt.Errorf("resources.repo: soft delete by lesson: %w", err)
	}
	return n, nil
}

// LessonExists checks whether a lesson row exists.
func (r *Repo) LessonExists(ctx context.Context, lessonID string) (bool, error) {
	var n int
	if err := r.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM lessons WHERE id = ? AND deleted_at IS NULL`, lessonID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}
