// teams.go — repo + service for the teams + team_members sub-resource of
// the hackathons module. Phase 2 T19.1. 4 endpoints (1 public, 3 auth):
//
//	GET    /api/v1/hackathons/:id/teams                  public list
//	POST   /api/v1/hackathons/:id/teams                  auth create
//	POST   /api/v1/hackathons/:id/teams/:teamId/join     auth join
//	POST   /api/v1/hackathons/:id/teams/:teamId/leave    auth leave
//
// Schema notes (see db/migrations/0001_init.sql lines 434-459):
//   - teams: id, hackathon_id, name, slogan, captain_id, created_at.
//     NO slug, NO updated_at, NO deleted_at. Captain leaving → team
//     hard-deleted (NestJS behavior; ON DELETE CASCADE removes members).
//   - team_members: id, team_id, user_id, role (ENUM 'captain'|'member').
//     NO joined_at, NO deleted_at. UNIQUE(team_id, user_id) prevents
//     duplicate memberships at the DB level (defense in depth — service
//     also pre-checks).
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

// ============ DTOs ============

// TeamDTO is the public shape of a team. Members + submission count are
// hydrated by the service (members via a JOIN query, submission count
// via a separate COUNT).
type TeamDTO struct {
	ID              string          `json:"id"`
	HackathonID     string          `json:"hackathonId"`
	Name            string          `json:"name"`
	Slogan          *string         `json:"slogan,omitempty"`
	CaptainID       string          `json:"captainId"`
	MemberCount     int32           `json:"memberCount"`
	SubmissionCount int32           `json:"submissionCount"`
	Members         []TeamMemberDTO `json:"members"`
	CreatedAt       time.Time       `json:"createdAt"`
}

// TeamMemberDTO is the public shape of a team member row.
type TeamMemberDTO struct {
	ID         string  `json:"id"`
	TeamID     string  `json:"teamId"`
	UserID     string  `json:"userId"`
	Role       string  `json:"role"`
	UserName   string  `json:"userName,omitempty"`
	UserAvatar *string `json:"userAvatar,omitempty"`
}

// ============ Repo wrappers ============

// ListTeamsByHackathon returns all teams for a hackathon (with members +
// submission count).
func (r *Repo) ListTeams(ctx context.Context, hackathonID string, limit int32) ([]db.Team, error) {
	rows, err := r.q.ListTeamsByHackathon(ctx, db.ListTeamsByHackathonParams{
		HackathonID: hackathonID,
		Limit:       limit,
	})
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list teams: %w", err)
	}
	return rows, nil
}

// GetTeam returns one team by id.
func (r *Repo) GetTeam(ctx context.Context, id string) (db.Team, error) {
	t, err := r.q.GetTeamByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Team{}, ErrNotFound
		}
		return db.Team{}, fmt.Errorf("hackathons.repo: get team: %w", err)
	}
	return t, nil
}

// CreateTeamRepoInput is the repo-side payload for inserting a team.
// The caller (service) supplies id + createdAt.
type CreateTeamRepoInput struct {
	HackathonID string
	Name        string
	Slogan      sql.NullString
	CaptainID   string
}

// CreateTeamWithCaptain inserts a team + the captain team_member in a
// single tx. Mirrors NestJS's $transaction block (service.ts:354-372).
func (r *Repo) CreateTeamWithCaptain(ctx context.Context, in CreateTeamRepoInput) (teamID, memberID string, err error) {
	now := time.Now().UTC()
	tx, err := r.conn.BeginTx(ctx, nil)
	if err != nil {
		return "", "", fmt.Errorf("hackathons.repo: begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck
	q := db.New(tx)

	teamID = uuid.NewString()
	if _, err := q.CreateTeam(ctx, db.CreateTeamParams{
		ID:          teamID,
		HackathonID: in.HackathonID,
		Name:        in.Name,
		Slogan:      in.Slogan,
		CaptainID:   in.CaptainID,
		CreatedAt:   now,
	}); err != nil {
		return "", "", fmt.Errorf("hackathons.repo: create team: %w", err)
	}
	memberID = uuid.NewString()
	if _, err := q.CreateTeamMember(ctx, db.CreateTeamMemberParams{
		ID:     memberID,
		TeamID: teamID,
		UserID: in.CaptainID,
		Role:   db.TeamMembersRoleCaptain,
	}); err != nil {
		return "", "", fmt.Errorf("hackathons.repo: create captain member: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return "", "", fmt.Errorf("hackathons.repo: commit create team: %w", err)
	}
	return teamID, memberID, nil
}

// ListMembers returns the members of a team with user info joined.
func (r *Repo) ListMembers(ctx context.Context, teamID string) ([]db.ListTeamMembersByTeamRow, error) {
	rows, err := r.q.ListTeamMembersByTeam(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("hackathons.repo: list members: %w", err)
	}
	return rows, nil
}

// CountMembers returns the member count for a team.
func (r *Repo) CountMembers(ctx context.Context, teamID string) (int64, error) {
	return r.q.CountTeamMembers(ctx, teamID)
}

// CountSubmissionsByTeam returns the number of non-deleted submissions
// for a team. Used for the team's submissionCount field.
func (r *Repo) CountSubmissionsByTeam(ctx context.Context, teamID string) (int64, error) {
	var n int64
	err := r.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM submissions WHERE team_id = ? AND deleted_at IS NULL`,
		teamID,
	).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("hackathons.repo: count team submissions: %w", err)
	}
	return n, nil
}

// FindMembershipInHackathon returns the (user, hackathon) membership if
// the user is already a member of any team in this hackathon.
func (r *Repo) FindMembershipInHackathon(ctx context.Context, userID, hackathonID string) (db.TeamMember, error) {
	row, err := r.q.FindTeamMembershipForUserInHackathon(ctx, db.FindTeamMembershipForUserInHackathonParams{
		UserID:      userID,
		HackathonID: hackathonID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.TeamMember{}, ErrNotFound
		}
		return db.TeamMember{}, fmt.Errorf("hackathons.repo: find membership: %w", err)
	}
	return row, nil
}

// GetMembershipForUserAndTeam returns the membership for (user, team) or
// ErrNotFound. Used by leaveTeam to validate + locate the row.
func (r *Repo) GetMembershipForUserAndTeam(ctx context.Context, teamID, userID string) (db.TeamMember, error) {
	row, err := r.q.GetTeamMemberForUserAndTeam(ctx, db.GetTeamMemberForUserAndTeamParams{
		TeamID: teamID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.TeamMember{}, ErrNotFound
		}
		return db.TeamMember{}, fmt.Errorf("hackathons.repo: get membership: %w", err)
	}
	return row, nil
}

// FindTeamByName returns the team id of (hackathon, name) or "" if
// no such team exists. Used for the "duplicate team name" 400.
func (r *Repo) FindTeamByName(ctx context.Context, hackathonID, name string) (string, error) {
	id, err := r.q.FindTeamByHackathonAndName(ctx, db.FindTeamByHackathonAndNameParams{
		HackathonID: hackathonID,
		Name:        name,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("hackathons.repo: find team by name: %w", err)
	}
	return id, nil
}

// AddMemberInput is the payload for adding a team member (joinTeam).
type AddMemberInput struct {
	TeamID string
	UserID string
	Role   string
}

// AddMember inserts a (team, user) member row. Returns the new member id.
func (r *Repo) AddMember(ctx context.Context, in AddMemberInput) (string, error) {
	id := uuid.NewString()
	if _, err := r.q.CreateTeamMember(ctx, db.CreateTeamMemberParams{
		ID:     id,
		TeamID: in.TeamID,
		UserID: in.UserID,
		Role:   db.TeamMembersRole(in.Role),
	}); err != nil {
		return "", fmt.Errorf("hackathons.repo: add member: %w", err)
	}
	return id, nil
}

// DeleteMember hard-deletes a team_member row.
func (r *Repo) DeleteMember(ctx context.Context, memberID string) error {
	_, err := r.q.DeleteTeamMember(ctx, memberID)
	if err != nil {
		return fmt.Errorf("hackathons.repo: delete member: %w", err)
	}
	return nil
}

// DeleteTeam hard-deletes a team. The FK ON DELETE CASCADE removes the
// members. NestJS uses prisma.team.delete for this (captain leaves →
// team disbanded).
func (r *Repo) DeleteTeam(ctx context.Context, teamID string) error {
	_, err := r.q.DeleteTeam(ctx, teamID)
	if err != nil {
		return fmt.Errorf("hackathons.repo: delete team: %w", err)
	}
	return nil
}

// GetTeamHackathonID returns the hackathon_id of a team. Used to
// validate that a team belongs to the URL's hackathon id (e.g. when
// joining, the team's hackathon_id must match the parent path).
func (r *Repo) GetTeamHackathonID(ctx context.Context, teamID string) (string, error) {
	var hID string
	err := r.conn.QueryRowContext(ctx, `SELECT hackathon_id FROM teams WHERE id = ?`, teamID).Scan(&hID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("hackathons.repo: get team hackathon id: %w", err)
	}
	return hID, nil
}

// ============ Service methods ============

// ListTeams returns the public list of teams for a hackathon with
// members + submission count hydrated. Mirrors NestJS getTeams
// (service.ts:318-330).
func (s *Service) ListTeams(ctx context.Context, hackathonID string) ([]TeamDTO, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	rows, err := s.repo.ListTeams(ctx, hackathonID, 100)
	if err != nil {
		return nil, errs.Internal("list teams", err)
	}
	out := make([]TeamDTO, 0, len(rows))
	for _, t := range rows {
		dto, err := s.hydrateTeam(ctx, t)
		if err != nil {
			return nil, errs.Internal("hydrate team", err)
		}
		out = append(out, dto)
	}
	return out, nil
}

// hydrateTeam fills in the member list + counts. Pulled out of ListTeams
// so a future single-team GET can reuse it.
func (s *Service) hydrateTeam(ctx context.Context, t db.Team) (TeamDTO, error) {
	members, err := s.repo.ListMembers(ctx, t.ID)
	if err != nil {
		return TeamDTO{}, err
	}
	subCount, err := s.repo.CountSubmissionsByTeam(ctx, t.ID)
	if err != nil {
		return TeamDTO{}, err
	}
	memberDTOs := make([]TeamMemberDTO, 0, len(members))
	for _, m := range members {
		memberDTOs = append(memberDTOs, dbTeamMemberRowToDTO(m))
	}
	return TeamDTO{
		ID:              t.ID,
		HackathonID:     t.HackathonID,
		Name:            t.Name,
		Slogan:          nullableStringPtr(t.Slogan),
		CaptainID:       t.CaptainID,
		MemberCount:     int32(len(memberDTOs)),
		SubmissionCount: int32(subCount),
		Members:         memberDTOs,
		CreatedAt:       t.CreatedAt.UTC(),
	}, nil
}

// CreateTeamInput is the API-shaped create payload. The service fills in
// the captain_id from the caller.
type CreateTeamInput struct {
	Name   string
	Slogan string
}

// CreateTeam creates a team for the caller. Mirrors NestJS createTeam
// (service.ts:332-373):
//  1. Verify the hackathon exists
//  2. Verify the user is registered (status='registered')
//  3. Reject if a team with the same name already exists in this hackathon
//  4. Reject if the user is already a member of any team in this hackathon
//  5. Insert team + captain membership in a transaction
func (s *Service) CreateTeam(ctx context.Context, userID, hackathonID string, in CreateTeamInput) (TeamDTO, error) {
	if strings.TrimSpace(in.Name) == "" {
		return TeamDTO{}, errs.BadRequest("name is required")
	}
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return TeamDTO{}, errs.NotFound("Hackathon not found")
		}
		return TeamDTO{}, errs.Internal("lookup hackathon", err)
	}
	if err := s.ensureRegistered(ctx, userID, hackathonID); err != nil {
		return TeamDTO{}, err
	}
	if existing, err := s.repo.FindTeamByName(ctx, hackathonID, in.Name); err != nil {
		return TeamDTO{}, errs.Internal("check team name", err)
	} else if existing != "" {
		return TeamDTO{}, errs.BadRequest("该黑客松下已存在同名队伍")
	}
	if _, err := s.repo.FindMembershipInHackathon(ctx, userID, hackathonID); err == nil {
		return TeamDTO{}, errs.BadRequest("你已经加入了一个队伍")
	} else if !errors.Is(err, ErrNotFound) {
		return TeamDTO{}, errs.Internal("check existing membership", err)
	}
	teamID, _, err := s.repo.CreateTeamWithCaptain(ctx, CreateTeamRepoInput{
		HackathonID: hackathonID,
		Name:        in.Name,
		Slogan:      nullableString(in.Slogan),
		CaptainID:   userID,
	})
	if err != nil {
		return TeamDTO{}, errs.Internal("create team", err)
	}
	s.writeAudit(ctx, "HACKATHON_TEAM_CREATE", teamID, hackathonID)
	team, err := s.repo.GetTeam(ctx, teamID)
	if err != nil {
		return TeamDTO{}, errs.Internal("reload team", err)
	}
	return s.hydrateTeam(ctx, team)
}

// JoinTeam adds the caller to a team. Mirrors NestJS joinTeam
// (service.ts:375-402). The user must:
//  1. Be registered for the hackathon
//  2. Not already be a member of any team in this hackathon
//  3. The team must belong to this hackathon (URL validation)
//  4. The team must not be full (members < hackathon.maxTeamSize)
func (s *Service) JoinTeam(ctx context.Context, userID, hackathonID, teamID string) (TeamMemberDTO, error) {
	h, err := s.repo.GetByID(ctx, hackathonID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return TeamMemberDTO{}, errs.NotFound("Hackathon not found")
		}
		return TeamMemberDTO{}, errs.Internal("lookup hackathon", err)
	}
	if err := s.ensureRegistered(ctx, userID, hackathonID); err != nil {
		return TeamMemberDTO{}, err
	}
	teamHackathonID, err := s.repo.GetTeamHackathonID(ctx, teamID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return TeamMemberDTO{}, errs.NotFound("Team not found")
		}
		return TeamMemberDTO{}, errs.Internal("lookup team", err)
	}
	if teamHackathonID != hackathonID {
		return TeamMemberDTO{}, errs.NotFound("Team not found")
	}
	if _, err := s.repo.FindMembershipInHackathon(ctx, userID, hackathonID); err == nil {
		return TeamMemberDTO{}, errs.BadRequest("你已经加入了一个队伍")
	} else if !errors.Is(err, ErrNotFound) {
		return TeamMemberDTO{}, errs.Internal("check existing membership", err)
	}
	memberCount, err := s.repo.CountMembers(ctx, teamID)
	if err != nil {
		return TeamMemberDTO{}, errs.Internal("count team members", err)
	}
	if int32(memberCount) >= h.MaxTeamSize {
		return TeamMemberDTO{}, errs.Forbidden("队伍已满")
	}
	memberID, err := s.repo.AddMember(ctx, AddMemberInput{
		TeamID: teamID,
		UserID: userID,
		Role:   string(db.TeamMembersRoleMember),
	})
	if err != nil {
		return TeamMemberDTO{}, errs.Internal("add member", err)
	}
	s.writeAudit(ctx, "HACKATHON_TEAM_JOIN", teamID, userID)
	return TeamMemberDTO{
		ID:     memberID,
		TeamID: teamID,
		UserID: userID,
		Role:   string(db.TeamMembersRoleMember),
	}, nil
}

// LeaveTeam removes the caller from a team. If the caller is the
// captain, the entire team is disbanded (hard delete). Mirrors NestJS
// leaveTeam (service.ts:404-424).
func (s *Service) LeaveTeam(ctx context.Context, userID, hackathonID, teamID string) (map[string]string, error) {
	if _, err := s.repo.GetByID(ctx, hackathonID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Hackathon not found")
		}
		return nil, errs.Internal("lookup hackathon", err)
	}
	// Validate team belongs to hackathon.
	teamHackathonID, err := s.repo.GetTeamHackathonID(ctx, teamID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.NotFound("Team not found")
		}
		return nil, errs.Internal("lookup team", err)
	}
	if teamHackathonID != hackathonID {
		return nil, errs.NotFound("Team not found")
	}
	membership, err := s.repo.GetMembershipForUserAndTeam(ctx, teamID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errs.BadRequest("你不是该队伍成员")
		}
		return nil, errs.Internal("lookup membership", err)
	}
	if membership.Role == db.TeamMembersRoleCaptain {
		if err := s.repo.DeleteTeam(ctx, teamID); err != nil {
			return nil, errs.Internal("disband team", err)
		}
		s.writeAudit(ctx, "HACKATHON_TEAM_DISBAND", teamID, hackathonID)
		return map[string]string{"message": "Team disbanded"}, nil
	}
	if err := s.repo.DeleteMember(ctx, membership.ID); err != nil {
		return nil, errs.Internal("leave team", err)
	}
	s.writeAudit(ctx, "HACKATHON_TEAM_LEAVE", teamID, userID)
	return map[string]string{"message": "Left team"}, nil
}

// ensureRegistered checks that the user has an active registration for
// the hackathon. Mirrors the NestJS ensureRegistered helper
// (service.ts:560-567).
func (s *Service) ensureRegistered(ctx context.Context, userID, hackathonID string) error {
	reg, err := s.repo.GetRegistration(ctx, hackathonID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.Forbidden("请先报名该黑客松")
		}
		return errs.Internal("check registration", err)
	}
	if reg.Status != db.HackathonRegistrationsStatusRegistered {
		return errs.Forbidden("请先报名该黑客松")
	}
	return nil
}

// dbTeamMemberRowToDTO maps a sqlc ListTeamMembersByTeamRow to a DTO.
func dbTeamMemberRowToDTO(m db.ListTeamMembersByTeamRow) TeamMemberDTO {
	return TeamMemberDTO{
		ID:         m.TmID,
		TeamID:     m.TmTeamID,
		UserID:     m.TmUserID,
		Role:       string(m.TmRole),
		UserName:   m.UserName,
		UserAvatar: nullableStringPtr(m.UserAvatarUrl),
	}
}
