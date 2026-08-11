// Package resources — service layer.
//
// Phase 2 T12-4: business logic for /api/v1/lessons/:lessonId/resources
// and /api/v1/resources/:id. Mirrors
// apps/api/src/modules/courses/resources.controller.ts +
// resource-item.controller.ts 1:1.
package resources

import (
	"context"
	"errors"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// AllowedTypes is the closed enum for the resources.type column.
// Mirrors NestJS's ALLOWED_TYPES constant.
var AllowedTypes = map[string]db.ResourcesType{
	"pdf":   db.ResourcesTypePdf,
	"code":  db.ResourcesTypeCode,
	"link":  db.ResourcesTypeLink,
	"video": db.ResourcesTypeVideo,
	"audio": db.ResourcesTypeAudio,
}

// Service is the resources business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// APIInput is the API-shaped create/update payload.
type APIInput struct {
	Title    string
	URL      string
	Type     string // "pdf" | "code" | "link" | "video" | "audio"
	IsLocked *bool  // optional; defaults to true on create
}

// ListByLesson returns all non-deleted resources for a lesson.
func (s *Service) ListByLesson(ctx context.Context, lessonID string) ([]db.Resource, error) {
	exists, err := s.repo.LessonExists(ctx, lessonID)
	if err != nil {
		return nil, errs.Internal("check lesson", err)
	}
	if !exists {
		return nil, errs.NotFound("Lesson not found")
	}
	rows, err := s.repo.ListByLesson(ctx, lessonID)
	if err != nil {
		return nil, errs.Internal("list resources", err)
	}
	return rows, nil
}

// Create inserts a new resource. type is required; isLocked defaults
// to true when not supplied.
func (s *Service) Create(ctx context.Context, lessonID string, in APIInput) (db.Resource, error) {
	if err := s.validateTitle(in.Title); err != nil {
		return db.Resource{}, err
	}
	if err := s.validateURL(in.URL); err != nil {
		return db.Resource{}, err
	}
	if err := s.validateType(in.Type); err != nil {
		return db.Resource{}, err
	}
	exists, err := s.repo.LessonExists(ctx, lessonID)
	if err != nil {
		return db.Resource{}, errs.Internal("check lesson", err)
	}
	if !exists {
		return db.Resource{}, errs.NotFound("Lesson not found")
	}

	isLocked := true
	if in.IsLocked != nil {
		isLocked = *in.IsLocked
	}

	out, err := s.repo.Create(ctx, CreateInput{
		LessonID: lessonID, Title: in.Title, Url: in.URL,
		Type: AllowedTypes[in.Type], IsLocked: isLocked,
	})
	if err != nil {
		return db.Resource{}, errs.Internal("create resource", err)
	}
	s.writeAudit(ctx, "resource.create", out.ID, lessonID)
	return out, nil
}

// Update applies a partial update. Reads the current row first to
// fill in unchanged fields.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (db.Resource, error) {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return db.Resource{}, errs.NotFound("Resource not found")
		}
		return db.Resource{}, errs.Internal("lookup resource", err)
	}
	if in.Title != "" {
		if err := s.validateTitle(in.Title); err != nil {
			return db.Resource{}, err
		}
	}
	if in.URL != "" {
		if err := s.validateURL(in.URL); err != nil {
			return db.Resource{}, err
		}
	}
	if in.Type != "" {
		if err := s.validateType(in.Type); err != nil {
			return db.Resource{}, err
		}
	}

	title := before.Title
	if in.Title != "" {
		title = in.Title
	}
	url := before.Url
	if in.URL != "" {
		url = in.URL
	}
	typ := before.Type
	if in.Type != "" {
		typ = AllowedTypes[in.Type]
	}
	isLocked := before.IsLocked
	if in.IsLocked != nil {
		isLocked = *in.IsLocked
	}

	if err := s.repo.Update(ctx, id, UpdatePatch{
		Title: title, Url: url, Type: typ, IsLocked: isLocked,
	}); err != nil {
		return db.Resource{}, errs.Internal("update resource", err)
	}
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return db.Resource{}, errs.Internal("reload resource", err)
	}
	s.writeAudit(ctx, "resource.update", id, before.LessonID)
	return after, nil
}

// Delete soft-deletes a resource.
func (s *Service) Delete(ctx context.Context, id string) error {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Resource not found")
		}
		return errs.Internal("lookup resource", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete resource", err)
	}
	s.writeAudit(ctx, "resource.delete", id, before.LessonID)
	return nil
}

// writeAudit is a best-effort audit log write.
func (s *Service) writeAudit(ctx context.Context, action, entityID, lessonID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, details, created_at)
		VALUES (UUID(), ?, 'resource', ?, JSON_OBJECT('lessonId', ?), NOW(3))
	`, action, entityID, lessonID)
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

// validateURL mirrors the SafeUrl decorator: only http/https allowed.
// Resources can have a longer URL (up to 1000 chars per the DTO).
func (s *Service) validateURL(u string) error {
	if strings.TrimSpace(u) == "" {
		return errs.BadRequest("url is required")
	}
	if len(u) > 1000 {
		return errs.BadRequest("url too long (max 1000)")
	}
	low := strings.ToLower(u)
	if !strings.HasPrefix(low, "http://") && !strings.HasPrefix(low, "https://") {
		return errs.BadRequest("url must be http(s)://")
	}
	return nil
}

func (s *Service) validateType(t string) error {
	if t == "" {
		return errs.BadRequest("type is required")
	}
	if _, ok := AllowedTypes[t]; !ok {
		names := make([]string, 0, len(AllowedTypes))
		for k := range AllowedTypes {
			names = append(names, k)
		}
		return errs.BadRequest("type must be one of: " + strings.Join(names, ", "))
	}
	return nil
}
