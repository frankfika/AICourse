// Package courses — service layer.
//
// Phase 2 T12-1: business logic for /api/v1/courses/*. Mirrors
// apps/api/src/modules/courses/courses.service.ts 1:1 so the NestJS
// contract is preserved end-to-end.
//
// Responsibilities:
//   - Public list forces status='published' unless the caller is admin
//   - Admin can filter by status / courseType / search
//   - create / update / delete are admin-only
//   - linkDegrees is append-semantic with idempotency
//   - Audit log writes mirror NestJS (COURSE_CREATE/UPDATE/DELETE/LINK_DEGREES)
package courses

import (
	"context"
	"database/sql"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the courses business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ListParams mirrors the public + admin query-string inputs.
type ListParams struct {
	Status     string
	CourseType string
	Search     string
	Page       int
	Limit      int
}

// List returns courses. isAdmin toggles draft visibility.
func (s *Service) List(ctx context.Context, p ListParams, isAdmin bool) (ListResult, error) {
	if p.Status != "" {
		switch p.Status {
		case "draft", "published", "archived":
		default:
			return ListResult{}, errs.BadRequest("status must be one of draft|published|archived")
		}
	}
	if p.CourseType != "" {
		switch p.CourseType {
		case "own", "partner", "public", "third_party":
		default:
			return ListResult{}, errs.BadRequest("courseType must be one of own|partner|public|third_party")
		}
	}
	return s.repo.List(ctx, ListFilter{
		Status: p.Status, CourseType: p.CourseType, Search: p.Search,
		Page: p.Page, Limit: p.Limit,
	}, isAdmin)
}

// Get returns a course. includeDraft lets admin see draft/archived.
func (s *Service) Get(ctx context.Context, id string, includeDraft bool) (db.Course, error) {
	c, err := s.repo.GetByID(ctx, id, includeDraft)
	if err != nil {
		if err == ErrNotFound {
			return db.Course{}, errs.NotFound("Course not found")
		}
		return db.Course{}, errs.Internal("get course", err)
	}
	return c, nil
}

// APIInput is the API-shaped create/update payload. Strings here; the
// service converts to the repo's typed input.
type APIInput struct {
	Title          string
	Description    string
	LearningPoints string
	Instructor     string
	Level          string
	Duration       string
	Thumbnail      string
	Tags           string
	CostType       string
	Price          string
	Status         string // optional
	CourseType     string
	ExternalURL    string
	SourceVideoURL string
	SourcePlatform string
	IndustryID     string
	CategoryID     string
}

// Create inserts a new course. Returns the public shape.
func (s *Service) Create(ctx context.Context, in APIInput) (db.Course, error) {
	if err := validateCourseFields(in.Title, in.Description, in.LearningPoints, in.Instructor, in.Duration, in.Thumbnail, in.Tags); err != nil {
		return db.Course{}, err
	}
	if err := validateLevel(in.Level); err != nil {
		return db.Course{}, err
	}
	if err := validateCostType(in.CostType); err != nil {
		return db.Course{}, err
	}
	if in.Status != "" {
		if err := validateStatus(in.Status); err != nil {
			return db.Course{}, err
		}
	}
	if in.CourseType != "" {
		if err := validateCourseType(in.CourseType); err != nil {
			return db.Course{}, err
		}
	}
	if in.ExternalURL != "" {
		if err := validateURL(in.ExternalURL, "externalUrl"); err != nil {
			return db.Course{}, err
		}
	}
	if in.SourceVideoURL != "" {
		if err := validateURL(in.SourceVideoURL, "sourceVideoUrl"); err != nil {
			return db.Course{}, err
		}
	}

	repoIn := s.toRepoInput(in)
	out, err := s.repo.Create(ctx, repoIn)
	if err != nil {
		return db.Course{}, errs.Internal("create course", err)
	}
	s.writeAudit(ctx, "COURSE_CREATE", out.ID)
	return out, nil
}

// Update applies a partial update. Always reads the current row first to
// keep the unchanged fields intact (UpdateCourse in sqlc requires all
// 17 fields, so this avoids the caller having to send a full row).
func (s *Service) Update(ctx context.Context, id string, in APIInput) (db.Course, error) {
	if err := validateCourseFields(in.Title, in.Description, in.LearningPoints, in.Instructor, in.Duration, in.Thumbnail, in.Tags); err != nil {
		return db.Course{}, err
	}
	if err := validateLevel(in.Level); err != nil {
		return db.Course{}, err
	}
	if err := validateCostType(in.CostType); err != nil {
		return db.Course{}, err
	}
	if in.CourseType != "" {
		if err := validateCourseType(in.CourseType); err != nil {
			return db.Course{}, err
		}
	}
	if in.ExternalURL != "" {
		if err := validateURL(in.ExternalURL, "externalUrl"); err != nil {
			return db.Course{}, err
		}
	}
	if in.SourceVideoURL != "" {
		if err := validateURL(in.SourceVideoURL, "sourceVideoUrl"); err != nil {
			return db.Course{}, err
		}
	}

	before, err := s.repo.GetByID(ctx, id, true)
	if err != nil {
		if err == ErrNotFound {
			return db.Course{}, errs.NotFound("Course not found")
		}
		return db.Course{}, errs.Internal("lookup course", err)
	}
	patch := s.toRepoPatch(in, before)
	if err := s.repo.Update(ctx, id, patch); err != nil {
		return db.Course{}, errs.Internal("update course", err)
	}
	after, err := s.repo.GetByID(ctx, id, true)
	if err != nil {
		return db.Course{}, errs.Internal("reload course", err)
	}
	s.writeAudit(ctx, "COURSE_UPDATE", id)
	return after, nil
}

// Delete hard-deletes a course. Admin only.
func (s *Service) Delete(ctx context.Context, id string) error {
	// Verify existence first to give a clean 404.
	if _, err := s.repo.GetByID(ctx, id, true); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Course not found")
		}
		return errs.Internal("lookup course", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete course", err)
	}
	s.writeAudit(ctx, "COURSE_DELETE", id)
	return nil
}

// LinkDegrees appends the course to each specified degree.
func (s *Service) LinkDegrees(ctx context.Context, courseID string, degreeIDs []string) (LinkDegreesResult, error) {
	if len(degreeIDs) == 0 {
		return LinkDegreesResult{}, errs.BadRequest("degreeIds is required")
	}
	if _, err := s.repo.GetByID(ctx, courseID, true); err != nil {
		if err == ErrNotFound {
			return LinkDegreesResult{}, errs.NotFound("Course not found")
		}
		return LinkDegreesResult{}, errs.Internal("lookup course", err)
	}
	res, err := s.repo.LinkDegrees(ctx, courseID, degreeIDs)
	if err != nil {
		return res, errs.Internal("link degrees", err)
	}
	s.writeAudit(ctx, "COURSE_LINK_DEGREES", courseID)
	return res, nil
}

// toRepoInput converts an APIInput to the repo's typed CreateInput.
func (s *Service) toRepoInput(in APIInput) CreateInput {
	status := db.CoursesStatusDraft
	if in.Status != "" {
		status = db.CoursesStatus(in.Status)
	}
	courseType := db.CoursesCourseTypeOwn
	if in.CourseType != "" {
		courseType = db.CoursesCourseType(in.CourseType)
	}
	return CreateInput{
		Title:          in.Title,
		Description:    in.Description,
		LearningPoints: in.LearningPoints,
		Instructor:     in.Instructor,
		Level:          db.CoursesLevel(in.Level),
		Duration:       in.Duration,
		Thumbnail:      in.Thumbnail,
		Tags:           in.Tags,
		CostType:       db.CoursesCostType(in.CostType),
		Price:          in.Price,
		Status:         status,
		CourseType:     courseType,
		ExternalURL:    nullableString(in.ExternalURL),
		SourceVideoURL: nullableString(in.SourceVideoURL),
		SourcePlatform: nullableString(in.SourcePlatform),
		IndustryID:     nullableString(in.IndustryID),
		CategoryID:     nullableString(in.CategoryID),
	}
}

// toRepoPatch fills in unchanged fields from `before` and writes the
// supplied ones. The repo's UpdateCourse takes all 17 columns.
func (s *Service) toRepoPatch(in APIInput, before db.Course) UpdatePatch {
	patch := UpdatePatch{
		Title:          orDefault(in.Title, before.Title),
		Description:    orDefault(in.Description, before.Description),
		LearningPoints: orDefault(in.LearningPoints, before.LearningPoints),
		Instructor:     orDefault(in.Instructor, before.Instructor),
		Level:          db.CoursesLevel(orDefault(in.Level, string(before.Level))),
		Duration:       orDefault(in.Duration, before.Duration),
		Thumbnail:      orDefault(in.Thumbnail, before.Thumbnail),
		Tags:           orDefault(in.Tags, before.Tags),
		CostType:       db.CoursesCostType(orDefault(in.CostType, string(before.CostType))),
		Price:          orDefault(in.Price, before.Price),
		CourseType:     db.CoursesCourseType(orDefault(in.CourseType, string(before.CourseType))),
		ExternalURL:    before.ExternalUrl,
		SourceVideoURL: before.SourceVideoUrl,
		SourcePlatform: before.SourcePlatform,
		IndustryID:     before.IndustryID,
		CategoryID:     before.CategoryID,
	}
	if in.ExternalURL != "" {
		patch.ExternalURL = nullableString(in.ExternalURL)
	}
	if in.SourceVideoURL != "" {
		patch.SourceVideoURL = nullableString(in.SourceVideoURL)
	}
	if in.SourcePlatform != "" {
		patch.SourcePlatform = nullableString(in.SourcePlatform)
	}
	if in.IndustryID != "" {
		patch.IndustryID = nullableString(in.IndustryID)
	}
	if in.CategoryID != "" {
		patch.CategoryID = nullableString(in.CategoryID)
	}
	return patch
}

// writeAudit is a best-effort audit log write. Failures are logged but
// don't propagate (NestJS AuditLogService does the same).
func (s *Service) writeAudit(ctx context.Context, action, entityID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, created_at)
		VALUES (UUID(), ?, 'course', ?, NOW(3))
	`, action, entityID)
	if err != nil {
		s.log.Warn("audit log write failed", zap.String("action", action), zap.Error(err))
	}
}

// ============ validators ============

func validateCourseFields(title, desc, lp, instructor, duration, thumb, tags string) error {
	if strings.TrimSpace(title) == "" {
		return errs.BadRequest("title is required")
	}
	if strings.TrimSpace(desc) == "" {
		return errs.BadRequest("description is required")
	}
	if strings.TrimSpace(lp) == "" {
		return errs.BadRequest("learningPoints is required")
	}
	if strings.TrimSpace(instructor) == "" {
		return errs.BadRequest("instructor is required")
	}
	if strings.TrimSpace(duration) == "" {
		return errs.BadRequest("duration is required")
	}
	if strings.TrimSpace(thumb) == "" {
		return errs.BadRequest("thumbnail is required")
	}
	if strings.TrimSpace(tags) == "" {
		return errs.BadRequest("tags is required")
	}
	return nil
}

func validateLevel(s string) error {
	switch s {
	case "Beginner", "Intermediate", "Advanced", "Expert":
		return nil
	case "":
		return errs.BadRequest("level is required")
	default:
		return errs.BadRequest("level must be one of Beginner|Intermediate|Advanced|Expert")
	}
}

func validateCostType(s string) error {
	switch s {
	case "free", "paid", "charity":
		return nil
	case "":
		return errs.BadRequest("costType is required")
	default:
		return errs.BadRequest("costType must be one of free|paid|charity")
	}
}

func validateStatus(s string) error {
	switch s {
	case "draft", "published", "archived":
		return nil
	default:
		return errs.BadRequest("status must be one of draft|published|archived")
	}
}

func validateCourseType(s string) error {
	switch s {
	case "own", "partner", "public", "third_party":
		return nil
	default:
		return errs.BadRequest("courseType must be one of own|partner|public|third_party")
	}
}

// validateURL mirrors the SafeUrl decorator: only http/https allowed.
func validateURL(s, field string) error {
	if len(s) > 500 {
		return errs.BadRequest(field + " too long")
	}
	low := strings.ToLower(s)
	if !strings.HasPrefix(low, "http://") && !strings.HasPrefix(low, "https://") {
		return errs.BadRequest(field + " must be http(s)://")
	}
	return nil
}

func nullableString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

// orDefault returns `in` if non-empty, else `fallback`.
func orDefault(in, fallback string) string {
	if in == "" {
		return fallback
	}
	return in
}
