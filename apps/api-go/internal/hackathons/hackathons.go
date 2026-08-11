// Package hackathons — repo + service for the hackathons module. Mirrors
// apps/api/src/modules/hackathons/.
//
// Phase 2 T19. 10 endpoints (this scope):
//
//	GET    /hackathons                       public list (status + search filter)
//	GET    /hackathons/:id                   public detail
//	POST   /hackathons                       admin create
//	PATCH  /hackathons/:id                   admin update
//	DELETE /hackathons/:id                   admin soft-delete (status='cancelled')
//	POST   /hackathons/:id/register          user register (idempotent)
//	POST   /hackathons/:id/cancel            user cancel
//	GET    /hackathons/:id/my-registration   user self-lookup
//	GET    /hackathons/:id/announcements     public list
//	POST   /hackathons/:id/announcements     admin create
//
// Deferred to T19.1: teams / submissions / judges / sponsors endpoints
// (~20 routes). The schema tables are in place; we just don't surface
// HTTP endpoints yet.
//
// Schema notes (see db/migrations/0001_init.sql):
//   - hackathons has NO deleted_at column. Soft-delete is encoded as
//     status='cancelled'.
//   - hackathon_registrations HAS deleted_at + UNIQUE(hackathon_id, user_id).
//   - announcements has no updated_at column (only created_at).
//   - status enum: 'upcoming'|'active'|'judging'|'finished'|'cancelled'.
//
// NestJS parity: the `effectiveStatus` helper (date-based status inference)
// is mirrored here so the public list reflects the same "if it's past the
// end_date, show as 'judging'" behavior NestJS computes on the fly.
package hackathons

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("hackathons: not found")

// StatusEnum lists the valid status values (mirrors the MySQL ENUM).
// Service-level validation rejects anything not in this set.
var validStatuses = map[string]struct{}{
	"upcoming":  {},
	"active":    {},
	"judging":   {},
	"finished":  {},
	"cancelled": {},
}

// Repo is the hackathons data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Service is the hackathons business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ============ DTOs (public JSON shape) ============

// HackathonDTO is the public shape of a hackathon. Nullable columns use
// `*string` / `*int32` + `omitempty` so absent values don't pollute the
// JSON output. RegistrationCount is a *int32 (not plain int32 with
// omitempty) so the field is always present in detail responses —
// clients use the zero value to mean "no registrations yet".
type HackathonDTO struct {
	ID                     string     `json:"id"`
	Title                  string     `json:"title"`
	Description            string     `json:"description"`
	BannerURL              *string    `json:"bannerUrl,omitempty"`
	Status                 string     `json:"status"`
	StartDate              time.Time  `json:"startDate"`
	EndDate                time.Time  `json:"endDate"`
	RegisterDeadline       *time.Time `json:"registerDeadline,omitempty"`
	SubmissionDeadline     *time.Time `json:"submissionDeadline,omitempty"`
	MaxTeamSize            int32      `json:"maxTeamSize"`
	MinTeamSize            int32      `json:"minTeamSize"`
	Location               *string    `json:"location,omitempty"`
	Rules                  *string    `json:"rules,omitempty"`
	SubmissionRequirements *string    `json:"submissionRequirements,omitempty"`
	Prizes                 *string    `json:"prizes,omitempty"`
	RegistrationURL        *string    `json:"registrationUrl,omitempty"`
	RegistrationLabel      *string    `json:"registrationLabel,omitempty"`
	OrganizerID            *string    `json:"organizerId,omitempty"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
	// Effective counts (admin list + detail). Always present.
	RegistrationCount *int32             `json:"registrationCount"`
	Organizer         *OrganizerDTO      `json:"organizer"`
	Count             *HackathonCountDTO `json:"_count"`
	MyRegistration    *RegistrationDTO   `json:"myRegistration"`
	Judges            *[]JudgeDTO        `json:"judges,omitempty"`
}

type OrganizerDTO struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
}

type HackathonCountDTO struct {
	Registrations int64 `json:"registrations"`
	Teams         int64 `json:"teams"`
	Submissions   int64 `json:"submissions"`
}

// RegistrationDTO is the public shape of a registration.
type RegistrationDTO struct {
	ID           string     `json:"id"`
	HackathonID  string     `json:"hackathonId"`
	UserID       string     `json:"userId"`
	Status       string     `json:"status"`
	RegisteredAt time.Time  `json:"registeredAt"`
	CheckedInAt  *time.Time `json:"checkedInAt"`
}

// AnnouncementDTO is the public shape of an announcement.
type AnnouncementDTO struct {
	ID          string    `json:"id"`
	HackathonID string    `json:"hackathonId"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	IsPinned    bool      `json:"isPinned"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ListParams mirrors the public + admin query-string inputs.
type ListParams struct {
	Status string
	Search string
	UserID string
}

// ============ Repo wrappers ============

// List returns hackathons. status + search are optional filters.
func (r *Repo) List(ctx context.Context, p ListParams, limit int32) ([]db.ListHackathonResponseRowsRow, error) {
	rows, err := r.q.ListHackathonResponseRows(ctx, db.ListHackathonResponseRowsParams{
		UserID: p.UserID,
		Search: p.Search,
		Limit:  limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list: %w", err)
	}
	return rows, nil
}

func (r *Repo) GetResponseByID(ctx context.Context, id, userID string) (db.GetHackathonResponseRowRow, error) {
	row, err := r.q.GetHackathonResponseRow(ctx, db.GetHackathonResponseRowParams{UserID: userID, ID: id})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetHackathonResponseRowRow{}, ErrNotFound
		}
		return db.GetHackathonResponseRowRow{}, fmt.Errorf("hackathons.repo: get response: %w", err)
	}
	return row, nil
}

// GetByID looks up by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Hackathon, error) {
	h, err := r.q.GetHackathonByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Hackathon{}, ErrNotFound
		}
		return db.Hackathon{}, fmt.Errorf("hackathons.repo: get: %w", err)
	}
	return h, nil
}

// CountRegistrations returns the active registration count for a hackathon.
func (r *Repo) CountRegistrations(ctx context.Context, hackathonID string) (int64, error) {
	return r.q.CountRegistrationsByHackathon(ctx, hackathonID)
}

// CreateHackathonInput is the admin create payload. The service fills in
// defaults (status, team sizes, id, timestamps).
type CreateHackathonInput struct {
	Title                  string
	Description            string
	BannerURL              sql.NullString
	Status                 string
	StartDate              time.Time
	EndDate                time.Time
	RegisterDeadline       sql.NullTime
	SubmissionDeadline     sql.NullTime
	MaxTeamSize            int32
	MinTeamSize            int32
	Location               sql.NullString
	Rules                  sql.NullString
	SubmissionRequirements sql.NullString
	Prizes                 sql.NullString
	RegistrationURL        sql.NullString
	RegistrationLabel      sql.NullString
	OrganizerID            sql.NullString
}

// Create inserts a new hackathon.
func (r *Repo) Create(ctx context.Context, in CreateHackathonInput) (string, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateHackathon(ctx, db.CreateHackathonParams{
		ID:                     id,
		Title:                  in.Title,
		Description:            in.Description,
		BannerUrl:              in.BannerURL,
		Status:                 db.HackathonsStatus(in.Status),
		StartDate:              in.StartDate,
		EndDate:                in.EndDate,
		RegisterDeadline:       in.RegisterDeadline,
		SubmissionDeadline:     in.SubmissionDeadline,
		MaxTeamSize:            in.MaxTeamSize,
		MinTeamSize:            in.MinTeamSize,
		Location:               in.Location,
		Rules:                  in.Rules,
		SubmissionRequirements: in.SubmissionRequirements,
		Prizes:                 in.Prizes,
		RegistrationUrl:        in.RegistrationURL,
		RegistrationLabel:      in.RegistrationLabel,
		OrganizerID:            in.OrganizerID,
		CreatedAt:              now,
		UpdatedAt:              now,
	}); err != nil {
		return "", fmt.Errorf("hackathons.repo: create: %w", err)
	}
	return id, nil
}

// UpdateHackathonInput is the admin update payload. The service reads
// the row first, merges the supplied fields with the existing values, and
// passes the full set to the repo.
type UpdateHackathonInput struct {
	Title                  string
	Description            string
	BannerURL              sql.NullString
	Status                 string
	StartDate              time.Time
	EndDate                time.Time
	RegisterDeadline       sql.NullTime
	SubmissionDeadline     sql.NullTime
	MaxTeamSize            int32
	MinTeamSize            int32
	Location               sql.NullString
	Rules                  sql.NullString
	SubmissionRequirements sql.NullString
	Prizes                 sql.NullString
	RegistrationURL        sql.NullString
	RegistrationLabel      sql.NullString
	OrganizerID            sql.NullString
}

// Update applies a partial update.
func (r *Repo) Update(ctx context.Context, id string, in UpdateHackathonInput) error {
	now := time.Now().UTC()
	_, err := r.q.UpdateHackathon(ctx, db.UpdateHackathonParams{
		Title:                  in.Title,
		Description:            in.Description,
		Status:                 db.HackathonsStatus(in.Status),
		StartDate:              in.StartDate,
		EndDate:                in.EndDate,
		RegisterDeadline:       in.RegisterDeadline,
		SubmissionDeadline:     in.SubmissionDeadline,
		MaxTeamSize:            in.MaxTeamSize,
		MinTeamSize:            in.MinTeamSize,
		BannerUrl:              in.BannerURL,
		Location:               in.Location,
		Rules:                  in.Rules,
		SubmissionRequirements: in.SubmissionRequirements,
		Prizes:                 in.Prizes,
		RegistrationUrl:        in.RegistrationURL,
		RegistrationLabel:      in.RegistrationLabel,
		OrganizerID:            in.OrganizerID,
		UpdatedAt:              now,
		ID:                     id,
	})
	if err != nil {
		return fmt.Errorf("hackathons.repo: update: %w", err)
	}
	return nil
}

// SoftDelete flips status to 'cancelled' (the table's notion of soft delete).
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.q.SoftDeleteHackathon(ctx, db.SoftDeleteHackathonParams{
		UpdatedAt: now,
		ID:        id,
	})
	if err != nil {
		return fmt.Errorf("hackathons.repo: soft delete: %w", err)
	}
	return nil
}

// GetRegistration returns the active (non-deleted) registration for a
// (hackathon, user) pair, or ErrNotFound.
func (r *Repo) GetRegistration(ctx context.Context, hackathonID, userID string) (db.GetRegistrationRow, error) {
	row, err := r.q.GetRegistration(ctx, db.GetRegistrationParams{
		HackathonID: hackathonID,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetRegistrationRow{}, ErrNotFound
		}
		return db.GetRegistrationRow{}, fmt.Errorf("hackathons.repo: get registration: %w", err)
	}
	return row, nil
}

// GetRegistrationIncludingCancelled returns the row regardless of
// status (used by the my-registration endpoint so the client can render
// the "you cancelled" state).
func (r *Repo) GetRegistrationIncludingCancelled(ctx context.Context, hackathonID, userID string) (db.GetRegistrationIncludingCancelledRow, error) {
	row, err := r.q.GetRegistrationIncludingCancelled(ctx, db.GetRegistrationIncludingCancelledParams{
		HackathonID: hackathonID,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetRegistrationIncludingCancelledRow{}, ErrNotFound
		}
		return db.GetRegistrationIncludingCancelledRow{}, fmt.Errorf("hackathons.repo: get registration (incl cancelled): %w", err)
	}
	return row, nil
}

// UpsertRegistration creates or re-activates a registration.
func (r *Repo) UpsertRegistration(ctx context.Context, hackathonID, userID string) error {
	now := time.Now().UTC()
	id := uuid.NewString()
	_, err := r.q.UpsertRegistration(ctx, db.UpsertRegistrationParams{
		ID:           id,
		HackathonID:  hackathonID,
		UserID:       userID,
		RegisteredAt: now,
	})
	if err != nil {
		return fmt.Errorf("hackathons.repo: upsert registration: %w", err)
	}
	return nil
}

// CancelRegistration sets status='cancelled' + soft-deletes the row.
// Returns ErrNotFound if no active row exists.
func (r *Repo) CancelRegistration(ctx context.Context, hackathonID, userID string) error {
	now := time.Now().UTC()
	n, err := r.q.CancelRegistration(ctx, db.CancelRegistrationParams{
		DeletedAt:   sql.NullTime{Time: now, Valid: true},
		HackathonID: hackathonID,
		UserID:      userID,
	})
	if err != nil {
		return fmt.Errorf("hackathons.repo: cancel registration: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ListAnnouncements returns the latest N announcements for a hackathon.
func (r *Repo) ListAnnouncements(ctx context.Context, hackathonID string, limit int32) ([]db.Announcement, error) {
	rows, err := r.q.ListAnnouncements(ctx, db.ListAnnouncementsParams{
		HackathonID: hackathonID,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list announcements: %w", err)
	}
	return rows, nil
}

// CreateAnnouncementInput is the admin create-announcement payload.
type CreateAnnouncementInput struct {
	HackathonID string
	Title       string
	Content     string
	IsPinned    bool
}

// CreateAnnouncement inserts a new announcement.
func (r *Repo) CreateAnnouncement(ctx context.Context, in CreateAnnouncementInput) (string, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	_, err := r.q.CreateAnnouncement(ctx, db.CreateAnnouncementParams{
		ID:          id,
		HackathonID: in.HackathonID,
		Title:       in.Title,
		Content:     in.Content,
		IsPinned:    in.IsPinned,
		CreatedAt:   now,
	})
	if err != nil {
		return "", fmt.Errorf("hackathons.repo: create announcement: %w", err)
	}
	return id, nil
}

// ============ Service methods ============

// effectiveStatus mirrors NestJS's date-based override. Editorial states
// (cancelled / finished / judging) are never inferred backwards from
// dates; only upcoming / active are time-driven.
func effectiveStatus(h db.Hackathon, now time.Time) db.HackathonsStatus {
	switch h.Status {
	case db.HackathonsStatusCancelled,
		db.HackathonsStatusFinished,
		db.HackathonsStatusJudging:
		return h.Status
	}
	if now.Before(h.StartDate) {
		return db.HackathonsStatusUpcoming
	}
	if !now.After(h.EndDate) {
		return db.HackathonsStatusActive
	}
	return db.HackathonsStatusJudging
}

// List returns hackathons. The date-based effectiveStatus is applied to
// each row before the (optional) status filter runs, matching NestJS
// findAll. The status filter here is post-mapping (the SQL-level filter
// only narrows the working set, so date inference can still flip rows).
func (s *Service) List(ctx context.Context, p ListParams) ([]HackathonDTO, error) {
	if p.Status != "" {
		if _, ok := validStatuses[p.Status]; !ok {
			return nil, errs.BadRequest("status must be one of upcoming|active|judging|finished|cancelled")
		}
	}
	if p.Search != "" && len(p.Search) > 191 {
		return nil, errs.BadRequest("search too long")
	}
	// Do not push the status filter into SQL. A row persisted as "upcoming"
	// may already be effectively "active" (or "judging") based on its dates.
	// NestJS takes the first 100 rows, computes effectiveStatus, and only then
	// applies the requested status filter.
	repoParams := p
	repoParams.Status = ""
	rows, err := s.repo.List(ctx, repoParams, 100)
	if err != nil {
		return nil, errs.Internal("list hackathons", err)
	}
	now := time.Now().UTC()
	out := make([]HackathonDTO, 0, len(rows))
	for _, row := range rows {
		h := hackathonFromListRow(row)
		dto := toHackathonDTO(h, effectiveStatus(h, now))
		decorateHackathonDTO(&dto, responseRelations{
			organizerID:          row.OrganizerUserID,
			organizerName:        row.OrganizerName,
			organizerAvatarURL:   row.OrganizerAvatarUrl,
			registrationCount:    row.RegistrationCount,
			teamCount:            row.TeamCount,
			submissionCount:      row.SubmissionCount,
			myRegistrationID:     row.MyRegistrationID,
			myRegistrationUserID: row.MyRegistrationUserID,
			myRegistrationStatus: row.MyRegistrationStatus,
			myRegisteredAt:       row.MyRegistrationRegisteredAt,
			myCheckedInAt:        row.MyRegistrationCheckedInAt,
		})
		if p.Status != "" && string(dto.Status) != p.Status {
			continue
		}
		out = append(out, dto)
	}
	return out, nil
}

// Get preserves the original service API for internal callers.
func (s *Service) Get(ctx context.Context, id string, includeCount bool) (HackathonDTO, error) {
	return s.GetForUser(ctx, id, "", includeCount)
}

// GetForUser returns the complete public detail projection. userID may be
// empty for anonymous callers; when supplied, myRegistration is hydrated by
// the same aggregate query. Judges are fetched in one additional query.
func (s *Service) GetForUser(ctx context.Context, id, userID string, includeCount bool) (HackathonDTO, error) {
	row, err := s.repo.GetResponseByID(ctx, id, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return HackathonDTO{}, errs.NotFound("Hackathon not found")
		}
		return HackathonDTO{}, errs.Internal("get hackathon", err)
	}
	h := hackathonFromGetRow(row)
	dto := toHackathonDTO(h, effectiveStatus(h, time.Now().UTC()))
	decorateHackathonDTO(&dto, responseRelations{
		organizerID:          row.OrganizerUserID,
		organizerName:        row.OrganizerName,
		organizerAvatarURL:   row.OrganizerAvatarUrl,
		registrationCount:    row.RegistrationCount,
		teamCount:            row.TeamCount,
		submissionCount:      row.SubmissionCount,
		myRegistrationID:     row.MyRegistrationID,
		myRegistrationUserID: row.MyRegistrationUserID,
		myRegistrationStatus: row.MyRegistrationStatus,
		myRegisteredAt:       row.MyRegistrationRegisteredAt,
		myCheckedInAt:        row.MyRegistrationCheckedInAt,
	})
	if !includeCount {
		dto.RegistrationCount = nil
	}
	judgeRows, err := s.repo.ListJudges(ctx, id, 100)
	if err != nil {
		return HackathonDTO{}, errs.Internal("list hackathon judges", err)
	}
	judges := make([]JudgeDTO, 0, len(judgeRows))
	for _, judge := range judgeRows {
		judges = append(judges, toJudgeDTO(judge))
	}
	dto.Judges = &judges
	return dto, nil
}

// CreateInput is the API-shaped create payload. Strings here; the service
// converts to the repo's typed input.
type CreateInput struct {
	Title                  string
	Description            string
	BannerURL              string
	Status                 string
	StartDate              time.Time
	EndDate                time.Time
	RegisterDeadline       *time.Time
	SubmissionDeadline     *time.Time
	MaxTeamSize            int32
	MinTeamSize            int32
	Location               string
	Rules                  string
	SubmissionRequirements string
	Prizes                 string
	RegistrationURL        string
	RegistrationLabel      string
	OrganizerID            string
}

// Create inserts a new hackathon. Admin-only.
func (s *Service) Create(ctx context.Context, in CreateInput, organizerID string) (HackathonDTO, error) {
	if strings.TrimSpace(in.Title) == "" {
		return HackathonDTO{}, errs.BadRequest("title is required")
	}
	if strings.TrimSpace(in.Description) == "" {
		return HackathonDTO{}, errs.BadRequest("description is required")
	}
	if in.StartDate.IsZero() || in.EndDate.IsZero() {
		return HackathonDTO{}, errs.BadRequest("startDate and endDate are required")
	}
	if !in.EndDate.After(in.StartDate) {
		return HackathonDTO{}, errs.BadRequest("endDate must be after startDate")
	}
	if in.Status == "" {
		in.Status = "upcoming"
	}
	if _, ok := validStatuses[in.Status]; !ok {
		return HackathonDTO{}, errs.BadRequest("status must be one of upcoming|active|judging|finished|cancelled")
	}
	if in.MinTeamSize == 0 {
		in.MinTeamSize = 1
	}
	if in.MaxTeamSize == 0 {
		in.MaxTeamSize = 5
	}
	if in.MinTeamSize < 1 {
		return HackathonDTO{}, errs.BadRequest("minTeamSize must be at least 1")
	}
	if in.MaxTeamSize < 1 || in.MaxTeamSize > 20 {
		return HackathonDTO{}, errs.BadRequest("maxTeamSize must be between 1 and 20")
	}
	if in.MinTeamSize > in.MaxTeamSize {
		return HackathonDTO{}, errs.BadRequest("minTeamSize must be <= maxTeamSize")
	}
	if err := validateOptionalHTTPURL("bannerUrl", in.BannerURL); err != nil {
		return HackathonDTO{}, err
	}
	if err := validateOptionalHTTPURL("registrationUrl", in.RegistrationURL); err != nil {
		return HackathonDTO{}, err
	}
	// CreateHackathonDto does not expose organizerId. The authenticated
	// caller is always the organizer; accepting a body override lets an admin
	// forge ownership or trigger a foreign-key 500 with an arbitrary id.
	orgID := nullableString(organizerID)
	id, err := s.repo.Create(ctx, CreateHackathonInput{
		Title:                  in.Title,
		Description:            in.Description,
		BannerURL:              nullableString(in.BannerURL),
		Status:                 in.Status,
		StartDate:              in.StartDate,
		EndDate:                in.EndDate,
		RegisterDeadline:       nullableTime(in.RegisterDeadline),
		SubmissionDeadline:     nullableTime(in.SubmissionDeadline),
		MaxTeamSize:            in.MaxTeamSize,
		MinTeamSize:            in.MinTeamSize,
		Location:               nullableString(in.Location),
		Rules:                  nullableString(in.Rules),
		SubmissionRequirements: nullableString(in.SubmissionRequirements),
		Prizes:                 nullableString(in.Prizes),
		RegistrationURL:        nullableString(in.RegistrationURL),
		RegistrationLabel:      nullableString(in.RegistrationLabel),
		OrganizerID:            orgID,
	})
	if err != nil {
		return HackathonDTO{}, errs.Internal("create hackathon", err)
	}
	s.writeAudit(ctx, "HACKATHON_CREATE", id, "")
	h, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return HackathonDTO{}, errs.Internal("reload hackathon", err)
	}
	return toHackathonDTO(h, effectiveStatus(h, time.Now().UTC())), nil
}

// Update applies a partial update. Reads the row first to fill in
// missing fields (UpdateHackathon in sqlc requires all 19 columns).
func (s *Service) Update(ctx context.Context, id string, in CreateInput) (HackathonDTO, error) {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return HackathonDTO{}, errs.NotFound("Hackathon not found")
		}
		return HackathonDTO{}, errs.Internal("lookup hackathon", err)
	}
	if strings.TrimSpace(in.Title) == "" {
		in.Title = before.Title
	}
	if strings.TrimSpace(in.Description) == "" {
		in.Description = before.Description
	}
	if in.StartDate.IsZero() {
		in.StartDate = before.StartDate
	}
	if in.EndDate.IsZero() {
		in.EndDate = before.EndDate
	}
	if !in.EndDate.After(in.StartDate) {
		return HackathonDTO{}, errs.BadRequest("endDate must be after startDate")
	}
	if in.Status == "" {
		in.Status = string(before.Status)
	}
	if _, ok := validStatuses[in.Status]; !ok {
		return HackathonDTO{}, errs.BadRequest("status must be one of upcoming|active|judging|finished|cancelled")
	}
	if in.MinTeamSize == 0 {
		in.MinTeamSize = before.MinTeamSize
	}
	if in.MaxTeamSize == 0 {
		in.MaxTeamSize = before.MaxTeamSize
	}
	if in.MinTeamSize < 1 {
		return HackathonDTO{}, errs.BadRequest("minTeamSize must be at least 1")
	}
	if in.MaxTeamSize < 1 || in.MaxTeamSize > 20 {
		return HackathonDTO{}, errs.BadRequest("maxTeamSize must be between 1 and 20")
	}
	if in.MinTeamSize > in.MaxTeamSize {
		return HackathonDTO{}, errs.BadRequest("minTeamSize must be <= maxTeamSize")
	}
	status := in.Status
	startDate := in.StartDate
	endDate := in.EndDate
	bannerURL := coalesceString(in.BannerURL, before.BannerUrl)
	location := coalesceString(in.Location, before.Location)
	rules := coalesceString(in.Rules, before.Rules)
	subReqs := coalesceString(in.SubmissionRequirements, before.SubmissionRequirements)
	prizes := coalesceString(in.Prizes, before.Prizes)
	regURL := coalesceString(in.RegistrationURL, before.RegistrationUrl)
	regLabel := coalesceString(in.RegistrationLabel, before.RegistrationLabel)
	if err := validateOptionalHTTPURL("bannerUrl", in.BannerURL); err != nil {
		return HackathonDTO{}, err
	}
	if err := validateOptionalHTTPURL("registrationUrl", in.RegistrationURL); err != nil {
		return HackathonDTO{}, err
	}
	// UpdateHackathonDto does not expose organizerId; preserve ownership.
	orgID := before.OrganizerID
	regDeadline := coalesceTime(in.RegisterDeadline, before.RegisterDeadline)
	subDeadline := coalesceTime(in.SubmissionDeadline, before.SubmissionDeadline)
	if err := s.repo.Update(ctx, id, UpdateHackathonInput{
		Title:                  in.Title,
		Description:            in.Description,
		BannerURL:              bannerURL,
		Status:                 status,
		StartDate:              startDate,
		EndDate:                endDate,
		RegisterDeadline:       regDeadline,
		SubmissionDeadline:     subDeadline,
		MaxTeamSize:            in.MaxTeamSize,
		MinTeamSize:            in.MinTeamSize,
		Location:               location,
		Rules:                  rules,
		SubmissionRequirements: subReqs,
		Prizes:                 prizes,
		RegistrationURL:        regURL,
		RegistrationLabel:      regLabel,
		OrganizerID:            orgID,
	}); err != nil {
		return HackathonDTO{}, errs.Internal("update hackathon", err)
	}
	s.writeAudit(ctx, "HACKATHON_UPDATE", id, "")
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return HackathonDTO{}, errs.Internal("reload hackathon", err)
	}
	return toHackathonDTO(after, effectiveStatus(after, time.Now().UTC())), nil
}

// Delete soft-deletes (status='cancelled'). Admin only.
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Hackathon not found")
		}
		return errs.Internal("lookup hackathon", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete hackathon", err)
	}
	s.writeAudit(ctx, "HACKATHON_DELETE", id, "")
	return nil
}

// Register registers a user for a hackathon. Idempotent: re-registering
// after cancel re-activates; re-registering while already registered is
// a no-op. Mirrors NestJS's register() (which short-circuits and
// returns the existing row in that case).
func (s *Service) Register(ctx context.Context, userID, hackathonID string) (RegistrationDTO, error) {
	h, err := s.repo.GetByID(ctx, hackathonID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return RegistrationDTO{}, errs.NotFound("Hackathon not found")
		}
		return RegistrationDTO{}, errs.Internal("lookup hackathon", err)
	}
	if h.Status == db.HackathonsStatusCancelled {
		return RegistrationDTO{}, errs.Forbidden("该黑客松已取消")
	}
	if h.RegisterDeadline.Valid && h.RegisterDeadline.Time.Before(time.Now().UTC()) {
		return RegistrationDTO{}, errs.Forbidden("报名已截止")
	}
	// Check if there's an existing active row. If so, mirror NestJS:
	// return the existing row (idempotent, no error).
	existing, err := s.repo.GetRegistration(ctx, hackathonID, userID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return RegistrationDTO{}, errs.Internal("check existing registration", err)
	}
	if err == nil && existing.Status == db.HackathonRegistrationsStatusRegistered {
		return toRegistrationDTO(existing.ID, hackathonID, userID, existing.Status, existing.RegisteredAt, existing.CheckedInAt), nil
	}
	// Either no row yet, or status='cancelled'. Either way, Upsert.
	if err := s.repo.UpsertRegistration(ctx, hackathonID, userID); err != nil {
		return RegistrationDTO{}, errs.Internal("register", err)
	}
	// Read back the (now-active) row.
	row, err := s.repo.GetRegistration(ctx, hackathonID, userID)
	if err != nil {
		return RegistrationDTO{}, errs.Internal("reload registration", err)
	}
	return toRegistrationDTO(row.ID, hackathonID, userID, row.Status, row.RegisteredAt, row.CheckedInAt), nil
}

// CancelRegistration marks the user's registration as cancelled. Returns
// 400 if the user hasn't registered yet (mirrors NestJS).
func (s *Service) CancelRegistration(ctx context.Context, userID, hackathonID string) (RegistrationDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return RegistrationDTO{}, errs.NotFound("Hackathon not found")
		}
		return RegistrationDTO{}, errs.Internal("lookup hackathon", err)
	}
	existing, err := s.repo.GetRegistration(ctx, hackathonID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return RegistrationDTO{}, errs.BadRequest("尚未报名该黑客松")
		}
		return RegistrationDTO{}, errs.Internal("check registration", err)
	}
	if existing.Status != db.HackathonRegistrationsStatusRegistered {
		return RegistrationDTO{}, errs.BadRequest("尚未报名该黑客松")
	}
	if err := s.repo.CancelRegistration(ctx, hackathonID, userID); err != nil {
		return RegistrationDTO{}, errs.Internal("cancel registration", err)
	}
	// Return the cancelled row.
	row, err := s.repo.GetRegistrationIncludingCancelled(ctx, hackathonID, userID)
	if err != nil {
		return RegistrationDTO{}, errs.Internal("reload registration", err)
	}
	return toRegistrationDTO(row.ID, hackathonID, userID, row.Status, row.RegisteredAt, row.CheckedInAt), nil
}

// MyRegistration returns the user's current registration state, or null
// if they've never registered. The endpoint translates "no row" to
// `null` in JSON (so the frontend can tell "not registered" from
// "registered").
func (s *Service) MyRegistration(ctx context.Context, userID, hackathonID string) (*RegistrationDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	row, err := s.repo.GetRegistrationIncludingCancelled(ctx, hackathonID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, nil
		}
		return nil, errs.Internal("get registration", err)
	}
	dto := toRegistrationDTO(row.ID, hackathonID, userID, row.Status, row.RegisteredAt, row.CheckedInAt)
	return &dto, nil
}

// ListAnnouncements returns the latest 100 announcements for a hackathon.
func (s *Service) ListAnnouncements(ctx context.Context, hackathonID string) ([]AnnouncementDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListAnnouncements(ctx, hackathonID, 100)
	if err != nil {
		return nil, errs.Internal("list announcements", err)
	}
	out := make([]AnnouncementDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toAnnouncementDTO(r))
	}
	return out, nil
}

// CreateAnnouncement inserts a new announcement. Admin only.
func (s *Service) CreateAnnouncement(ctx context.Context, hackathonID, userID, title, content string, isPinned bool) (AnnouncementDTO, error) {
	if strings.TrimSpace(title) == "" {
		return AnnouncementDTO{}, errs.BadRequest("title is required")
	}
	if strings.TrimSpace(content) == "" {
		return AnnouncementDTO{}, errs.BadRequest("content is required")
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return AnnouncementDTO{}, errs.NotFound("Hackathon not found")
		}
		return AnnouncementDTO{}, errs.Internal("lookup hackathon", err)
	}
	id, err := s.repo.CreateAnnouncement(ctx, CreateAnnouncementInput{
		HackathonID: hackathonID,
		Title:       title,
		Content:     content,
		IsPinned:    isPinned,
	})
	if err != nil {
		return AnnouncementDTO{}, errs.Internal("create announcement", err)
	}
	s.writeAudit(ctx, "HACKATHON_ANNOUNCEMENT_CREATE", id, hackathonID)
	return AnnouncementDTO{
		ID:          id,
		HackathonID: hackathonID,
		Title:       title,
		Content:     content,
		IsPinned:    isPinned,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

// writeAudit logs a row to audit_logs (best-effort).
func (s *Service) writeAudit(ctx context.Context, action, entityID, details string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, created_at)
		VALUES (UUID(), ?, 'hackathon', ?, NOW(3))
	`, action, entityID)
	if err != nil {
		s.log.Warn("audit log write failed", zap.String("action", action), zap.Error(err))
	}
}

// ============ mappers ============

func toHackathonDTO(h db.Hackathon, status db.HackathonsStatus) HackathonDTO {
	return HackathonDTO{
		ID:                     h.ID,
		Title:                  h.Title,
		Description:            h.Description,
		BannerURL:              nullableStringPtr(h.BannerUrl),
		Status:                 string(status),
		StartDate:              h.StartDate.UTC(),
		EndDate:                h.EndDate.UTC(),
		RegisterDeadline:       nullableTimePtr(h.RegisterDeadline),
		SubmissionDeadline:     nullableTimePtr(h.SubmissionDeadline),
		MaxTeamSize:            h.MaxTeamSize,
		MinTeamSize:            h.MinTeamSize,
		Location:               nullableStringPtr(h.Location),
		Rules:                  nullableStringPtr(h.Rules),
		SubmissionRequirements: nullableStringPtr(h.SubmissionRequirements),
		Prizes:                 nullableStringPtr(h.Prizes),
		RegistrationURL:        nullableStringPtr(h.RegistrationUrl),
		RegistrationLabel:      nullableStringPtr(h.RegistrationLabel),
		OrganizerID:            nullableStringPtr(h.OrganizerID),
		CreatedAt:              h.CreatedAt.UTC(),
		UpdatedAt:              h.UpdatedAt.UTC(),
	}
}

type responseRelations struct {
	organizerID          sql.NullString
	organizerName        sql.NullString
	organizerAvatarURL   sql.NullString
	registrationCount    int64
	teamCount            int64
	submissionCount      int64
	myRegistrationID     sql.NullString
	myRegistrationUserID sql.NullString
	myRegistrationStatus db.NullHackathonRegistrationsStatus
	myRegisteredAt       sql.NullTime
	myCheckedInAt        sql.NullTime
}

func hackathonFromListRow(row db.ListHackathonResponseRowsRow) db.Hackathon {
	return db.Hackathon{
		ID: row.ID, Title: row.Title, Description: row.Description, BannerUrl: row.BannerUrl,
		Status: row.Status, StartDate: row.StartDate, EndDate: row.EndDate,
		RegisterDeadline: row.RegisterDeadline, SubmissionDeadline: row.SubmissionDeadline,
		MaxTeamSize: row.MaxTeamSize, MinTeamSize: row.MinTeamSize, Location: row.Location,
		Rules: row.Rules, SubmissionRequirements: row.SubmissionRequirements, Prizes: row.Prizes,
		RegistrationUrl: row.RegistrationUrl, RegistrationLabel: row.RegistrationLabel,
		OrganizerID: row.OrganizerID, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func hackathonFromGetRow(row db.GetHackathonResponseRowRow) db.Hackathon {
	return db.Hackathon{
		ID: row.ID, Title: row.Title, Description: row.Description, BannerUrl: row.BannerUrl,
		Status: row.Status, StartDate: row.StartDate, EndDate: row.EndDate,
		RegisterDeadline: row.RegisterDeadline, SubmissionDeadline: row.SubmissionDeadline,
		MaxTeamSize: row.MaxTeamSize, MinTeamSize: row.MinTeamSize, Location: row.Location,
		Rules: row.Rules, SubmissionRequirements: row.SubmissionRequirements, Prizes: row.Prizes,
		RegistrationUrl: row.RegistrationUrl, RegistrationLabel: row.RegistrationLabel,
		OrganizerID: row.OrganizerID, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func decorateHackathonDTO(dto *HackathonDTO, rel responseRelations) {
	registrationCount := int32(rel.registrationCount)
	dto.RegistrationCount = &registrationCount
	dto.Count = &HackathonCountDTO{
		Registrations: rel.registrationCount,
		Teams:         rel.teamCount,
		Submissions:   rel.submissionCount,
	}
	if rel.organizerID.Valid && rel.organizerName.Valid {
		dto.Organizer = &OrganizerDTO{
			ID:        rel.organizerID.String,
			Name:      rel.organizerName.String,
			AvatarURL: nullableStringPtr(rel.organizerAvatarURL),
		}
	}
	if rel.myRegistrationID.Valid && rel.myRegistrationUserID.Valid && rel.myRegistrationStatus.Valid && rel.myRegisteredAt.Valid {
		registration := toRegistrationDTO(
			rel.myRegistrationID.String,
			dto.ID,
			rel.myRegistrationUserID.String,
			rel.myRegistrationStatus.HackathonRegistrationsStatus,
			rel.myRegisteredAt.Time,
			rel.myCheckedInAt,
		)
		dto.MyRegistration = &registration
	}
}

func toRegistrationDTO(id, hackathonID, userID string, status db.HackathonRegistrationsStatus, registeredAt time.Time, checkedInAt sql.NullTime) RegistrationDTO {
	return RegistrationDTO{
		ID:           id,
		HackathonID:  hackathonID,
		UserID:       userID,
		Status:       string(status),
		RegisteredAt: registeredAt.UTC(),
		CheckedInAt:  nullableTimePtr(checkedInAt),
	}
}

func toAnnouncementDTO(a db.Announcement) AnnouncementDTO {
	return AnnouncementDTO{
		ID:          a.ID,
		HackathonID: a.HackathonID,
		Title:       a.Title,
		Content:     a.Content,
		IsPinned:    a.IsPinned,
		CreatedAt:   a.CreatedAt.UTC(),
	}
}

func nullableString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

func nullableTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: t.UTC(), Valid: true}
}

// nullableStringPtr turns a sql.NullString into a *string for JSON
// output (nil = absent, &"" = present-and-empty).
func nullableStringPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func nullableTimePtr(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time.UTC()
	return &v
}

// coalesceString returns the new value if non-empty, else the existing
// one (used by Update to preserve fields the admin didn't pass).
func coalesceString(in string, existing sql.NullString) sql.NullString {
	if in != "" {
		return sql.NullString{String: in, Valid: true}
	}
	return existing
}

func coalesceTime(in *time.Time, existing sql.NullTime) sql.NullTime {
	if in != nil {
		return sql.NullTime{Time: in.UTC(), Valid: true}
	}
	return existing
}

// validateOptionalHTTPURL mirrors the NestJS @SafeUrl contract used by the
// hackathons DTOs: optional, at most 1000 bytes, and http(s) only.
func validateOptionalHTTPURL(field, raw string) error {
	if raw == "" {
		return nil
	}
	if len(raw) > 1000 {
		return errs.BadRequest(field + " is too long")
	}
	u, err := url.ParseRequestURI(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return errs.BadRequest(field + " must be a valid http(s) URL")
	}
	return nil
}
