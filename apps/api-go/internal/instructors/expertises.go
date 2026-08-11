// Package instructors — instructor expertise categories (e.g. "AI",
// "Backend", "Frontend"). Mirrors
// apps/api/src/modules/instructors/expertises.controller.ts 1:1.
//
// Phase 2 T24: 5 endpoints total (1 public + 4 admin). The public
// surface returns all expertises (active + inactive, same as NestJS
// for parity — the frontend filters by isActive in the chip UI). The
// admin surface is gated by middleware.RequireRole("admin") in the
// handler layer.
package instructors

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ExpertiseView is the public JSON shape of an expertise row.
// Mirrors NestJS's `InstructorExpertise` Prisma model field-for-field
// (camelCase keys to match the NestJS API contract; nullable fields
// use *string).
type ExpertiseView struct {
	ID         string  `json:"id"`
	Key        string  `json:"key"`
	Label      string  `json:"label"`
	LabelEn    *string `json:"labelEn,omitempty"`
	IsActive   bool    `json:"isActive"`
	OrderIndex int32   `json:"orderIndex"`
	CreatedAt  string  `json:"createdAt"`
	UpdatedAt  string  `json:"updatedAt"`
}

// CreateExpertiseInput is the admin create payload. Mirrors
// apps/api/src/modules/instructors/instructors.dto.ts:CreateExpertiseDto.
type CreateExpertiseInput struct {
	Key        string
	Label      string
	LabelEn    *string
	IsActive   *bool
	OrderIndex *int32
}

// UpdateExpertiseInput is the admin partial-update payload. Every
// field is a pointer so the service can distinguish "not supplied"
// (keep existing value) from "supplied as zero" (clear it).
type UpdateExpertiseInput struct {
	Key        *string
	Label      *string
	LabelEn    *string
	IsActive   *bool
	OrderIndex *int32
}

// expertiseRepo is the data-layer interface this module uses. The
// existing *Repo from instructors.go already has a *db.Queries handle
// behind it; we re-expose the bits we need as a tiny interface so
// the service is test-friendly without circular wiring.
type expertiseRepo interface {
	queries() *db.Queries
	conn() *sql.DB
}

// attachExpertiseRepo wires a *Repo (which implements the methods we
// need) as the data layer for the expertise service.
type attachExpertiseRepo struct {
	r *Repo
}

func (a attachExpertiseRepo) queries() *db.Queries { return a.r.q }
func (a attachExpertiseRepo) conn() *sql.DB        { return a.r.conn }

// ExpertiseService is the business logic for the expertises module.
// It reuses the existing instructors *Repo for the sqlc handle so
// we don't open a second *sql.DB pool.
type ExpertiseService struct {
	repo expertiseRepo
	log  *zap.Logger
}

// NewExpertiseService builds a service.
func NewExpertiseService(r *Repo, log *zap.Logger) *ExpertiseService {
	return &ExpertiseService{repo: attachExpertiseRepo{r: r}, log: log}
}

// List returns all expertises (active first, then by orderIndex).
// Mirrors NestJS `instructors.service.findAllExpertises` ordering
// (orderBy: [{ isActive: 'desc' }, { orderIndex: 'asc' }]).
func (s *ExpertiseService) List(ctx context.Context) ([]ExpertiseView, error) {
	rows, err := s.repo.queries().ListExpertises(ctx)
	if err != nil {
		return nil, errs.Internal("list expertises", err)
	}
	out := make([]ExpertiseView, 0, len(rows))
	for _, r := range rows {
		out = append(out, expertiseToView(r))
	}
	return out, nil
}

// Create inserts a new expertise. Throws 409 on duplicate key.
func (s *ExpertiseService) Create(ctx context.Context, in CreateExpertiseInput) (ExpertiseView, error) {
	if strings.TrimSpace(in.Key) == "" {
		return ExpertiseView{}, errs.BadRequest("key is required")
	}
	if strings.TrimSpace(in.Label) == "" {
		return ExpertiseView{}, errs.BadRequest("label is required")
	}
	if len(in.Key) > 60 {
		return ExpertiseView{}, errs.BadRequest("key must be 60 characters or fewer")
	}
	if len(in.Label) > 80 {
		return ExpertiseView{}, errs.BadRequest("label must be 80 characters or fewer")
	}

	// Uniqueness check — DB also has UNIQUE INDEX, but checking
	// first gives us a clean 409 envelope instead of a 500.
	if _, err := s.repo.queries().GetExpertiseByKey(ctx, in.Key); err == nil {
		return ExpertiseView{}, errs.Conflict(`专长 key "` + in.Key + `" 已存在`)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return ExpertiseView{}, errs.Internal("uniqueness check", err)
	}

	id := generateExpertiseID()
	now := nowUTC()
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if _, err := s.repo.queries().CreateExpertise(ctx, db.CreateExpertiseParams{
		ID:         id,
		Key:        in.Key,
		Label:      in.Label,
		LabelEn:    ns(in.LabelEn),
		IsActive:   isActive,
		OrderIndex: orderIdx,
		CreatedAt:  now,
		UpdatedAt:  now,
	}); err != nil {
		return ExpertiseView{}, errs.Internal("create expertise", err)
	}
	row, err := s.repo.queries().GetExpertiseByID(ctx, id)
	if err != nil {
		return ExpertiseView{}, errs.Internal("reload expertise", err)
	}
	return expertiseToView(row), nil
}

// Update applies a partial update. Reads the existing row first so
// unchanged fields survive (NestJS does the same — UpdateExpertiseDto
// is PartialType<CreateExpertiseDto>).
func (s *ExpertiseService) Update(ctx context.Context, id string, in UpdateExpertiseInput) (ExpertiseView, error) {
	before, err := s.repo.queries().GetExpertiseByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ExpertiseView{}, errs.NotFound("Expertise not found")
		}
		return ExpertiseView{}, errs.Internal("lookup expertise", err)
	}
	// Key change → must not collide with another row's key.
	key := before.Key
	if in.Key != nil && *in.Key != "" && *in.Key != before.Key {
		if _, err := s.repo.queries().GetExpertiseByKey(ctx, *in.Key); err == nil {
			return ExpertiseView{}, errs.Conflict(`专长 key "` + *in.Key + `" 已存在`)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return ExpertiseView{}, errs.Internal("uniqueness check", err)
		}
		key = *in.Key
	}
	label := before.Label
	if in.Label != nil && *in.Label != "" {
		label = *in.Label
	}
	labelEn := nsMerge(in.LabelEn, before.LabelEn)
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	now := nowUTC()
	if err := s.repo.queries().UpdateExpertise(ctx, db.UpdateExpertiseParams{
		Key:        key,
		Label:      label,
		LabelEn:    labelEn,
		IsActive:   isActive,
		OrderIndex: orderIdx,
		UpdatedAt:  now,
		ID:         id,
	}); err != nil {
		return ExpertiseView{}, errs.Internal("update expertise", err)
	}
	row, err := s.repo.queries().GetExpertiseByID(ctx, id)
	if err != nil {
		return ExpertiseView{}, errs.Internal("reload expertise", err)
	}
	return expertiseToView(row), nil
}

// Delete hard-deletes the row. NestJS does the same (DeleteExpertise
// uses prisma.delete). The instructor_expertise_links cascade-delete
// via FK; no need to delete links first.
func (s *ExpertiseService) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.queries().GetExpertiseByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errs.NotFound("Expertise not found")
		}
		return fmt.Errorf("lookup expertise: %w", err)
	}
	if err := s.repo.queries().DeleteExpertise(ctx, id); err != nil {
		return errs.Internal("delete expertise", err)
	}
	return nil
}

// expertiseToView converts the sqlc row into the public JSON shape.
func expertiseToView(x db.InstructorExpertise) ExpertiseView {
	v := ExpertiseView{
		ID:         x.ID,
		Key:        x.Key,
		Label:      x.Label,
		IsActive:   x.IsActive,
		OrderIndex: x.OrderIndex,
		CreatedAt:  x.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:  x.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if x.LabelEn.Valid {
		s := x.LabelEn.String
		v.LabelEn = &s
	}
	return v
}

// nowUTC returns the current UTC time. Centralised so tests can
// swap it out later if needed; today it's just time.Now().UTC().
func nowUTC() time.Time {
	return time.Now().UTC()
}

// generateExpertiseID returns a cuid-shaped id (c<24 hex>), matching
// the convention used by the other modules in this package so admin
// tooling that greps for `c[a-z0-9]{24}` keeps working.
func generateExpertiseID() string {
	return "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
}
