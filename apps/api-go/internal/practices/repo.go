// Package practices — repo layer.
//
// Phase 2 T14-4: thin wrapper around internal/repo/db for the
// practices module. Mirrors apps/api/src/modules/practices/practices.service.ts.
package practices

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
var ErrNotFound = errors.New("practices: not found")

// Repo is the practices data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByCourse returns active projects for a course (public list).
func (r *Repo) ListByCourse(ctx context.Context, courseID string) ([]db.PracticeProject, error) {
	rows, err := r.q.ListPracticeProjectsByCourse(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("practices.repo: list: %w", err)
	}
	return rows, nil
}

// ListAllByCourse returns all projects (admin; includes inactive).
func (r *Repo) ListAllByCourse(ctx context.Context, courseID string) ([]db.PracticeProject, error) {
	rows, err := r.q.ListAllPracticeProjectsByCourse(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("practices.repo: list all: %w", err)
	}
	return rows, nil
}

// GetByID looks up a project by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.PracticeProject, error) {
	p, err := r.q.GetPracticeProjectByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.PracticeProject{}, ErrNotFound
		}
		return db.PracticeProject{}, fmt.Errorf("practices.repo: get: %w", err)
	}
	return p, nil
}

// Create inserts a new project.
func (r *Repo) Create(ctx context.Context, p db.PracticeProject) error {
	_, err := r.q.CreatePracticeProject(ctx, db.CreatePracticeProjectParams{
		ID:            p.ID,
		CourseID:      p.CourseID,
		Title:         p.Title,
		Description:   p.Description,
		ProjectUrl:    p.ProjectUrl,
		ThumbnailUrl:  p.ThumbnailUrl,
		Difficulty:    p.Difficulty,
		EstimatedTime: p.EstimatedTime,
		Tags:          p.Tags,
		ProjectType:   p.ProjectType,
		OrderIndex:    p.OrderIndex,
		Requirements:  p.Requirements,
		Objectives:    p.Objectives,
		IsActive:      p.IsActive,
		UpdatedAt:     p.UpdatedAt,
	})
	return err
}

// Update overwrites a project row in full.
func (r *Repo) Update(ctx context.Context, p db.PracticeProject) error {
	return r.q.UpdatePracticeProject(ctx, db.UpdatePracticeProjectParams{
		Title:         p.Title,
		Description:   p.Description,
		ProjectUrl:    p.ProjectUrl,
		ThumbnailUrl:  p.ThumbnailUrl,
		Difficulty:    p.Difficulty,
		EstimatedTime: p.EstimatedTime,
		Tags:          p.Tags,
		ProjectType:   p.ProjectType,
		OrderIndex:    p.OrderIndex,
		Requirements:  p.Requirements,
		Objectives:    p.Objectives,
		IsActive:      p.IsActive,
		UpdatedAt:     p.UpdatedAt,
		ID:            p.ID,
	})
}

// Delete removes a project. CASCADE removes practice_completions.
func (r *Repo) Delete(ctx context.Context, id string) error {
	return r.q.DeletePracticeProject(ctx, id)
}

// GetCourseCostType returns the cost_type of a course, or "" if missing.
func (r *Repo) GetCourseCostType(ctx context.Context, courseID string) (string, error) {
	var ct string
	err := r.conn.QueryRowContext(ctx,
		`SELECT cost_type FROM courses WHERE id = ?`, courseID).Scan(&ct)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("practices.repo: get cost type: %w", err)
	}
	return ct, nil
}

// HasActiveEnrollment returns true if the user has a non-deleted
// enrollment for the course.
func (r *Repo) HasActiveEnrollment(ctx context.Context, userID, courseID string) (bool, error) {
	_, err := r.q.GetActiveEnrollmentForUserCourse(ctx, db.GetActiveEnrollmentForUserCourseParams{
		UserID:   userID,
		CourseID: sql.NullString{String: courseID, Valid: true},
	})
	if err == nil {
		return true, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return false, fmt.Errorf("practices.repo: enrollment check: %w", err)
}

// GetCompletion returns the user's completion record for a project.
// Returns ErrNotFound if no record exists.
func (r *Repo) GetCompletion(ctx context.Context, userID, projectID string) (db.PracticeCompletion, error) {
	c, err := r.q.GetPracticeCompletion(ctx, db.GetPracticeCompletionParams{
		UserID: userID, ProjectID: projectID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.PracticeCompletion{}, ErrNotFound
		}
		return db.PracticeCompletion{}, fmt.Errorf("practices.repo: get completion: %w", err)
	}
	return c, nil
}

// CreateCompletion inserts a new completion record (status=in_progress).
func (r *Repo) CreateCompletion(ctx context.Context, userID, projectID string) (db.PracticeCompletion, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := r.q.CreatePracticeCompletion(ctx, db.CreatePracticeCompletionParams{
		ID:            id,
		UserID:        userID,
		ProjectID:     projectID,
		Status:        db.PracticeCompletionsStatusInProgress,
		StartedAt:     now,
		SubmissionUrl: sql.NullString{String: "", Valid: false},
		Notes:         sql.NullString{String: "", Valid: false},
	})
	if err != nil {
		return db.PracticeCompletion{}, fmt.Errorf("practices.repo: create completion: %w", err)
	}
	return r.GetCompletion(ctx, userID, projectID)
}

// UpdateCompletionStatus updates the completion record's status,
// completedAt, submissionUrl, and notes.
func (r *Repo) UpdateCompletionStatus(ctx context.Context, userID, projectID string, status db.PracticeCompletionsStatus, completedAt sql.NullTime, submissionURL, notes sql.NullString) error {
	return r.q.UpdatePracticeCompletion(ctx, db.UpdatePracticeCompletionParams{
		Status:        status,
		CompletedAt:   completedAt,
		SubmissionUrl: submissionURL,
		Notes:         notes,
		UserID:        userID,
		ProjectID:     projectID,
	})
}

// UserProgressRow is one row in the user progress list.
type UserProgressRow struct {
	Completion db.PracticeCompletion `json:"completion"`
	Project    ProjectSummary        `json:"project"`
}

// ProjectSummary is the slim project shape returned with the progress.
type ProjectSummary struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	CourseID      string `json:"courseId"`
	Difficulty    string `json:"difficulty"`
	EstimatedTime int32  `json:"estimatedTime"`
	ProjectType   string `json:"projectType"`
}

// ListUserProgress returns the user's completions + slim project info.
// courseID="" means "all courses".
func (r *Repo) ListUserProgress(ctx context.Context, userID, courseID string) ([]UserProgressRow, error) {
	rows, err := r.q.ListUserPracticeCompletions(ctx, db.ListUserPracticeCompletionsParams{
		UserID:   userID,
		Column2:  courseID,
		CourseID: courseID,
	})
	if err != nil {
		return nil, fmt.Errorf("practices.repo: list user progress: %w", err)
	}
	out := make([]UserProgressRow, 0, len(rows))
	for _, x := range rows {
		comp := db.PracticeCompletion{
			ID:            x.ID,
			UserID:        x.UserID,
			ProjectID:     x.ProjectID,
			Status:        x.Status,
			StartedAt:     x.StartedAt,
			CompletedAt:   x.CompletedAt,
			SubmissionUrl: x.SubmissionUrl,
			Notes:         x.Notes,
			DeletedAt:     x.DeletedAt,
		}
		ps := ProjectSummary{
			ID:            x.ID_2,
			Title:         x.Title,
			CourseID:      x.CourseID,
			Difficulty:    string(x.Difficulty),
			EstimatedTime: x.EstimatedTime,
			ProjectType:   string(x.ProjectType),
		}
		out = append(out, UserProgressRow{Completion: comp, Project: ps})
	}
	return out, nil
}

// GetCourseSummaryForProject returns the parent course's id, title, thumbnail.
type CourseSummary struct {
	ID        string
	Title     string
	Thumbnail string
}

// GetCourseSummaryByProject returns the course summary for a project.
func (r *Repo) GetCourseSummaryByProject(ctx context.Context, projectID string) (CourseSummary, error) {
	var cs CourseSummary
	err := r.conn.QueryRowContext(ctx, `
		SELECT c.id, c.title, COALESCE(c.thumbnail, '')
		FROM practice_projects p
		JOIN courses c ON c.id = p.course_id
		WHERE p.id = ?`, projectID).Scan(&cs.ID, &cs.Title, &cs.Thumbnail)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CourseSummary{}, ErrNotFound
		}
		return CourseSummary{}, fmt.Errorf("practices.repo: get course summary: %w", err)
	}
	return cs, nil
}
