// Package degrees — repo layer.
//
// Phase 2 T14-1: thin wrapper around internal/repo/db for the
// degrees module. Mirrors apps/api/src/modules/degrees/degrees.service.ts.
package degrees

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("degrees: not found")

// Repo is the degrees data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// GetByID looks up a degree by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.NanoDegree, error) {
	d, err := r.q.GetDegreeByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.NanoDegree{}, ErrNotFound
		}
		return db.NanoDegree{}, fmt.Errorf("degrees.repo: get: %w", err)
	}
	return d, nil
}

// List returns degrees filtered by status. status="" means "no filter".
// search applies a LIKE on title + description (case-insensitive).
//
// Note: List uses dynamic SQL (not sqlc) because the filter
// combinations (status + search) vary per request. The query is
// built with parameterized placeholders to avoid SQL injection.
func (r *Repo) List(ctx context.Context, status, search string, isAdmin bool) ([]db.NanoDegree, error) {
	q := `SELECT id, title, description, learning_points, price, icon, cost_type, thumbnail, status, created_at, updated_at
	      FROM nano_degrees WHERE 1=1`
	args := []any{}
	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	} else if !isAdmin {
		// Public: hide drafts.
		q += ` AND status = 'published'`
	}
	if search != "" {
		q += ` AND (title LIKE ? OR description LIKE ?)`
		args = append(args, "%"+search+"%", "%"+search+"%")
	}
	q += ` ORDER BY created_at DESC LIMIT 200`

	rows, err := r.conn.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("degrees.repo: list: %w", err)
	}
	defer rows.Close()
	out := []db.NanoDegree{}
	for rows.Next() {
		var d db.NanoDegree
		if err := rows.Scan(
			&d.ID, &d.Title, &d.Description, &d.LearningPoints, &d.Price,
			&d.Icon, &d.CostType, &d.Thumbnail, &d.Status, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// Create inserts a new degree.
func (r *Repo) Create(ctx context.Context, d db.NanoDegree) error {
	_, err := r.q.CreateDegree(ctx, db.CreateDegreeParams{
		ID:             d.ID,
		Title:          d.Title,
		Description:    d.Description,
		LearningPoints: d.LearningPoints,
		Price:          d.Price,
		Icon:           d.Icon,
		CostType:       d.CostType,
		Thumbnail:      d.Thumbnail,
		Status:         d.Status,
		UpdatedAt:      d.UpdatedAt,
	})
	return err
}

// Update overwrites a degree row in full. The service reads the
// current row first and fills unchanged fields.
func (r *Repo) Update(ctx context.Context, d db.NanoDegree) error {
	return r.q.UpdateDegree(ctx, db.UpdateDegreeParams{
		Title:          d.Title,
		Description:    d.Description,
		LearningPoints: d.LearningPoints,
		Price:          d.Price,
		Icon:           d.Icon,
		CostType:       d.CostType,
		Thumbnail:      d.Thumbnail,
		Status:         d.Status,
		UpdatedAt:      d.UpdatedAt,
		ID:             d.ID,
	})
}

// Delete removes a degree (hard delete — no soft delete on degrees).
func (r *Repo) Delete(ctx context.Context, id string) error {
	return r.q.DeleteDegree(ctx, id)
}

// ListCourses returns the courses linked to a degree in curriculum order.
func (r *Repo) ListCourses(ctx context.Context, degreeID string) ([]string, error) {
	ids, err := r.q.ListDegreeCourses(ctx, degreeID)
	if err != nil {
		return nil, fmt.Errorf("degrees.repo: list courses: %w", err)
	}
	return ids, nil
}

// UpsertCourse links a course to a degree (or updates its order_index
// if already linked). Idempotent.
func (r *Repo) UpsertCourse(ctx context.Context, degreeID, courseID string, orderIndex int32) error {
	return r.q.UpsertDegreeCourse(ctx, db.UpsertDegreeCourseParams{
		DegreeID:   degreeID,
		CourseID:   courseID,
		OrderIndex: orderIndex,
	})
}

// CountActiveEnrollments returns the number of non-deleted enrollments
// for the degree. Used by delete to refuse deletion when students are
// actively enrolled.
func (r *Repo) CountActiveEnrollments(ctx context.Context, degreeID string) (int64, error) {
	n, err := r.q.CountActiveEnrollmentsByDegree(ctx, sql.NullString{String: degreeID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("degrees.repo: count enrollments: %w", err)
	}
	return n, nil
}
