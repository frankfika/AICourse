// judges.go — repo + service for the judges sub-resource of the
// hackathons module. Phase 2 T19.1. 4 endpoints (1 public, 3 admin):
//
//	GET    /api/v1/hackathons/:id/judges            public list
//	POST   /api/v1/hackathons/:id/judges            admin add
//	PATCH  /api/v1/hackathons/:id/judges/:judgeId   admin update
//	DELETE /api/v1/hackathons/:id/judges/:judgeId   admin delete (hard)
//
// Schema notes (see db/migrations/0001_init.sql lines 464-477):
//   - judges has NO created_at, NO updated_at, NO deleted_at. columns:
//     id, hackathon_id, user_id, name, title, avatar_url, bio,
//     order_index, role. Hard delete on the controller path
//     (NestJS uses prisma.judge.delete).
//   - role is VARCHAR(191) (not ENUM). Allowed values: 'judge'|'advisor'|'host'.
package hackathons

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// validJudgeRoles mirrors the NestJS enum. Service-level validation
// rejects anything not in this set.
var validJudgeRoles = map[string]struct{}{
	"judge":   {},
	"advisor": {},
	"host":    {},
}

// ============ DTOs ============

// JudgeDTO is the public shape of a judge. Nullable columns use *string.
type JudgeDTO struct {
	ID          string  `json:"id"`
	HackathonID string  `json:"hackathonId"`
	UserID      *string `json:"userId,omitempty"`
	Name        string  `json:"name"`
	Title       *string `json:"title,omitempty"`
	AvatarURL   *string `json:"avatarUrl,omitempty"`
	Bio         *string `json:"bio,omitempty"`
	OrderIndex  int32   `json:"orderIndex"`
	Role        string  `json:"role"`
}

// ============ Repo wrappers ============

// ListJudges returns all judges for a hackathon.
func (r *Repo) ListJudges(ctx context.Context, hackathonID string, limit int32) ([]db.Judge, error) {
	rows, err := r.q.ListJudgesByHackathon(ctx, db.ListJudgesByHackathonParams{
		HackathonID: hackathonID,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list judges: %w", err)
	}
	return rows, nil
}

// GetJudge returns a judge by id.
func (r *Repo) GetJudge(ctx context.Context, id string) (db.Judge, error) {
	j, err := r.q.GetJudgeByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Judge{}, ErrNotFound
		}
		return db.Judge{}, fmt.Errorf("hackathons.repo: get judge: %w", err)
	}
	return j, nil
}

// CreateJudgeInput is the repo payload.
type CreateJudgeInput struct {
	HackathonID string
	UserID      sql.NullString
	Name        string
	Title       sql.NullString
	AvatarURL   sql.NullString
	Bio         sql.NullString
	OrderIndex  int32
	Role        string
}

// CreateJudge inserts a judge row.
func (r *Repo) CreateJudge(ctx context.Context, in CreateJudgeInput) (string, error) {
	id := uuid.NewString()
	if _, err := r.q.CreateJudge(ctx, db.CreateJudgeParams{
		ID:          id,
		HackathonID: in.HackathonID,
		UserID:      in.UserID,
		Name:        in.Name,
		Title:       in.Title,
		AvatarUrl:   in.AvatarURL,
		Bio:         in.Bio,
		OrderIndex:  in.OrderIndex,
		Role:        in.Role,
	}); err != nil {
		return "", fmt.Errorf("hackathons.repo: create judge: %w", err)
	}
	return id, nil
}

// UpdateJudgeRepoInput is the repo payload for a partial update.
type UpdateJudgeRepoInput struct {
	UserID     sql.NullString
	Name       string
	Title      sql.NullString
	AvatarURL  sql.NullString
	Bio        sql.NullString
	OrderIndex int32
	Role       string
}

// UpdateJudge applies a partial update. Service reads the row first
// and passes the merged values.
func (r *Repo) UpdateJudge(ctx context.Context, id string, in UpdateJudgeRepoInput) error {
	if err := r.q.UpdateJudge(ctx, db.UpdateJudgeParams{
		UserID:     in.UserID,
		Name:       in.Name,
		Title:      in.Title,
		AvatarUrl:  in.AvatarURL,
		Bio:        in.Bio,
		OrderIndex: in.OrderIndex,
		Role:       in.Role,
		ID:         id,
	}); err != nil {
		return fmt.Errorf("hackathons.repo: update judge: %w", err)
	}
	return nil
}

// DeleteJudge hard-deletes a judge row. Returns ErrNotFound if the
// id doesn't exist.
func (r *Repo) DeleteJudge(ctx context.Context, id string) error {
	n, err := r.q.DeleteJudge(ctx, id)
	if err != nil {
		return fmt.Errorf("hackathons.repo: delete judge: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============ Service methods ============

// ListJudges returns the public list of judges for a hackathon,
// ordered by orderIndex ASC.
func (s *Service) ListJudges(ctx context.Context, hackathonID string) ([]JudgeDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListJudges(ctx, hackathonID, 100)
	if err != nil {
		return nil, errs.Internal("list judges", err)
	}
	out := make([]JudgeDTO, 0, len(rows))
	for _, j := range rows {
		out = append(out, toJudgeDTO(j))
	}
	return out, nil
}

// AddJudgeInput is the API-shaped create payload.
type AddJudgeInput struct {
	Name       string
	Title      string
	AvatarURL  string
	Bio        string
	OrderIndex *int32
	Role       string
}

// AddJudge inserts a new judge. Admin only — handler enforces role.
func (s *Service) AddJudge(ctx context.Context, hackathonID string, in AddJudgeInput) (JudgeDTO, error) {
	if strings.TrimSpace(in.Name) == "" {
		return JudgeDTO{}, errs.BadRequest("name is required")
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return JudgeDTO{}, errs.NotFound("Hackathon not found")
		}
		return JudgeDTO{}, errs.Internal("lookup hackathon", err)
	}
	role := in.Role
	if role == "" {
		role = "judge"
	}
	if _, ok := validJudgeRoles[role]; !ok {
		return JudgeDTO{}, errs.BadRequest("role must be one of judge|advisor|host")
	}
	if err := validateOptionalHTTPURL("avatarUrl", in.AvatarURL); err != nil {
		return JudgeDTO{}, err
	}
	orderIndex := int32(0)
	if in.OrderIndex != nil {
		orderIndex = *in.OrderIndex
	}
	id, err := s.repo.CreateJudge(ctx, CreateJudgeInput{
		HackathonID: hackathonID,
		UserID:      sql.NullString{Valid: false},
		Name:        strings.TrimSpace(in.Name),
		Title:       nullableString(in.Title),
		AvatarURL:   nullableString(in.AvatarURL),
		Bio:         nullableString(in.Bio),
		OrderIndex:  orderIndex,
		Role:        role,
	})
	if err != nil {
		return JudgeDTO{}, errs.Internal("create judge", err)
	}
	s.writeAudit(ctx, "HACKATHON_JUDGE_CREATE", id, hackathonID)
	j, err := s.repo.GetJudge(ctx, id)
	if err != nil {
		return JudgeDTO{}, errs.Internal("reload judge", err)
	}
	return toJudgeDTO(j), nil
}

// UpdateJudgeInput is the API-shaped update payload. All fields
// optional — the service fills in missing values from the existing row.
type UpdateJudgeInput struct {
	Name       string
	Title      string
	AvatarURL  string
	Bio        string
	OrderIndex *int32
	Role       string
}

// UpdateJudge applies a partial update. Admin only.
func (s *Service) UpdateJudge(ctx context.Context, hackathonID, judgeID string, in UpdateJudgeInput) (JudgeDTO, error) {
	before, err := s.repo.GetJudge(ctx, judgeID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return JudgeDTO{}, errs.NotFound("Judge not found")
		}
		return JudgeDTO{}, errs.Internal("lookup judge", err)
	}
	if before.HackathonID != hackathonID {
		return JudgeDTO{}, errs.NotFound("Judge not found")
	}
	name := in.Name
	if name == "" {
		name = before.Name
	}
	role := in.Role
	if role == "" {
		role = before.Role
	}
	if _, ok := validJudgeRoles[role]; !ok {
		return JudgeDTO{}, errs.BadRequest("role must be one of judge|advisor|host")
	}
	if err := validateOptionalHTTPURL("avatarUrl", in.AvatarURL); err != nil {
		return JudgeDTO{}, err
	}
	orderIndex := before.OrderIndex
	if in.OrderIndex != nil {
		orderIndex = *in.OrderIndex
	}
	// NestJS does an unconditional spread; the Go port reads first and
	// uses coalesceString for the nullables. The "user_id" field is
	// rarely set on judges (no current UI) — pass through the existing
	// value.
	if err := s.repo.UpdateJudge(ctx, judgeID, UpdateJudgeRepoInput{
		UserID:     before.UserID,
		Name:       name,
		Title:      coalesceString(in.Title, before.Title),
		AvatarURL:  coalesceString(in.AvatarURL, before.AvatarUrl),
		Bio:        coalesceString(in.Bio, before.Bio),
		OrderIndex: orderIndex,
		Role:       role,
	}); err != nil {
		return JudgeDTO{}, errs.Internal("update judge", err)
	}
	s.writeAudit(ctx, "HACKATHON_JUDGE_UPDATE", judgeID, hackathonID)
	after, err := s.repo.GetJudge(ctx, judgeID)
	if err != nil {
		return JudgeDTO{}, errs.Internal("reload judge", err)
	}
	return toJudgeDTO(after), nil
}

// RemoveJudge hard-deletes a judge. Admin only.
func (s *Service) RemoveJudge(ctx context.Context, hackathonID, judgeID string) error {
	before, err := s.repo.GetJudge(ctx, judgeID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Judge not found")
		}
		return errs.Internal("lookup judge", err)
	}
	if before.HackathonID != hackathonID {
		return errs.NotFound("Judge not found")
	}
	if err := s.repo.DeleteJudge(ctx, judgeID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Judge not found")
		}
		return errs.Internal("delete judge", err)
	}
	s.writeAudit(ctx, "HACKATHON_JUDGE_DELETE", judgeID, hackathonID)
	return nil
}

// ============ mappers ============

func toJudgeDTO(j db.Judge) JudgeDTO {
	return JudgeDTO{
		ID:          j.ID,
		HackathonID: j.HackathonID,
		UserID:      nullableStringPtr(j.UserID),
		Name:        j.Name,
		Title:       nullableStringPtr(j.Title),
		AvatarURL:   nullableStringPtr(j.AvatarUrl),
		Bio:         nullableStringPtr(j.Bio),
		OrderIndex:  j.OrderIndex,
		Role:        j.Role,
	}
}
