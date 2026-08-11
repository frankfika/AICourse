// submissions.go — repo + service for the submissions sub-resource of
// the hackathons module. Phase 2 T19.1. 5 endpoints:
//
//	GET    /api/v1/hackathons/:id/submissions           auth (my submissions)
//	GET    /api/v1/hackathons/:id/submissions/all       admin (all submissions)
//	POST   /api/v1/hackathons/:id/submissions           auth create
//	PATCH  /api/v1/hackathons/:id/submissions/:sid      auth update (owner only)
//	POST   /api/v1/hackathons/:id/submissions/:sid/judge admin score
//
// Schema notes (see db/migrations/0001_init.sql lines 500-525):
//   - submissions HAS deleted_at (soft delete; List queries filter it).
//   - columns: id, hackathon_id, team_id, user_id, title, description,
//     demo_url, repo_url, video_url, status, score, feedback, submitted_at,
//     created_at, updated_at, deleted_at.
//   - status ENUM: 'draft'|'submitted'|'under_review'|'shortlisted'|'winner'|'rejected'.
//   - score is DECIMAL(5,2); we read/write as a string to avoid
//     floating-point precision loss in JSON.
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

// validSubmissionStatuses mirrors the MySQL ENUM. Service-level
// validation rejects anything not in this set.
var validSubmissionStatuses = map[string]struct{}{
	"draft":        {},
	"submitted":    {},
	"under_review": {},
	"shortlisted":  {},
	"winner":       {},
	"rejected":     {},
}

// ============ DTOs ============

// SubmissionDTO is the public shape of a submission. Nullable columns
// use *string / *time.Time. Score is a *string (DECIMAL → string) to
// avoid floating-point precision loss.
type SubmissionDTO struct {
	ID          string     `json:"id"`
	HackathonID string     `json:"hackathonId"`
	TeamID      *string    `json:"teamId,omitempty"`
	UserID      *string    `json:"userId,omitempty"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	DemoURL     *string    `json:"demoUrl,omitempty"`
	RepoURL     *string    `json:"repoUrl,omitempty"`
	VideoURL    *string    `json:"videoUrl,omitempty"`
	Status      string     `json:"status"`
	Score       *string    `json:"score,omitempty"`
	Feedback    *string    `json:"feedback,omitempty"`
	SubmittedAt *time.Time `json:"submittedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// ============ Repo wrappers ============

// GetSubmissionByID returns a non-deleted submission.
func (r *Repo) GetSubmissionByID(ctx context.Context, id string) (db.Submission, error) {
	s, err := r.q.GetSubmissionByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Submission{}, ErrNotFound
		}
		return db.Submission{}, fmt.Errorf("hackathons.repo: get submission: %w", err)
	}
	return s, nil
}

// ListAllSubmissions returns all non-deleted submissions for a hackathon
// (admin view).
func (r *Repo) ListAllSubmissions(ctx context.Context, hackathonID string, limit int32) ([]db.Submission, error) {
	rows, err := r.q.ListSubmissionsByHackathon(ctx, db.ListSubmissionsByHackathonParams{
		HackathonID: hackathonID,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list submissions: %w", err)
	}
	return rows, nil
}

// ListUserSubmissions returns the user's own submissions (user_id match
// OR team-member match). Limit bound to 100.
func (r *Repo) ListUserSubmissions(ctx context.Context, userID, hackathonID string, limit int32) ([]db.Submission, error) {
	userIDArg := sql.NullString{String: userID, Valid: true}
	rows, err := r.q.ListMySubmissions(ctx, db.ListMySubmissionsParams{
		UserID:      userID,
		HackathonID: hackathonID,
		UserID_2:    userIDArg,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list my submissions: %w", err)
	}
	return rows, nil
}

// CreateSubmissionRepoInput is the repo payload.
type CreateSubmissionRepoInput struct {
	HackathonID string
	TeamID      sql.NullString
	UserID      sql.NullString
	Title       string
	Description string
	DemoURL     sql.NullString
	RepoURL     sql.NullString
	VideoURL    sql.NullString
	Status      string
	SubmittedAt sql.NullTime
}

// CreateSubmission inserts a new submission. The service resolves
// submittedAt from the status before calling here.
func (r *Repo) CreateSubmission(ctx context.Context, in CreateSubmissionRepoInput) (string, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateSubmission(ctx, db.CreateSubmissionParams{
		ID:          id,
		HackathonID: in.HackathonID,
		TeamID:      in.TeamID,
		UserID:      in.UserID,
		Title:       in.Title,
		Description: in.Description,
		DemoUrl:     in.DemoURL,
		RepoUrl:     in.RepoURL,
		VideoUrl:    in.VideoURL,
		Status:      db.SubmissionsStatus(in.Status),
		Score:       sql.NullString{Valid: false},
		Feedback:    sql.NullString{Valid: false},
		SubmittedAt: in.SubmittedAt,
		CreatedAt:   now,
		UpdatedAt:   now,
	}); err != nil {
		return "", fmt.Errorf("hackathons.repo: create submission: %w", err)
	}
	return id, nil
}

// UpdateSubmissionRepoInput is the repo payload for a partial update.
type UpdateSubmissionRepoInput struct {
	Title       string
	Description string
	DemoURL     sql.NullString
	RepoURL     sql.NullString
	VideoURL    sql.NullString
	Status      string
	Score       sql.NullString
	Feedback    sql.NullString
	SubmittedAt sql.NullTime
}

// UpdateSubmission applies a partial update. Service reads the row
// first to fill in missing fields (sqlc Update requires all fields).
func (r *Repo) UpdateSubmission(ctx context.Context, id string, in UpdateSubmissionRepoInput) error {
	err := r.q.UpdateSubmission(ctx, db.UpdateSubmissionParams{
		Title:       in.Title,
		Description: in.Description,
		DemoUrl:     in.DemoURL,
		RepoUrl:     in.RepoURL,
		VideoUrl:    in.VideoURL,
		Status:      db.SubmissionsStatus(in.Status),
		Score:       in.Score,
		Feedback:    in.Feedback,
		SubmittedAt: in.SubmittedAt,
		UpdatedAt:   time.Now().UTC(),
		ID:          id,
	})
	if err != nil {
		return fmt.Errorf("hackathons.repo: update submission: %w", err)
	}
	return nil
}

// ============ Service methods ============

// ListMySubmissions returns the caller's own submissions for a
// hackathon. Mirrors NestJS getMySubmissions (service.ts:426-439).
func (s *Service) ListMySubmissions(ctx context.Context, userID, hackathonID string) ([]SubmissionDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListUserSubmissions(ctx, userID, hackathonID, 100)
	if err != nil {
		return nil, errs.Internal("list my submissions", err)
	}
	out := make([]SubmissionDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toSubmissionDTO(r))
	}
	return out, nil
}

// ListAllSubmissions returns all submissions for a hackathon. Admin
// only — the handler enforces role via middleware.
func (s *Service) ListAllSubmissions(ctx context.Context, hackathonID string) ([]SubmissionDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListAllSubmissions(ctx, hackathonID, 200)
	if err != nil {
		return nil, errs.Internal("list submissions", err)
	}
	out := make([]SubmissionDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toSubmissionDTO(r))
	}
	return out, nil
}

// CreateSubmissionInput is the API-shaped create payload.
type CreateSubmissionInput struct {
	Title       string
	Description string
	DemoURL     string
	RepoURL     string
	VideoURL    string
	TeamID      string
	Status      string
}

// CreateSubmission inserts a new submission. Mirrors NestJS
// createSubmission (service.ts:441-479):
//  1. Verify the hackathon exists
//  2. Verify the user is registered
//  3. If teamId is provided, verify the user is a member of that team
//  4. Set submittedAt if status='submitted'
//  5. Insert; if teamId, the user_id stays NULL (team-owned submission)
func (s *Service) CreateSubmission(ctx context.Context, userID, hackathonID string, in CreateSubmissionInput) (SubmissionDTO, error) {
	if strings.TrimSpace(in.Title) == "" {
		return SubmissionDTO{}, errs.BadRequest("title is required")
	}
	if strings.TrimSpace(in.Description) == "" {
		return SubmissionDTO{}, errs.BadRequest("description is required")
	}
	for field, raw := range map[string]string{
		"demoUrl": in.DemoURL, "repoUrl": in.RepoURL, "videoUrl": in.VideoURL,
	} {
		if err := validateOptionalHTTPURL(field, raw); err != nil {
			return SubmissionDTO{}, err
		}
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.NotFound("Hackathon not found")
		}
		return SubmissionDTO{}, errs.Internal("lookup hackathon", err)
	}
	if err := s.ensureRegistered(ctx, userID, hackathonID); err != nil {
		return SubmissionDTO{}, err
	}
	teamID := sql.NullString{Valid: false}
	userIDNS := sql.NullString{String: userID, Valid: true}
	if in.TeamID != "" {
		// Validate the team belongs to this hackathon + user is a member.
		teamHackathonID, err := s.repo.GetTeamHackathonID(ctx, in.TeamID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return SubmissionDTO{}, errs.NotFound("Team not found")
			}
			return SubmissionDTO{}, errs.Internal("lookup team", err)
		}
		if teamHackathonID != hackathonID {
			return SubmissionDTO{}, errs.NotFound("Team not found")
		}
		if _, err := s.repo.GetMembershipForUserAndTeam(ctx, in.TeamID, userID); err != nil {
			if errors.Is(err, ErrNotFound) {
				return SubmissionDTO{}, errs.Forbidden("你不是该队伍成员")
			}
			return SubmissionDTO{}, errs.Internal("check team membership", err)
		}
		teamID = sql.NullString{String: in.TeamID, Valid: true}
		// Team-owned submission: user_id is NULL (the team is the
		// "owner", members contributed). NestJS does the same.
		userIDNS = sql.NullString{Valid: false}
	}
	status := in.Status
	if status == "" {
		status = "draft"
	}
	if _, ok := validSubmissionStatuses[status]; !ok {
		return SubmissionDTO{}, errs.BadRequest("status must be one of draft|submitted|under_review|shortlisted|winner|rejected")
	}
	submittedAt := sql.NullTime{Valid: false}
	if status == "submitted" {
		submittedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	id, err := s.repo.CreateSubmission(ctx, CreateSubmissionRepoInput{
		HackathonID: hackathonID,
		TeamID:      teamID,
		UserID:      userIDNS,
		Title:       in.Title,
		Description: in.Description,
		DemoURL:     nullableString(in.DemoURL),
		RepoURL:     nullableString(in.RepoURL),
		VideoURL:    nullableString(in.VideoURL),
		Status:      status,
		SubmittedAt: submittedAt,
	})
	if err != nil {
		return SubmissionDTO{}, errs.Internal("create submission", err)
	}
	s.writeAudit(ctx, "HACKATHON_SUBMISSION_CREATE", id, hackathonID)
	sub, err := s.repo.GetSubmissionByID(ctx, id)
	if err != nil {
		return SubmissionDTO{}, errs.Internal("reload submission", err)
	}
	return toSubmissionDTO(sub), nil
}

// UpdateSubmissionInput is the API-shaped update payload. All fields
// optional; the service fills in missing values from the existing row.
type UpdateSubmissionInput struct {
	Title       string
	Description string
	DemoURL     string
	RepoURL     string
	VideoURL    string
	Status      string
}

// UpdateSubmission applies a partial update. Owner or team-member
// only. Mirrors NestJS updateSubmission (service.ts:481-515).
//  1. Read existing row
//  2. Merge new values into the existing payload
//  3. If transitioning draft→submitted, set submittedAt = now
func (s *Service) UpdateSubmission(ctx context.Context, userID, hackathonID, submissionID string, in UpdateSubmissionInput) (SubmissionDTO, error) {
	for field, raw := range map[string]string{
		"demoUrl": in.DemoURL, "repoUrl": in.RepoURL, "videoUrl": in.VideoURL,
	} {
		if err := validateOptionalHTTPURL(field, raw); err != nil {
			return SubmissionDTO{}, err
		}
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.NotFound("Hackathon not found")
		}
		return SubmissionDTO{}, errs.Internal("lookup hackathon", err)
	}
	existing, err := s.repo.GetSubmissionByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.NotFound("Submission not found")
		}
		return SubmissionDTO{}, errs.Internal("lookup submission", err)
	}
	if existing.HackathonID != hackathonID {
		return SubmissionDTO{}, errs.NotFound("Submission not found")
	}
	// Owner check: user_id match OR team-member match.
	isOwner := existing.UserID.Valid && existing.UserID.String == userID
	if !isOwner && existing.TeamID.Valid {
		if _, err := s.repo.GetMembershipForUserAndTeam(ctx, existing.TeamID.String, userID); err == nil {
			isOwner = true
		} else if !errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.Internal("check team membership", err)
		}
	}
	if !isOwner {
		return SubmissionDTO{}, errs.NotFound("Submission not found")
	}
	// Merge the new values into the existing payload.
	title := in.Title
	if title == "" {
		title = existing.Title
	}
	desc := in.Description
	if desc == "" {
		desc = existing.Description
	}
	demoURL := existing.DemoUrl
	if in.DemoURL != "" {
		demoURL = sql.NullString{String: in.DemoURL, Valid: true}
	} else if in.DemoURL == "__CLEAR__" {
		// We don't expose a clear flag right now (matches NestJS — it
		// doesn't either; PATCH replaces only the supplied fields).
		// Reserved for future.
	}
	repoURL := existing.RepoUrl
	if in.RepoURL != "" {
		repoURL = sql.NullString{String: in.RepoURL, Valid: true}
	}
	videoURL := existing.VideoUrl
	if in.VideoURL != "" {
		videoURL = sql.NullString{String: in.VideoURL, Valid: true}
	}
	status := in.Status
	if status == "" {
		status = string(existing.Status)
	}
	if _, ok := validSubmissionStatuses[status]; !ok {
		return SubmissionDTO{}, errs.BadRequest("status must be one of draft|submitted|under_review|shortlisted|winner|rejected")
	}
	// If transitioning draft → submitted, set submittedAt.
	submittedAt := existing.SubmittedAt
	if status == "submitted" && !existing.SubmittedAt.Valid {
		submittedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	if err := s.repo.UpdateSubmission(ctx, submissionID, UpdateSubmissionRepoInput{
		Title:       title,
		Description: desc,
		DemoURL:     demoURL,
		RepoURL:     repoURL,
		VideoURL:    videoURL,
		Status:      status,
		Score:       existing.Score,
		Feedback:    existing.Feedback,
		SubmittedAt: submittedAt,
	}); err != nil {
		return SubmissionDTO{}, errs.Internal("update submission", err)
	}
	s.writeAudit(ctx, "HACKATHON_SUBMISSION_UPDATE", submissionID, hackathonID)
	updated, err := s.repo.GetSubmissionByID(ctx, submissionID)
	if err != nil {
		return SubmissionDTO{}, errs.Internal("reload submission", err)
	}
	return toSubmissionDTO(updated), nil
}

// JudgeSubmissionInput is the API-shaped judge payload.
type JudgeSubmissionInput struct {
	Score    *float64
	Feedback string
	Status   string
}

// JudgeSubmission records a score + feedback on a submission. Admin
// only — the handler enforces role via middleware. Mirrors NestJS
// judgeSubmission (service.ts:529-552).
func (s *Service) JudgeSubmission(ctx context.Context, hackathonID, submissionID string, in JudgeSubmissionInput) (SubmissionDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.NotFound("Hackathon not found")
		}
		return SubmissionDTO{}, errs.Internal("lookup hackathon", err)
	}
	existing, err := s.repo.GetSubmissionByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return SubmissionDTO{}, errs.NotFound("Submission not found")
		}
		return SubmissionDTO{}, errs.Internal("lookup submission", err)
	}
	if existing.HackathonID != hackathonID {
		return SubmissionDTO{}, errs.NotFound("Submission not found")
	}
	scoreStr := existing.Score
	if in.Score == nil {
		return SubmissionDTO{}, errs.BadRequest("score is required")
	}
	v := *in.Score
	if v < 0 || v > 100 || v != float64(int64(v)) {
		return SubmissionDTO{}, errs.BadRequest("score must be an integer between 0 and 100")
	}
	// Format with 2 decimals to match the DECIMAL(5,2) column.
	scoreStr = sql.NullString{String: fmt.Sprintf("%.2f", v), Valid: true}
	feedback := existing.Feedback
	if in.Feedback != "" {
		feedback = sql.NullString{String: in.Feedback, Valid: true}
	}
	status := in.Status
	if status == "" {
		status = "under_review"
	}
	if _, ok := validSubmissionStatuses[status]; !ok {
		return SubmissionDTO{}, errs.BadRequest("status must be one of draft|submitted|under_review|shortlisted|winner|rejected")
	}
	if err := s.repo.UpdateSubmission(ctx, submissionID, UpdateSubmissionRepoInput{
		Title:       existing.Title,
		Description: existing.Description,
		DemoURL:     existing.DemoUrl,
		RepoURL:     existing.RepoUrl,
		VideoURL:    existing.VideoUrl,
		Status:      status,
		Score:       scoreStr,
		Feedback:    feedback,
		SubmittedAt: existing.SubmittedAt,
	}); err != nil {
		return SubmissionDTO{}, errs.Internal("judge submission", err)
	}
	s.writeAudit(ctx, "HACKATHON_SUBMISSION_JUDGE", submissionID, hackathonID)
	updated, err := s.repo.GetSubmissionByID(ctx, submissionID)
	if err != nil {
		return SubmissionDTO{}, errs.Internal("reload submission", err)
	}
	return toSubmissionDTO(updated), nil
}

// ============ mappers ============

// toSubmissionDTO maps a sqlc Submission row to the public DTO.
func toSubmissionDTO(s db.Submission) SubmissionDTO {
	var score *string
	if s.Score.Valid {
		v := s.Score.String
		score = &v
	}
	return SubmissionDTO{
		ID:          s.ID,
		HackathonID: s.HackathonID,
		TeamID:      nullableStringPtr(s.TeamID),
		UserID:      nullableStringPtr(s.UserID),
		Title:       s.Title,
		Description: s.Description,
		DemoURL:     nullableStringPtr(s.DemoUrl),
		RepoURL:     nullableStringPtr(s.RepoUrl),
		VideoURL:    nullableStringPtr(s.VideoUrl),
		Status:      string(s.Status),
		Score:       score,
		Feedback:    nullableStringPtr(s.Feedback),
		SubmittedAt: nullableTimePtr(s.SubmittedAt),
		CreatedAt:   s.CreatedAt.UTC(),
		UpdatedAt:   s.UpdatedAt.UTC(),
	}
}
