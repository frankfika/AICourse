// Package practices — service layer.
//
// Phase 2 T14-4: business logic for /api/v1/practices/*.
// Mirrors apps/api/src/modules/practices/practices.service.ts 1:1.
//
// Cross-module dependencies:
//   - badges.CheckAndAward: called from completeProject via
//     badges.AwardOnPracticeComplete (stub for T14-2, real when wired).
package practices

import (
	"context"
	"database/sql"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service is the practices business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ProjectDTO is the public JSON shape of a practice project. Flattens
// sql.NullString to plain string (or nil) and uses camelCase keys.
// projectUrl is intentionally blanked out for non-admin callers
// (matches NestJS behavior: projectUrl is gated to admin/enrolled).
type ProjectDTO struct {
	ID            string  `json:"id"`
	CourseID      string  `json:"courseId"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	ProjectURL    string  `json:"projectUrl"`
	ThumbnailURL  *string `json:"thumbnailUrl,omitempty"`
	Difficulty    string  `json:"difficulty"`
	EstimatedTime int32   `json:"estimatedTime"`
	Tags          *string `json:"tags,omitempty"`
	ProjectType   string  `json:"projectType"`
	OrderIndex    int32   `json:"orderIndex"`
	Requirements  *string `json:"requirements,omitempty"`
	Objectives    *string `json:"objectives,omitempty"`
	IsActive      bool    `json:"isActive"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
}

func toProjectDTO(p db.PracticeProject) ProjectDTO {
	dto := ProjectDTO{
		ID:            p.ID,
		CourseID:      p.CourseID,
		Title:         p.Title,
		Description:   p.Description,
		ProjectURL:    p.ProjectUrl,
		Difficulty:    string(p.Difficulty),
		EstimatedTime: p.EstimatedTime,
		ProjectType:   string(p.ProjectType),
		OrderIndex:    p.OrderIndex,
		IsActive:      p.IsActive,
		CreatedAt:     p.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:     p.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if p.ThumbnailUrl.Valid {
		s := p.ThumbnailUrl.String
		dto.ThumbnailURL = &s
	}
	if p.Tags.Valid {
		s := p.Tags.String
		dto.Tags = &s
	}
	if p.Requirements.Valid {
		s := p.Requirements.String
		dto.Requirements = &s
	}
	if p.Objectives.Valid {
		s := p.Objectives.String
		dto.Objectives = &s
	}
	return dto
}

// ListByCourse returns the active projects for a course (public).
// projectUrl is gated — only admin / enrolled users see it.
func (s *Service) ListByCourse(ctx context.Context, courseID, userID string, isAdmin bool) ([]ProjectDTO, error) {
	rows, err := s.repo.ListByCourse(ctx, courseID)
	if err != nil {
		return nil, errs.Internal("list practices", err)
	}
	enrolled := false
	if userID != "" && !isAdmin {
		enrolled, _ = s.repo.HasActiveEnrollment(ctx, userID, courseID)
	}
	out := make([]ProjectDTO, 0, len(rows))
	for _, p := range rows {
		dto := toProjectDTO(p)
		if !isAdmin && !enrolled {
			dto.ProjectURL = "" // gate: only admin/enrolled see the URL
		}
		out = append(out, dto)
	}
	return out, nil
}

// ListAllByCourse returns all projects (admin only).
func (s *Service) ListAllByCourse(ctx context.Context, courseID string) ([]ProjectDTO, error) {
	rows, err := s.repo.ListAllByCourse(ctx, courseID)
	if err != nil {
		return nil, errs.Internal("list all practices", err)
	}
	out := make([]ProjectDTO, 0, len(rows))
	for _, p := range rows {
		out = append(out, toProjectDTO(p))
	}
	return out, nil
}

// GetByID returns a single project + the parent course summary.
type ProjectWithCourse struct {
	Project ProjectDTO `json:"project"`
	Course  CourseLite `json:"course"`
}

type CourseLite struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail,omitempty"`
}

// GetByID returns the project with its parent course's id/title/thumbnail.
// Gating: projectUrl is set only for admin OR enrolled user.
func (s *Service) GetByID(ctx context.Context, id, userID string, isAdmin bool) (ProjectWithCourse, error) {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return ProjectWithCourse{}, errs.NotFound("Practice project not found")
		}
		return ProjectWithCourse{}, errs.Internal("get practice", err)
	}
	summary, err := s.repo.GetCourseSummaryByProject(ctx, id)
	if err != nil {
		return ProjectWithCourse{}, errs.Internal("get course summary", err)
	}
	dto := toProjectDTO(p)
	if !isAdmin {
		enrolled, _ := s.repo.HasActiveEnrollment(ctx, userID, p.CourseID)
		if !enrolled {
			dto.ProjectURL = ""
		}
	}
	return ProjectWithCourse{
		Project: dto,
		Course: CourseLite{
			ID:        summary.ID,
			Title:     summary.Title,
			Thumbnail: summary.Thumbnail,
		},
	}, nil
}

// APIInput is the create/update payload.
type APIInput struct {
	CourseID      string
	Title         string
	Description   string
	ProjectURL    string
	ThumbnailURL  string
	Difficulty    string
	EstimatedTime int32
	Tags          string
	ProjectType   string
	OrderIndex    int32
	Requirements  string
	Objectives    string
	IsActive      *bool
}

// Create inserts a new project. Admin only.
func (s *Service) Create(ctx context.Context, in APIInput) (ProjectDTO, error) {
	if in.CourseID == "" || in.Title == "" {
		return ProjectDTO{}, errs.BadRequest("courseId and title required")
	}
	if !validDifficulty(in.Difficulty) {
		return ProjectDTO{}, errs.BadRequest("difficulty must be beginner, intermediate, advanced, or expert")
	}
	if !validProjectType(in.ProjectType) {
		return ProjectDTO{}, errs.BadRequest("invalid projectType")
	}
	// Verify course exists
	costType, err := s.repo.GetCourseCostType(ctx, in.CourseID)
	if err != nil {
		return ProjectDTO{}, errs.Internal("get course", err)
	}
	if costType == "" {
		return ProjectDTO{}, errs.NotFound("Course not found")
	}
	now := time.Now().UTC()
	p := db.PracticeProject{
		ID:            uuid.NewString(),
		CourseID:      in.CourseID,
		Title:         in.Title,
		Description:   in.Description,
		ProjectUrl:    in.ProjectURL,
		Difficulty:    db.PracticeProjectsDifficulty(in.Difficulty),
		EstimatedTime: in.EstimatedTime,
		ProjectType:   db.PracticeProjectsProjectType(in.ProjectType),
		OrderIndex:    in.OrderIndex,
		IsActive:      in.IsActive == nil || *in.IsActive,
		UpdatedAt:     now,
	}
	if in.ThumbnailURL != "" {
		p.ThumbnailUrl = sql.NullString{String: in.ThumbnailURL, Valid: true}
	}
	if in.Tags != "" {
		p.Tags = sql.NullString{String: in.Tags, Valid: true}
	}
	if in.Requirements != "" {
		p.Requirements = sql.NullString{String: in.Requirements, Valid: true}
	}
	if in.Objectives != "" {
		p.Objectives = sql.NullString{String: in.Objectives, Valid: true}
	}
	if err := s.repo.Create(ctx, p); err != nil {
		return ProjectDTO{}, errs.Internal("create practice", err)
	}
	return toProjectDTO(p), nil
}

// Update overwrites a project in full.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (ProjectDTO, error) {
	cur, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return ProjectDTO{}, errs.NotFound("Practice project not found")
		}
		return ProjectDTO{}, errs.Internal("get practice", err)
	}
	if in.Title != "" {
		cur.Title = in.Title
	}
	if in.Description != "" {
		cur.Description = in.Description
	}
	if in.ProjectURL != "" {
		cur.ProjectUrl = in.ProjectURL
	}
	if in.ThumbnailURL != "" {
		cur.ThumbnailUrl = sql.NullString{String: in.ThumbnailURL, Valid: true}
	}
	if in.Difficulty != "" {
		cur.Difficulty = db.PracticeProjectsDifficulty(in.Difficulty)
	}
	if in.EstimatedTime != 0 {
		cur.EstimatedTime = in.EstimatedTime
	}
	if in.Tags != "" {
		cur.Tags = sql.NullString{String: in.Tags, Valid: true}
	}
	if in.ProjectType != "" {
		cur.ProjectType = db.PracticeProjectsProjectType(in.ProjectType)
	}
	if in.OrderIndex != 0 {
		cur.OrderIndex = in.OrderIndex
	}
	if in.Requirements != "" {
		cur.Requirements = sql.NullString{String: in.Requirements, Valid: true}
	}
	if in.Objectives != "" {
		cur.Objectives = sql.NullString{String: in.Objectives, Valid: true}
	}
	if in.IsActive != nil {
		cur.IsActive = *in.IsActive
	}
	cur.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, cur); err != nil {
		return ProjectDTO{}, errs.Internal("update practice", err)
	}
	return toProjectDTO(cur), nil
}

// Delete removes a project. CASCADE removes completions.
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Practice project not found")
		}
		return errs.Internal("get practice", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete practice", err)
	}
	return nil
}

// GetUserProgress returns the user's completions + project summaries.
// courseID="" means "all courses".
func (s *Service) GetUserProgress(ctx context.Context, userID, courseID string) ([]UserProgressDTO, error) {
	rows, err := s.repo.ListUserProgress(ctx, userID, courseID)
	if err != nil {
		return nil, errs.Internal("list user progress", err)
	}
	out := make([]UserProgressDTO, 0, len(rows))
	for _, r := range rows {
		comp := CompletionDTO{
			ID:            r.Completion.ID,
			UserID:        r.Completion.UserID,
			ProjectID:     r.Completion.ProjectID,
			Status:        string(r.Completion.Status),
			StartedAt:     r.Completion.StartedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
			SubmissionURL: nullableString(r.Completion.SubmissionUrl),
			Notes:         nullableString(r.Completion.Notes),
		}
		if r.Completion.CompletedAt.Valid {
			s := r.Completion.CompletedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
			comp.CompletedAt = &s
		}
		out = append(out, UserProgressDTO{
			Completion: comp,
			Project: ProjectSummaryDTO{
				ID:            r.Project.ID,
				Title:         r.Project.Title,
				CourseID:      r.Project.CourseID,
				Difficulty:    r.Project.Difficulty,
				EstimatedTime: r.Project.EstimatedTime,
				ProjectType:   r.Project.ProjectType,
			},
		})
	}
	return out, nil
}

// CompletionDTO is the public completion shape (used in progress + start/complete/skip).
type CompletionDTO struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	ProjectID     string  `json:"projectId"`
	Status        string  `json:"status"`
	StartedAt     string  `json:"startedAt"`
	CompletedAt   *string `json:"completedAt,omitempty"`
	SubmissionURL *string `json:"submissionUrl,omitempty"`
	Notes         *string `json:"notes,omitempty"`
}

// UserProgressDTO is the joined completion+project progress shape.
type UserProgressDTO struct {
	Completion CompletionDTO     `json:"completion"`
	Project    ProjectSummaryDTO `json:"project"`
}

// ProjectSummaryDTO is the slim project shape returned in the progress list.
type ProjectSummaryDTO struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	CourseID      string `json:"courseId"`
	Difficulty    string `json:"difficulty"`
	EstimatedTime int32  `json:"estimatedTime"`
	ProjectType   string `json:"projectType"`
}

// StartProject creates an in_progress completion record. Idempotent
// (returns existing if any).
func (s *Service) StartProject(ctx context.Context, userID, projectID string) (CompletionDTO, error) {
	p, err := s.repo.GetByID(ctx, projectID)
	if err != nil {
		if err == ErrNotFound {
			return CompletionDTO{}, errs.NotFound("Practice project not found")
		}
		return CompletionDTO{}, errs.Internal("get practice", err)
	}
	if !p.IsActive {
		return CompletionDTO{}, errs.Forbidden("This practice project is not active")
	}
	if err := s.assertCourseAccess(ctx, userID, p.CourseID); err != nil {
		return CompletionDTO{}, err
	}
	// Idempotent: if already started, return existing
	if existing, err := s.repo.GetCompletion(ctx, userID, projectID); err == nil {
		return toCompletionDTO(existing), nil
	} else if err != ErrNotFound {
		return CompletionDTO{}, errs.Internal("check existing", err)
	}
	comp, err := s.repo.CreateCompletion(ctx, userID, projectID)
	if err != nil {
		return CompletionDTO{}, errs.Internal("start practice", err)
	}
	return toCompletionDTO(comp), nil
}

// CompleteInput is the body of POST /practices/:id/complete.
type CompleteInput struct {
	SubmissionURL string
	Notes         string
}

// CompleteProject marks the project's completion as completed. Kicks
// off a non-blocking badge check via the cross-module hook.
func (s *Service) CompleteProject(ctx context.Context, userID, projectID string, in CompleteInput) (CompletionDTO, error) {
	if err := s.assertProjectAccess(ctx, userID, projectID); err != nil {
		return CompletionDTO{}, err
	}
	comp, err := s.repo.GetCompletion(ctx, userID, projectID)
	if err != nil {
		if err == ErrNotFound {
			return CompletionDTO{}, errs.NotFound("Practice completion not found. Please start the project first.")
		}
		return CompletionDTO{}, errs.Internal("get completion", err)
	}
	wasAlreadyCompleted := comp.Status == db.PracticeCompletionsStatusCompleted
	now := time.Now().UTC()
	subURL := sql.NullString{String: in.SubmissionURL, Valid: in.SubmissionURL != ""}
	notes := sql.NullString{String: in.Notes, Valid: in.Notes != ""}
	if err := s.repo.UpdateCompletionStatus(ctx, userID, projectID,
		db.PracticeCompletionsStatusCompleted,
		sql.NullTime{Time: now, Valid: true},
		subURL, notes); err != nil {
		return CompletionDTO{}, errs.Internal("update completion", err)
	}
	// Re-fetch to return fresh row
	updated, err := s.repo.GetCompletion(ctx, userID, projectID)
	if err != nil {
		return CompletionDTO{}, errs.Internal("reload completion", err)
	}
	if !wasAlreadyCompleted {
		// Fire-and-forget badge check (T14-2 stub is no-op; real
		// impl in mountBadges checks practice_completed criteria).
		go func() {
			_ = AwardOnPracticeComplete(context.Background(), userID)
		}()
	}
	return toCompletionDTO(updated), nil
}

// SkipProject marks the project's completion as skipped.
func (s *Service) SkipProject(ctx context.Context, userID, projectID string) (CompletionDTO, error) {
	if err := s.assertProjectAccess(ctx, userID, projectID); err != nil {
		return CompletionDTO{}, err
	}
	if _, err := s.repo.GetCompletion(ctx, userID, projectID); err != nil {
		if err == ErrNotFound {
			return CompletionDTO{}, errs.NotFound("Practice completion not found. Please start the project first.")
		}
		return CompletionDTO{}, errs.Internal("get completion", err)
	}
	if err := s.repo.UpdateCompletionStatus(ctx, userID, projectID,
		db.PracticeCompletionsStatusSkipped,
		sql.NullTime{}, // completedAt is null for skipped
		sql.NullString{}, sql.NullString{}); err != nil {
		return CompletionDTO{}, errs.Internal("update completion", err)
	}
	updated, err := s.repo.GetCompletion(ctx, userID, projectID)
	if err != nil {
		return CompletionDTO{}, errs.Internal("reload completion", err)
	}
	return toCompletionDTO(updated), nil
}

// ============ access control ============

func (s *Service) assertCourseAccess(ctx context.Context, userID, courseID string) error {
	costType, err := s.repo.GetCourseCostType(ctx, courseID)
	if err != nil {
		return errs.Internal("get cost type", err)
	}
	if costType == "" {
		return errs.NotFound("Course not found")
	}
	if costType == "free" || costType == "charity" {
		return nil // free courses: anyone can access
	}
	enrolled, err := s.repo.HasActiveEnrollment(ctx, userID, courseID)
	if err != nil {
		return errs.Internal("enrollment check", err)
	}
	if !enrolled {
		return errs.Forbidden("Course enrollment required")
	}
	return nil
}

func (s *Service) assertProjectAccess(ctx context.Context, userID, projectID string) error {
	p, err := s.repo.GetByID(ctx, projectID)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Practice project not found")
		}
		return errs.Internal("get practice", err)
	}
	if !p.IsActive {
		return errs.Forbidden("This practice project is not active")
	}
	return s.assertCourseAccess(ctx, userID, p.CourseID)
}

// ============ helpers ============

func toCompletionDTO(c db.PracticeCompletion) CompletionDTO {
	dto := CompletionDTO{
		ID:        c.ID,
		UserID:    c.UserID,
		ProjectID: c.ProjectID,
		Status:    string(c.Status),
		StartedAt: c.StartedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if c.CompletedAt.Valid {
		s := c.CompletedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.CompletedAt = &s
	}
	if c.SubmissionUrl.Valid {
		s := c.SubmissionUrl.String
		dto.SubmissionURL = &s
	}
	if c.Notes.Valid {
		s := c.Notes.String
		dto.Notes = &s
	}
	return dto
}

func nullableString(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func validDifficulty(s string) bool {
	switch db.PracticeProjectsDifficulty(s) {
	case db.PracticeProjectsDifficultyBeginner,
		db.PracticeProjectsDifficultyIntermediate,
		db.PracticeProjectsDifficultyAdvanced,
		db.PracticeProjectsDifficultyExpert:
		return true
	}
	return false
}

func validProjectType(s string) bool {
	switch db.PracticeProjectsProjectType(s) {
	case db.PracticeProjectsProjectTypeModelDeployment,
		db.PracticeProjectsProjectTypeModelTraining,
		db.PracticeProjectsProjectTypeModelInference,
		db.PracticeProjectsProjectTypeApiIntegration,
		db.PracticeProjectsProjectTypeNotebook,
		db.PracticeProjectsProjectTypeSandbox,
		db.PracticeProjectsProjectTypeRepository,
		db.PracticeProjectsProjectTypeCsghubSpace:
		return true
	}
	return false
}

// AwardOnPracticeComplete is a cross-module hook fired by
// completeProject. Default is no-op; main.go can override it with the
// badges service's CheckAndAward.
var AwardOnPracticeComplete = func(_ context.Context, _ string) error { return nil }
