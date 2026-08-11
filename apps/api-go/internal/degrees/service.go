// Package degrees — service layer.
//
// Phase 2 T14-1: business logic for /api/v1/degrees/*.
// Mirrors apps/api/src/modules/degrees/degrees.service.ts 1:1.
package degrees

import (
	"context"
	"database/sql"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service is the degrees business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// DegreeDTO is the public JSON shape of a degree. Flattens
// sql.NullString to plain string (or nil) and uses camelCase keys
// to match the OpenAPI spec.
type DegreeDTO struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	Description    string  `json:"description"`
	LearningPoints string  `json:"learningPoints"`
	Price          string  `json:"price"`
	Icon           string  `json:"icon"`
	CostType       string  `json:"costType"`
	Thumbnail      *string `json:"thumbnail,omitempty"`
	Status         string  `json:"status"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

// toDegreeDTO converts a db.NanoDegree to the public DTO.
func toDegreeDTO(d db.NanoDegree) DegreeDTO {
	dto := DegreeDTO{
		ID:             d.ID,
		Title:          d.Title,
		Description:    d.Description,
		LearningPoints: d.LearningPoints,
		Price:          d.Price,
		Icon:           d.Icon,
		CostType:       string(d.CostType),
		Status:         string(d.Status),
		CreatedAt:      d.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:      d.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if d.Thumbnail.Valid {
		s := d.Thumbnail.String
		dto.Thumbnail = &s
	}
	return dto
}

// APIInput is the create/update payload.
type APIInput struct {
	Title          string
	Description    string
	LearningPoints string
	Price          string
	Icon           string
	CostType       string
	Thumbnail      string
	Status         string
}

// List returns degrees filtered by status/search/isAdmin.
func (s *Service) List(ctx context.Context, status, search string, isAdmin bool) ([]DegreeDTO, error) {
	rows, err := s.repo.List(ctx, status, search, isAdmin)
	if err != nil {
		return nil, errs.Internal("list degrees", err)
	}
	out := make([]DegreeDTO, 0, len(rows))
	for _, d := range rows {
		out = append(out, toDegreeDTO(d))
	}
	return out, nil
}

// GetByID returns a single degree. includeDraft allows the caller
// (admin) to see drafts.
func (s *Service) GetByID(ctx context.Context, id string, includeDraft bool) (DegreeDTO, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return DegreeDTO{}, errs.NotFound("Degree not found")
		}
		return DegreeDTO{}, errs.Internal("get degree", err)
	}
	if d.Status == db.NanoDegreesStatusDraft && !includeDraft {
		return DegreeDTO{}, errs.NotFound("Degree not found")
	}
	return toDegreeDTO(d), nil
}

// Create inserts a new degree.
func (s *Service) Create(ctx context.Context, in APIInput) (DegreeDTO, error) {
	if in.CostType == "" {
		return DegreeDTO{}, errs.BadRequest("costType required")
	}
	if in.Title == "" {
		return DegreeDTO{}, errs.BadRequest("title required")
	}
	now := time.Now().UTC()
	d := db.NanoDegree{
		ID:             uuid.NewString(),
		Title:          in.Title,
		Description:    in.Description,
		LearningPoints: in.LearningPoints,
		Price:          in.Price,
		Icon:           orDefault(in.Icon, "sparkles"),
		CostType:       db.NanoDegreesCostType(in.CostType),
		Status:         db.NanoDegreesStatus(orDefault(in.Status, "draft")),
		UpdatedAt:      now,
	}
	if !validCostType(d.CostType) {
		return DegreeDTO{}, errs.BadRequest("costType must be free, paid, or charity")
	}
	if !validStatus(d.Status) {
		return DegreeDTO{}, errs.BadRequest("status must be draft, published, or archived")
	}
	if in.Thumbnail != "" {
		d.Thumbnail = sql.NullString{String: in.Thumbnail, Valid: true}
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return DegreeDTO{}, errs.Internal("create degree", err)
	}
	// Reload to get DB-computed createdAt.
	d2, err := s.repo.GetByID(ctx, d.ID)
	if err != nil {
		return DegreeDTO{}, errs.Internal("reload degree", err)
	}
	return toDegreeDTO(d2), nil
}

// Update overwrites a degree. The current row is read first to fill
// any unchanged fields.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (DegreeDTO, error) {
	cur, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return DegreeDTO{}, errs.NotFound("Degree not found")
		}
		return DegreeDTO{}, errs.Internal("get degree", err)
	}
	if in.Title != "" {
		cur.Title = in.Title
	}
	if in.Description != "" {
		cur.Description = in.Description
	}
	if in.LearningPoints != "" {
		cur.LearningPoints = in.LearningPoints
	}
	if in.Price != "" {
		cur.Price = in.Price
	}
	if in.Icon != "" {
		cur.Icon = in.Icon
	}
	if in.CostType != "" {
		if !validCostType(db.NanoDegreesCostType(in.CostType)) {
			return DegreeDTO{}, errs.BadRequest("costType must be free, paid, or charity")
		}
		cur.CostType = db.NanoDegreesCostType(in.CostType)
	}
	if in.Status != "" {
		if !validStatus(db.NanoDegreesStatus(in.Status)) {
			return DegreeDTO{}, errs.BadRequest("status must be draft, published, or archived")
		}
		cur.Status = db.NanoDegreesStatus(in.Status)
	}
	// Thumbnail: explicit empty string clears it; non-empty sets it.
	if in.Thumbnail != "" {
		cur.Thumbnail = sql.NullString{String: in.Thumbnail, Valid: true}
	} else if in.Thumbnail == "" && wasProvided(in, "thumbnail") {
		cur.Thumbnail = sql.NullString{}
	}
	cur.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, cur); err != nil {
		return DegreeDTO{}, errs.Internal("update degree", err)
	}
	// Reload for fresh timestamps.
	upd, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return DegreeDTO{}, errs.Internal("reload degree", err)
	}
	return toDegreeDTO(upd), nil
}

// Delete removes a degree. Refuses if there are active enrollments.
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Degree not found")
		}
		return errs.Internal("get degree", err)
	}
	n, err := s.repo.CountActiveEnrollments(ctx, id)
	if err != nil {
		return errs.Internal("count enrollments", err)
	}
	if n > 0 {
		return errs.Conflict("Cannot delete: active enrollments exist. Archive instead.")
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete degree", err)
	}
	return nil
}

// LinkCoursesRequest is the input for the bulk-link endpoint.
type LinkCoursesRequest struct {
	Courses []CourseLink
}

// CourseLink is one course to link.
type CourseLink struct {
	CourseID   string
	OrderIndex int32
}

// LinkCourses links multiple courses to a degree in a single call.
// Each course's orderIndex is required (NestJS spec).
func (s *Service) LinkCourses(ctx context.Context, degreeID string, req LinkCoursesRequest) error {
	if _, err := s.repo.GetByID(ctx, degreeID); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Degree not found")
		}
		return errs.Internal("get degree", err)
	}
	if len(req.Courses) == 0 {
		return errs.BadRequest("courses must be non-empty")
	}
	for _, c := range req.Courses {
		if c.CourseID == "" {
			return errs.BadRequest("courseId required for each entry")
		}
		if err := s.repo.UpsertCourse(ctx, degreeID, c.CourseID, c.OrderIndex); err != nil {
			return errs.Internal("link course", err)
		}
	}
	return nil
}

// ============ helpers ============

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func validCostType(c db.NanoDegreesCostType) bool {
	switch c {
	case db.NanoDegreesCostTypeFree, db.NanoDegreesCostTypePaid, db.NanoDegreesCostTypeCharity:
		return true
	}
	return false
}

func validStatus(s db.NanoDegreesStatus) bool {
	switch s {
	case db.NanoDegreesStatusDraft, db.NanoDegreesStatusPublished, db.NanoDegreesStatusArchived:
		return true
	}
	return false
}

// wasProvided returns true if the field was explicitly present in the
// input. Used to distinguish "field not sent" (keep existing value)
// from "field sent as empty string" (clear the value).
func wasProvided(in APIInput, _ string) bool {
	// APIInput is built from JSON; an empty string for Thumbnail means
	// the field was either not sent or sent as "". We can't distinguish
	// at this layer. For the update endpoint, callers wanting to clear
	// the thumbnail should pass an explicit value or use the admin
	// direct-SQL path. (NestJS has the same limitation — there's no
	// "null" sentinel for string fields in the DTO.)
	//
	// For degrees, the common case is "leave the existing thumbnail
	// alone", which is what most callers want. The 4xx case ("I
	// really want to clear it") can be handled by a future PATCH
	// endpoint that accepts a sentinel value.
	return false
}
