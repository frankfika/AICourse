// sponsors.go — repo + service for the sponsors sub-resource of the
// hackathons module. Phase 2 T19.1. 4 endpoints (1 public, 3 admin):
//
//	GET    /api/v1/hackathons/:id/sponsors             public list
//	POST   /api/v1/hackathons/:id/sponsors             admin add
//	PATCH  /api/v1/hackathons/:id/sponsors/:sponsorId  admin update
//	DELETE /api/v1/hackathons/:id/sponsors/:sponsorId  admin delete (hard)
//
// Schema notes (see db/migrations/0001_init.sql lines 482-495):
//   - sponsors has created_at + updated_at but NO deleted_at. columns:
//     id, hackathon_id, name, logo_url, website_url, tier, order_index,
//     created_at, updated_at. Hard delete on the controller path
//     (NestJS uses prisma.sponsor.delete).
//   - tier is VARCHAR(191) (not ENUM). Allowed values:
//     'platinum'|'gold'|'silver'|'bronze'.
package hackathons

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
)

// validSponsorTiers mirrors the NestJS enum. Service-level validation
// rejects anything not in this set.
var validSponsorTiers = map[string]struct{}{
	"platinum": {},
	"gold":     {},
	"silver":   {},
	"bronze":   {},
}

// ============ DTOs ============

// SponsorDTO is the public shape of a sponsor.
type SponsorDTO struct {
	ID          string    `json:"id"`
	HackathonID string    `json:"hackathonId"`
	Name        string    `json:"name"`
	LogoURL     *string   `json:"logoUrl,omitempty"`
	WebsiteURL  *string   `json:"websiteUrl,omitempty"`
	Tier        string    `json:"tier"`
	OrderIndex  int32     `json:"orderIndex"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ============ Repo wrappers ============

// ListSponsors returns all sponsors for a hackathon.
func (r *Repo) ListSponsors(ctx context.Context, hackathonID string, limit int32) ([]db.Sponsor, error) {
	rows, err := r.q.ListSponsorsByHackathon(ctx, db.ListSponsorsByHackathonParams{
		HackathonID: hackathonID,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list sponsors: %w", err)
	}
	return rows, nil
}

// GetSponsor returns a sponsor by id.
func (r *Repo) GetSponsor(ctx context.Context, id string) (db.Sponsor, error) {
	s, err := r.q.GetSponsorByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Sponsor{}, ErrNotFound
		}
		return db.Sponsor{}, fmt.Errorf("hackathons.repo: get sponsor: %w", err)
	}
	return s, nil
}

// CreateSponsorInput is the repo payload.
type CreateSponsorInput struct {
	HackathonID string
	Name        string
	LogoURL     sql.NullString
	WebsiteURL  sql.NullString
	Tier        string
	OrderIndex  int32
}

// CreateSponsor inserts a sponsor row.
func (r *Repo) CreateSponsor(ctx context.Context, in CreateSponsorInput) (string, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateSponsor(ctx, db.CreateSponsorParams{
		ID:          id,
		HackathonID: in.HackathonID,
		Name:        in.Name,
		LogoUrl:     in.LogoURL,
		WebsiteUrl:  in.WebsiteURL,
		Tier:        in.Tier,
		OrderIndex:  in.OrderIndex,
		CreatedAt:   now,
		UpdatedAt:   now,
	}); err != nil {
		return "", fmt.Errorf("hackathons.repo: create sponsor: %w", err)
	}
	return id, nil
}

// UpdateSponsorRepoInput is the repo payload for a partial update.
type UpdateSponsorRepoInput struct {
	Name       string
	LogoURL    sql.NullString
	WebsiteURL sql.NullString
	Tier       string
	OrderIndex int32
}

// UpdateSponsor applies a partial update. Service reads the row first
// and passes the merged values.
func (r *Repo) UpdateSponsor(ctx context.Context, id string, in UpdateSponsorRepoInput) error {
	if err := r.q.UpdateSponsor(ctx, db.UpdateSponsorParams{
		Name:       in.Name,
		LogoUrl:    in.LogoURL,
		WebsiteUrl: in.WebsiteURL,
		Tier:       in.Tier,
		OrderIndex: in.OrderIndex,
		UpdatedAt:  time.Now().UTC(),
		ID:         id,
	}); err != nil {
		return fmt.Errorf("hackathons.repo: update sponsor: %w", err)
	}
	return nil
}

// DeleteSponsor hard-deletes a sponsor row. Returns ErrNotFound if
// the id doesn't exist.
func (r *Repo) DeleteSponsor(ctx context.Context, id string) error {
	n, err := r.q.DeleteSponsor(ctx, id)
	if err != nil {
		return fmt.Errorf("hackathons.repo: delete sponsor: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============ Service methods ============

// ListSponsors returns the public list of sponsors for a hackathon,
// ordered by tier ASC, orderIndex ASC.
func (s *Service) ListSponsors(ctx context.Context, hackathonID string) ([]SponsorDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListSponsors(ctx, hackathonID, 100)
	if err != nil {
		return nil, errs.Internal("list sponsors", err)
	}
	out := make([]SponsorDTO, 0, len(rows))
	for _, sp := range rows {
		out = append(out, toSponsorDTO(sp))
	}
	return out, nil
}

// AddSponsorInput is the API-shaped create payload.
type AddSponsorInput struct {
	Name       string
	LogoURL    string
	WebsiteURL string
	Tier       string
	OrderIndex *int32
}

// AddSponsor inserts a new sponsor. Admin only.
func (s *Service) AddSponsor(ctx context.Context, hackathonID string, in AddSponsorInput) (SponsorDTO, error) {
	if strings.TrimSpace(in.Name) == "" {
		return SponsorDTO{}, errs.BadRequest("name is required")
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return SponsorDTO{}, errs.NotFound("Hackathon not found")
		}
		return SponsorDTO{}, errs.Internal("lookup hackathon", err)
	}
	tier := in.Tier
	if tier == "" {
		tier = "silver"
	}
	if _, ok := validSponsorTiers[tier]; !ok {
		return SponsorDTO{}, errs.BadRequest("tier must be one of platinum|gold|silver|bronze")
	}
	if err := validateOptionalHTTPURL("logoUrl", in.LogoURL); err != nil {
		return SponsorDTO{}, err
	}
	if err := validateOptionalHTTPURL("websiteUrl", in.WebsiteURL); err != nil {
		return SponsorDTO{}, err
	}
	orderIndex := int32(0)
	if in.OrderIndex != nil {
		orderIndex = *in.OrderIndex
	}
	id, err := s.repo.CreateSponsor(ctx, CreateSponsorInput{
		HackathonID: hackathonID,
		Name:        strings.TrimSpace(in.Name),
		LogoURL:     nullableString(in.LogoURL),
		WebsiteURL:  nullableString(in.WebsiteURL),
		Tier:        tier,
		OrderIndex:  orderIndex,
	})
	if err != nil {
		return SponsorDTO{}, errs.Internal("create sponsor", err)
	}
	s.writeAudit(ctx, "HACKATHON_SPONSOR_CREATE", id, hackathonID)
	sp, err := s.repo.GetSponsor(ctx, id)
	if err != nil {
		return SponsorDTO{}, errs.Internal("reload sponsor", err)
	}
	return toSponsorDTO(sp), nil
}

// UpdateSponsorInput is the API-shaped update payload. All fields
// optional — the service fills in missing values from the existing row.
type UpdateSponsorInput struct {
	Name       string
	LogoURL    string
	WebsiteURL string
	Tier       string
	OrderIndex *int32
}

// UpdateSponsor applies a partial update. Admin only.
func (s *Service) UpdateSponsor(ctx context.Context, hackathonID, sponsorID string, in UpdateSponsorInput) (SponsorDTO, error) {
	before, err := s.repo.GetSponsor(ctx, sponsorID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return SponsorDTO{}, errs.NotFound("Sponsor not found")
		}
		return SponsorDTO{}, errs.Internal("lookup sponsor", err)
	}
	if before.HackathonID != hackathonID {
		return SponsorDTO{}, errs.NotFound("Sponsor not found")
	}
	name := in.Name
	if name == "" {
		name = before.Name
	}
	tier := in.Tier
	if tier == "" {
		tier = before.Tier
	}
	if _, ok := validSponsorTiers[tier]; !ok {
		return SponsorDTO{}, errs.BadRequest("tier must be one of platinum|gold|silver|bronze")
	}
	if err := validateOptionalHTTPURL("logoUrl", in.LogoURL); err != nil {
		return SponsorDTO{}, err
	}
	if err := validateOptionalHTTPURL("websiteUrl", in.WebsiteURL); err != nil {
		return SponsorDTO{}, err
	}
	orderIndex := before.OrderIndex
	if in.OrderIndex != nil {
		orderIndex = *in.OrderIndex
	}
	if err := s.repo.UpdateSponsor(ctx, sponsorID, UpdateSponsorRepoInput{
		Name:       name,
		LogoURL:    coalesceString(in.LogoURL, before.LogoUrl),
		WebsiteURL: coalesceString(in.WebsiteURL, before.WebsiteUrl),
		Tier:       tier,
		OrderIndex: orderIndex,
	}); err != nil {
		return SponsorDTO{}, errs.Internal("update sponsor", err)
	}
	s.writeAudit(ctx, "HACKATHON_SPONSOR_UPDATE", sponsorID, hackathonID)
	after, err := s.repo.GetSponsor(ctx, sponsorID)
	if err != nil {
		return SponsorDTO{}, errs.Internal("reload sponsor", err)
	}
	return toSponsorDTO(after), nil
}

// RemoveSponsor hard-deletes a sponsor. Admin only.
func (s *Service) RemoveSponsor(ctx context.Context, hackathonID, sponsorID string) error {
	before, err := s.repo.GetSponsor(ctx, sponsorID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Sponsor not found")
		}
		return errs.Internal("lookup sponsor", err)
	}
	if before.HackathonID != hackathonID {
		return errs.NotFound("Sponsor not found")
	}
	if err := s.repo.DeleteSponsor(ctx, sponsorID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Sponsor not found")
		}
		return errs.Internal("delete sponsor", err)
	}
	s.writeAudit(ctx, "HACKATHON_SPONSOR_DELETE", sponsorID, hackathonID)
	return nil
}

// ============ mappers ============

func toSponsorDTO(s db.Sponsor) SponsorDTO {
	return SponsorDTO{
		ID:          s.ID,
		HackathonID: s.HackathonID,
		Name:        s.Name,
		LogoURL:     nullableStringPtr(s.LogoUrl),
		WebsiteURL:  nullableStringPtr(s.WebsiteUrl),
		Tier:        s.Tier,
		OrderIndex:  s.OrderIndex,
		CreatedAt:   s.CreatedAt.UTC(),
		UpdatedAt:   s.UpdatedAt.UTC(),
	}
}
