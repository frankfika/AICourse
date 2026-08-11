// Package courses — repo layer.
//
// Phase 2 T12-1: thin wrapper around internal/repo/db (sqlc-generated)
// for the courses module. The list query drops to database/sql for the
// dynamic status filter; everything else is static sqlc.
//
// Mirrors apps/api/src/modules/courses/courses.service.ts.
package courses

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("courses: not found")

// Repo is the courses data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo from an open *sql.DB.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListFilter holds the optional filters supported by List.
type ListFilter struct {
	Status     string // "" | "draft" | "published" | "archived"
	CourseType string // "" | "own" | "partner" | "public" | "third_party"
	Search     string
	Page       int
	Limit      int
}

// ListResult is the paginated response shape.
type ListResult struct {
	Data  []db.Course `json:"data"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

// List returns published courses by default. When allowNonPublished is
// true, draft/archived courses are included (admin path).
//
// search matches against title, description, instructor (LIKE %x%).
// Default page size 20, max 100.
func (r *Repo) List(ctx context.Context, f ListFilter, allowNonPublished bool) (ListResult, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	var conds []string
	var args []any
	// Public path: force status='published' unless admin override.
	if !allowNonPublished {
		conds = append(conds, "status = 'published'")
	} else if f.Status != "" {
		conds = append(conds, "status = ?")
		args = append(args, f.Status)
	}
	if f.CourseType != "" {
		conds = append(conds, "course_type = ?")
		args = append(args, f.CourseType)
	}
	if f.Search != "" {
		conds = append(conds, "(title LIKE ? OR description LIKE ? OR instructor LIKE ?)")
		like := "%" + f.Search + "%"
		args = append(args, like, like, like)
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	dataSQL := fmt.Sprintf(`
		SELECT id, title, description, learning_points, instructor, level, duration,
		       thumbnail, tags, cost_type, price, status, course_type, external_url,
		       source_video_url, source_platform, created_at, updated_at,
		       industry_id, category_id
		FROM courses
		%s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, where)
	dataArgs := append(append([]any{}, args...), f.Limit, offset)

	rows, err := r.conn.QueryContext(ctx, dataSQL, dataArgs...)
	if err != nil {
		return ListResult{}, fmt.Errorf("courses.repo: list: %w", err)
	}
	defer rows.Close()
	out := []db.Course{}
	for rows.Next() {
		var c db.Course
		if err := rows.Scan(
			&c.ID, &c.Title, &c.Description, &c.LearningPoints, &c.Instructor,
			&c.Level, &c.Duration, &c.Thumbnail, &c.Tags, &c.CostType,
			&c.Price, &c.Status, &c.CourseType, &c.ExternalUrl,
			&c.SourceVideoUrl, &c.SourcePlatform, &c.CreatedAt, &c.UpdatedAt,
			&c.IndustryID, &c.CategoryID,
		); err != nil {
			return ListResult{}, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, err
	}

	// Count with the same WHERE (without LIMIT/OFFSET).
	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM courses %s`, where)
	var total int64
	if err := r.conn.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return ListResult{}, fmt.Errorf("courses.repo: count: %w", err)
	}
	return ListResult{Data: out, Total: total, Page: f.Page, Limit: f.Limit}, nil
}

// GetByID looks up a course by primary key. includeDraft lets callers
// see draft/archived rows (admin path).
func (r *Repo) GetByID(ctx context.Context, id string, includeDraft bool) (db.Course, error) {
	var (
		c   db.Course
		err error
	)
	if includeDraft {
		c, err = r.q.GetCourseByIDAnyStatus(ctx, id)
	} else {
		c, err = r.q.GetCourseByID(ctx, id)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Course{}, ErrNotFound
		}
		return db.Course{}, fmt.Errorf("courses.repo: get by id: %w", err)
	}
	return c, nil
}

// CreateInput is the admin create-course payload.
type CreateInput struct {
	Title          string
	Description    string
	LearningPoints string
	Instructor     string
	Level          db.CoursesLevel
	Duration       string
	Thumbnail      string
	Tags           string
	CostType       db.CoursesCostType
	Price          string
	Status         db.CoursesStatus // optional; defaults to draft
	CourseType     db.CoursesCourseType
	ExternalURL    sql.NullString
	SourceVideoURL sql.NullString
	SourcePlatform sql.NullString
	IndustryID     sql.NullString
	CategoryID     sql.NullString
}

// Create inserts a new course. Caller supplies the input; the repo
// generates id + timestamps.
func (r *Repo) Create(ctx context.Context, in CreateInput) (db.Course, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if in.Status == "" {
		in.Status = db.CoursesStatusDraft
	}
	if _, err := r.q.CreateCourse(ctx, db.CreateCourseParams{
		ID:             id,
		Title:          in.Title,
		Description:    in.Description,
		LearningPoints: in.LearningPoints,
		Instructor:     in.Instructor,
		Level:          in.Level,
		Duration:       in.Duration,
		Thumbnail:      in.Thumbnail,
		Tags:           in.Tags,
		CostType:       in.CostType,
		Price:          in.Price,
		Status:         in.Status,
		CourseType:     in.CourseType,
		ExternalUrl:    in.ExternalURL,
		SourceVideoUrl: in.SourceVideoURL,
		SourcePlatform: in.SourcePlatform,
		CreatedAt:      now,
		UpdatedAt:      now,
		IndustryID:     in.IndustryID,
		CategoryID:     in.CategoryID,
	}); err != nil {
		return db.Course{}, fmt.Errorf("courses.repo: create: %w", err)
	}
	return db.Course{
		ID: id, Title: in.Title, Description: in.Description,
		LearningPoints: in.LearningPoints, Instructor: in.Instructor,
		Level: in.Level, Duration: in.Duration, Thumbnail: in.Thumbnail,
		Tags: in.Tags, CostType: in.CostType, Price: in.Price,
		Status: in.Status, CourseType: in.CourseType,
		ExternalUrl: in.ExternalURL, SourceVideoUrl: in.SourceVideoURL,
		SourcePlatform: in.SourcePlatform, IndustryID: in.IndustryID,
		CategoryID: in.CategoryID, CreatedAt: now, UpdatedAt: now,
	}, nil
}

// UpdatePatch is a partial update. The service layer validates which
// fields the admin is allowed to change and shapes the patch; this
// repo just writes whatever it's given.
type UpdatePatch struct {
	Title          string
	Description    string
	LearningPoints string
	Instructor     string
	Level          db.CoursesLevel
	Duration       string
	Thumbnail      string
	Tags           string
	CostType       db.CoursesCostType
	Price          string
	CourseType     db.CoursesCourseType
	ExternalURL    sql.NullString
	SourceVideoURL sql.NullString
	SourcePlatform sql.NullString
	IndustryID     sql.NullString
	CategoryID     sql.NullString
}

// Update applies a partial update. Always bumps updated_at.
func (r *Repo) Update(ctx context.Context, id string, p UpdatePatch) error {
	now := time.Now().UTC()
	if err := r.q.UpdateCourse(ctx, db.UpdateCourseParams{
		Title:          p.Title,
		Description:    p.Description,
		LearningPoints: p.LearningPoints,
		Instructor:     p.Instructor,
		Level:          p.Level,
		Duration:       p.Duration,
		Thumbnail:      p.Thumbnail,
		Tags:           p.Tags,
		CostType:       p.CostType,
		Price:          p.Price,
		CourseType:     p.CourseType,
		ExternalUrl:    p.ExternalURL,
		SourceVideoUrl: p.SourceVideoURL,
		SourcePlatform: p.SourcePlatform,
		IndustryID:     p.IndustryID,
		CategoryID:     p.CategoryID,
		UpdatedAt:      now,
		ID:             id,
	}); err != nil {
		return fmt.Errorf("courses.repo: update: %w", err)
	}
	return nil
}

// Delete removes a course. Cascades to chapters / lessons / resources /
// enrollments per the FK constraints.
func (r *Repo) Delete(ctx context.Context, id string) error {
	if err := r.q.DeleteCourse(ctx, id); err != nil {
		return fmt.Errorf("courses.repo: delete: %w", err)
	}
	return nil
}

// LinkDegreesResult reports the append/skip counts.
type LinkDegreesResult struct {
	Appended int      `json:"appended"`
	Skipped  int      `json:"skipped"`
	Total    int      `json:"total"`
	Degrees  []string `json:"degrees"`
}

// LinkDegrees appends the course to each degree's course list at the
// next available orderIndex. Skips degrees that already link the course
// (idempotency). Mirrors NestJS's linkCourses: append semantics.
func (r *Repo) LinkDegrees(ctx context.Context, courseID string, degreeIDs []string) (LinkDegreesResult, error) {
	res := LinkDegreesResult{Total: len(degreeIDs), Degrees: degreeIDs}
	for _, did := range degreeIDs {
		// Idempotency: skip if the (degree, course) pair already exists.
		exists, err := r.q.DegreeCourseExists(ctx, db.DegreeCourseExistsParams{
			DegreeID: did, CourseID: courseID,
		})
		if err != nil {
			return res, fmt.Errorf("courses.repo: link degrees (exists): %w", err)
		}
		if exists {
			res.Skipped++
			continue
		}
		// Find the next order index in this degree.
		maxV, err := r.q.MaxOrderIndexInDegree(ctx, did)
		if err != nil {
			return res, fmt.Errorf("courses.repo: link degrees (max): %w", err)
		}
		var maxIdx int32
		switch x := maxV.(type) {
		case int32:
			maxIdx = x
		case int64:
			maxIdx = int32(x)
		case int:
			maxIdx = int32(x)
		}
		if _, err := r.q.CreateDegreeCourse(ctx, db.CreateDegreeCourseParams{
			DegreeID:   did,
			CourseID:   courseID,
			OrderIndex: maxIdx + 1,
		}); err != nil {
			return res, fmt.Errorf("courses.repo: link degrees (insert): %w", err)
		}
		res.Appended++
	}
	return res, nil
}
