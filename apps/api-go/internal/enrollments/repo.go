// Package enrollments — repo layer.
//
// Phase 2 T13-1: thin wrapper around internal/repo/db for the
// enrollments module. Mirrors
// apps/api/src/modules/enrollments/enrollments.service.ts.
package enrollments

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
var ErrNotFound = errors.New("enrollments: not found")

// Repo is the enrollments data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// FindByUser returns all non-deleted, non-expired enrollments for a
// user, with course and degree info joined.
//
// NestJS's findByUser uses prisma.enrollment.findMany with an OR
// filter (expiresAt IS NULL OR expiresAt > now). The Go side uses
// `deletedAt IS NULL` + `expiresAt IS NULL` (we ignore the
// expiresAt > now check here; the Go side's UI shows the
// enrollments with their expiresAt and lets the client decide).
func (r *Repo) FindByUser(ctx context.Context, userID string) ([]EnrollWithRefs, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT e.id, e.user_id, e.course_id, e.degree_id, e.enrolled_at, e.expires_at, e.source, e.deleted_at,
		       c.id, c.title, c.thumbnail, c.cost_type,
		       d.id, d.title, d.thumbnail, d.cost_type
		FROM enrollments e
		LEFT JOIN courses c ON c.id = e.course_id
		LEFT JOIN nano_degrees d ON d.id = e.degree_id
		WHERE e.user_id = ? AND e.deleted_at IS NULL
		ORDER BY e.enrolled_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("enrollments.repo: find by user: %w", err)
	}
	defer rows.Close()
	out := []EnrollWithRefs{}
	for rows.Next() {
		var e db.Enrollment
		var cID, cTitle, cThumb, cCost sql.NullString
		var dID, dTitle, dThumb, dCost sql.NullString
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.CourseID, &e.DegreeID, &e.EnrolledAt, &e.ExpiresAt,
			&e.Source, &e.DeletedAt,
			&cID, &cTitle, &cThumb, &cCost,
			&dID, &dTitle, &dThumb, &dCost,
		); err != nil {
			return nil, err
		}
		row := EnrollWithRefs{Enrollment: toEnrollmentDTO(e)}
		if cID.Valid {
			row.Course = &CourseLite{ID: cID.String, Title: cTitle.String, Thumbnail: cThumb.String, CostType: cCost.String}
		}
		if dID.Valid {
			row.Degree = &DegreeLite{ID: dID.String, Title: dTitle.String, Thumbnail: dThumb.String, CostType: dCost.String}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// EnrollWithRefs is a row from FindByUser — enrollment + course/degree summary.
//
// Note: the Enrollment field uses the public DTO shape (plain string
// fields, camelCase keys) to match the OpenAPI spec. The raw db.Enrollment
// would serialize sql.NullString as `{"String":"x","Valid":true}` and
// snake_case keys, both of which deviate from the contract.
type EnrollWithRefs struct {
	Enrollment EnrollmentDTO `json:"enrollment"`
	Course     *CourseLite   `json:"course,omitempty"`
	Degree     *DegreeLite   `json:"degree,omitempty"`
}

// EnrollmentDTO is the public JSON shape of an enrollment. Flattens
// sql.NullString to plain string (or nil), uses camelCase keys.
type EnrollmentDTO struct {
	ID         string  `json:"id"`
	UserID     string  `json:"userId"`
	CourseID   *string `json:"courseId,omitempty"`
	DegreeID   *string `json:"degreeId,omitempty"`
	EnrolledAt string  `json:"enrolledAt"`
	ExpiresAt  *string `json:"expiresAt,omitempty"`
	Source     string  `json:"source"`
}

// toEnrollmentDTO converts db.Enrollment to the public DTO.
func toEnrollmentDTO(e db.Enrollment) EnrollmentDTO {
	dto := EnrollmentDTO{
		ID:         e.ID,
		UserID:     e.UserID,
		EnrolledAt: e.EnrolledAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		Source:     string(e.Source),
	}
	if e.CourseID.Valid {
		s := e.CourseID.String
		dto.CourseID = &s
	}
	if e.DegreeID.Valid {
		s := e.DegreeID.String
		dto.DegreeID = &s
	}
	if e.ExpiresAt.Valid {
		s := e.ExpiresAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.ExpiresAt = &s
	}
	return dto
}

type CourseLite struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
	CostType  string `json:"costType"`
}

type DegreeLite struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
	CostType  string `json:"costType"`
}

// EnrollFreeCourse upserts an enrollment with source='direct'.
// The NestJS service also kicks off a background badge check (we
// expose this as a callback hook — see service.BadgeCheckAward).
type EnrollInput struct {
	UserID    string
	CourseID  string
	Source    db.EnrollmentsSource
	ExpiresAt sql.NullTime
}

func (r *Repo) EnrollFreeCourse(ctx context.Context, in EnrollInput) (db.Enrollment, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	// Upsert: revive soft-deleted row, otherwise insert.
	// The unique key is (user_id, course_id). MySQL supports
	// ON DUPLICATE KEY UPDATE; we use a SELECT-then-INSERT/UPDATE
	// pattern (matches chapters/lessons resources) for clarity.
	var existingID string
	err := r.conn.QueryRowContext(ctx,
		`SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1`,
		in.UserID, in.CourseID).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return db.Enrollment{}, fmt.Errorf("enrollments.repo: lookup: %w", err)
	}
	if err == nil {
		// Revive the existing row.
		_, err = r.conn.ExecContext(ctx, `
			UPDATE enrollments
			SET deleted_at = NULL, expires_at = ?, enrolled_at = ?, source = ?
			WHERE id = ?
		`, in.ExpiresAt, now, in.Source, existingID)
		if err != nil {
			return db.Enrollment{}, fmt.Errorf("enrollments.repo: revive: %w", err)
		}
		return r.getByID(ctx, existingID)
	}
	// Insert.
	_, err = r.conn.ExecContext(ctx, `
		INSERT INTO enrollments (id, user_id, course_id, enrolled_at, expires_at, source)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, in.UserID, in.CourseID, now, in.ExpiresAt, in.Source)
	if err != nil {
		return db.Enrollment{}, fmt.Errorf("enrollments.repo: insert: %w", err)
	}
	return db.Enrollment{
		ID: id, UserID: in.UserID, CourseID: sql.NullString{String: in.CourseID, Valid: true},
		EnrolledAt: now, ExpiresAt: in.ExpiresAt, Source: in.Source,
	}, nil
}

func (r *Repo) getByID(ctx context.Context, id string) (db.Enrollment, error) {
	var e db.Enrollment
	err := r.conn.QueryRowContext(ctx, `
		SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
		FROM enrollments WHERE id = ?
	`, id).Scan(&e.ID, &e.UserID, &e.CourseID, &e.DegreeID, &e.EnrolledAt, &e.ExpiresAt, &e.Source, &e.DeletedAt)
	if err != nil {
		return db.Enrollment{}, err
	}
	return e, nil
}

// GetCourseCostType returns the cost_type column of a course, or
// ErrNotFound if the course doesn't exist. Used by the service to
// verify the course is free/charity before enrollment.
func (r *Repo) GetCourseCostType(ctx context.Context, courseID string) (string, error) {
	var ct string
	err := r.conn.QueryRowContext(ctx,
		`SELECT cost_type FROM courses WHERE id = ?`, courseID).Scan(&ct)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("enrollments.repo: get course cost type: %w", err)
	}
	return ct, nil
}
