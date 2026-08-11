-- name: ListHackathons :many
-- Public list. The hackathons table has NO deleted_at column; soft-delete
-- is encoded as status='cancelled' (see SoftDeleteHackathon below).
-- statusFilter: when non-empty, applied at SQL level. When empty, all rows
-- are returned and the service layer applies date-based effectiveStatus
-- inference (mirrors NestJS findAll).
SELECT * FROM hackathons
WHERE (? = '' OR status = ?)
  AND (
    ? = ''
    OR title LIKE ?
    OR description LIKE ?
    OR location LIKE ?
  )
ORDER BY start_date DESC
LIMIT ?;

-- name: ListHackathonResponseRows :many
-- API list projection in one round-trip: organizer, all aggregate counts and
-- the optional caller registration. The service still computes effectiveStatus.
SELECT
  h.id, h.title, h.description, h.banner_url, h.status, h.start_date, h.end_date,
  h.register_deadline, h.submission_deadline, h.max_team_size, h.min_team_size,
  h.location, h.rules, h.submission_requirements, h.prizes, h.registration_url,
  h.registration_label, h.organizer_id, h.created_at, h.updated_at,
  ou.id AS organizer_user_id, ou.name AS organizer_name, ou.avatar_url AS organizer_avatar_url,
  (SELECT COUNT(*) FROM hackathon_registrations hr
    WHERE hr.hackathon_id = h.id AND hr.status = 'registered' AND hr.deleted_at IS NULL) AS registration_count,
  (SELECT COUNT(*) FROM teams t WHERE t.hackathon_id = h.id) AS team_count,
  (SELECT COUNT(*) FROM submissions s WHERE s.hackathon_id = h.id AND s.deleted_at IS NULL) AS submission_count,
  mr.id AS my_registration_id, mr.user_id AS my_registration_user_id,
  mr.status AS my_registration_status, mr.registered_at AS my_registration_registered_at,
  mr.checked_in_at AS my_registration_checked_in_at
FROM hackathons h
LEFT JOIN users ou ON ou.id = h.organizer_id
LEFT JOIN hackathon_registrations mr ON mr.hackathon_id = h.id AND mr.user_id = sqlc.arg(user_id)
WHERE (
    sqlc.arg(search) = ''
    OR h.title LIKE CONCAT('%', sqlc.arg(search), '%')
    OR h.description LIKE CONCAT('%', sqlc.arg(search), '%')
    OR h.location LIKE CONCAT('%', sqlc.arg(search), '%')
  )
ORDER BY h.start_date DESC
LIMIT ?;

-- name: GetHackathonByID :one
-- The hackathons table has NO deleted_at column. The cancelled status
-- is a real state, not a tombstone — see effectiveStatus in service.
SELECT * FROM hackathons WHERE id = ?;

-- name: GetHackathonResponseRow :one
SELECT
  h.id, h.title, h.description, h.banner_url, h.status, h.start_date, h.end_date,
  h.register_deadline, h.submission_deadline, h.max_team_size, h.min_team_size,
  h.location, h.rules, h.submission_requirements, h.prizes, h.registration_url,
  h.registration_label, h.organizer_id, h.created_at, h.updated_at,
  ou.id AS organizer_user_id, ou.name AS organizer_name, ou.avatar_url AS organizer_avatar_url,
  (SELECT COUNT(*) FROM hackathon_registrations hr
    WHERE hr.hackathon_id = h.id AND hr.status = 'registered' AND hr.deleted_at IS NULL) AS registration_count,
  (SELECT COUNT(*) FROM teams t WHERE t.hackathon_id = h.id) AS team_count,
  (SELECT COUNT(*) FROM submissions s WHERE s.hackathon_id = h.id AND s.deleted_at IS NULL) AS submission_count,
  mr.id AS my_registration_id, mr.user_id AS my_registration_user_id,
  mr.status AS my_registration_status, mr.registered_at AS my_registration_registered_at,
  mr.checked_in_at AS my_registration_checked_in_at
FROM hackathons h
LEFT JOIN users ou ON ou.id = h.organizer_id
LEFT JOIN hackathon_registrations mr ON mr.hackathon_id = h.id AND mr.user_id = sqlc.arg(user_id)
WHERE h.id = sqlc.arg(id);

-- name: CreateHackathon :execresult
INSERT INTO hackathons
  (id, title, description, banner_url, status, start_date, end_date, register_deadline, submission_deadline, max_team_size, min_team_size, location, rules, submission_requirements, prizes, registration_url, registration_label, organizer_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateHackathon :execrows
-- The hackathons table has NO deleted_at column.
UPDATE hackathons
SET title = ?, description = ?, status = ?, start_date = ?, end_date = ?,
    register_deadline = ?, submission_deadline = ?, max_team_size = ?, min_team_size = ?,
    banner_url = ?, location = ?, rules = ?, submission_requirements = ?, prizes = ?,
    registration_url = ?, registration_label = ?, organizer_id = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteHackathon :execrows
-- Hard delete. The schema has no deleted_at column, so soft-delete is
-- encoded as status='cancelled' via SoftDeleteHackathon.
DELETE FROM hackathons WHERE id = ?;

-- name: SoftDeleteHackathon :execrows
-- Mark as cancelled (the hackathons table's notion of "soft delete"
-- since there is no deleted_at column). Idempotent.
UPDATE hackathons SET status = 'cancelled', updated_at = ? WHERE id = ?;

-- name: GetRegistration :one
-- hackathon_registrations HAS a deleted_at column, so this filter is valid.
SELECT id, hackathon_id, user_id, status, registered_at, checked_in_at
FROM hackathon_registrations
WHERE hackathon_id = ? AND user_id = ? AND deleted_at IS NULL;

-- name: GetRegistrationIncludingCancelled :one
-- For my-registration endpoint: return the row even if status='cancelled'
-- so the client can render the "you cancelled" state.
SELECT id, hackathon_id, user_id, status, registered_at, checked_in_at
FROM hackathon_registrations
WHERE hackathon_id = ? AND user_id = ?;

-- name: UpsertRegistration :execresult
-- Idempotent: re-registration of a previously-cancelled user re-activates
-- (status='registered', deleted_at=NULL).
INSERT INTO hackathon_registrations
  (id, hackathon_id, user_id, status, registered_at)
VALUES (?, ?, ?, 'registered', ?)
ON DUPLICATE KEY UPDATE status = 'registered', deleted_at = NULL;

-- name: CancelRegistration :execrows
UPDATE hackathon_registrations
SET status = 'cancelled', deleted_at = ?
WHERE hackathon_id = ? AND user_id = ? AND deleted_at IS NULL;

-- name: CountRegistrationsByHackathon :one
SELECT COUNT(*) FROM hackathon_registrations
WHERE hackathon_id = ? AND status = 'registered' AND deleted_at IS NULL;

-- name: ListAnnouncements :many
-- announcements has no updated_at column (see schema).
SELECT id, hackathon_id, title, content, is_pinned, created_at
FROM announcements
WHERE hackathon_id = ?
ORDER BY is_pinned DESC, created_at DESC
LIMIT ?;

-- name: CreateAnnouncement :execresult
INSERT INTO announcements (id, hackathon_id, title, content, is_pinned, created_at)
VALUES (?, ?, ?, ?, ?, ?);

-- ============================================================================
-- T19.1 — Teams / TeamMembers / Submissions / Judges / Sponsors
-- Schema caveats (verified against db/migrations/0001_init.sql):
--   - teams: NO slug, NO updated_at, NO deleted_at. columns: id, hackathon_id,
--     name, slogan, captain_id, created_at.
--   - team_members: NO joined_at, NO deleted_at. columns: id, team_id, user_id,
--     role (ENUM 'captain'|'member').
--   - submissions: HAS deleted_at (soft delete). columns: ..., demo_url,
--     repo_url, video_url, status, score, feedback, submitted_at, ...
--   - judges: NO created_at, NO updated_at, NO deleted_at. columns: id,
--     hackathon_id, user_id, name, title, avatar_url, bio, order_index, role.
--   - sponsors: NO deleted_at. columns: id, hackathon_id, name, logo_url,
--     website_url, tier, order_index, created_at, updated_at.
-- ============================================================================

-- ==================== Teams ====================

-- name: GetTeamByID :one
-- Returns a team by primary key. Used for owner-checks + lookups.
SELECT * FROM teams WHERE id = ?;

-- name: ListTeamsByHackathon :many
-- Public list. NestJS includes members + submission count, but the Go
-- port uses a second query (ListTeamMembersByTeam + submission count) so
-- the team row is hydrated in the service layer.
SELECT * FROM teams
WHERE hackathon_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: CountTeamsByHackathon :one
SELECT COUNT(*) FROM teams WHERE hackathon_id = ?;

-- name: FindTeamByHackathonAndName :one
-- Service uses this for the "name already exists in this hackathon" 400.
SELECT id FROM teams WHERE hackathon_id = ? AND name = ? LIMIT 1;

-- name: CountTeamMembers :one
-- Submission count placeholder — NestJS uses _count.submissions. The
-- Go port just calls this + a small SQL aggregate for the count.
SELECT COUNT(*) FROM team_members WHERE team_id = ?;

-- name: CreateTeam :execresult
-- teams has NO updated_at / deleted_at; only created_at. Caller supplies id.
INSERT INTO teams (id, hackathon_id, name, slogan, captain_id, created_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: DeleteTeam :execrows
-- Hard delete. NestJS uses prisma.team.delete (CASCADE removes members
-- + submissions via FK ON DELETE CASCADE). No soft delete column.
DELETE FROM teams WHERE id = ?;

-- ==================== TeamMembers ====================

-- name: GetTeamMemberByID :one
SELECT * FROM team_members WHERE id = ?;

-- name: ListTeamMembersByTeam :many
-- Includes user name + avatar via JOIN. The frontend can render the
-- team roster without a second roundtrip.
SELECT
  tm.id           AS tm_id,
  tm.team_id      AS tm_team_id,
  tm.user_id      AS tm_user_id,
  tm.role         AS tm_role,
  u.id            AS user_id,
  u.name          AS user_name,
  u.avatar_url    AS user_avatar_url
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = ?
ORDER BY (tm.role = 'captain') DESC, tm.id ASC;

-- name: FindTeamMembershipForUserInHackathon :one
-- Used by joinTeam/createTeam to enforce "you can only be in one team
-- per hackathon" — the unique index on (team_id, user_id) doesn't
-- span hackathons, so this query joins teams.
SELECT tm.id, tm.team_id, tm.user_id, tm.role
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = ? AND t.hackathon_id = ?
LIMIT 1;

-- name: GetTeamMemberForUserAndTeam :one
-- Used by leaveTeam to find the (team, user) membership.
SELECT * FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1;

-- name: CreateTeamMember :execresult
-- Inserts a team_member row. UNIQUE(team_id, user_id) enforces no dupes.
INSERT INTO team_members (id, team_id, user_id, role)
VALUES (?, ?, ?, ?);

-- name: DeleteTeamMember :execrows
DELETE FROM team_members WHERE id = ?;

-- ==================== Submissions ====================

-- name: GetSubmissionByID :one
-- submissions has deleted_at; we filter it here so a soft-deleted row
-- can't be referenced by id (matches NestJS findFirst behavior).
SELECT * FROM submissions WHERE id = ? AND deleted_at IS NULL;

-- name: GetSubmissionIncludingDeleted :one
-- Admin / audit path: returns the row even if soft-deleted.
SELECT * FROM submissions WHERE id = ?;

-- name: ListSubmissionsByHackathon :many
-- Admin's "all submissions" view. No user/team filter.
SELECT * FROM submissions
WHERE hackathon_id = ? AND deleted_at IS NULL
ORDER BY status ASC, created_at DESC
LIMIT ?;

-- name: ListMySubmissions :many
-- "My submissions" — owned by user OR by a team the user is a member of.
-- Uses OR-clause in SQL. (NestJS does the same via Prisma's
-- `OR: [{ userId }, { team: { members: { some: { userId } } } }]`.)
-- The two `?` slots that hold the user id are positionally identical at
-- runtime; sqlc names them UserID + UserID_2 in the generated params.
SELECT s.* FROM submissions s
LEFT JOIN team_members tm ON tm.team_id = s.team_id AND tm.user_id = ?
WHERE s.hackathon_id = ?
  AND s.deleted_at IS NULL
  AND (s.user_id = ? OR tm.id IS NOT NULL)
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT ?;

-- name: CreateSubmission :execresult
-- submissions HAS updated_at. We set it on insert for consistency with
-- the UPDATE path (NestJS also sets both on create).
INSERT INTO submissions
  (id, hackathon_id, team_id, user_id, title, description, demo_url, repo_url,
   video_url, status, score, feedback, submitted_at, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);

-- name: UpdateSubmission :exec
-- Partial update. Service reads the row first and passes the merged
-- patch + the resolved submittedAt timestamp.
UPDATE submissions
SET title = ?, description = ?, demo_url = ?, repo_url = ?, video_url = ?,
    status = ?, score = ?, feedback = ?, submitted_at = ?, updated_at = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: SoftDeleteSubmission :execrows
-- Sets deleted_at to soft-delete. (Not in NestJS for submissions, but
-- the column is in the schema, so we support it for the API surface
-- parity. NestJS uses prisma.submission.delete() — we follow the
-- schema instead and soft-delete by default; tests assert this.)
UPDATE submissions SET deleted_at = ?, updated_at = ? WHERE id = ?;

-- ==================== Judges ====================

-- name: GetJudgeByID :one
-- judges has NO deleted_at. Direct lookup.
SELECT * FROM judges WHERE id = ?;

-- name: ListJudgesByHackathon :many
-- Public list, ordered by orderIndex ASC (NestJS parity).
SELECT * FROM judges
WHERE hackathon_id = ?
ORDER BY order_index ASC, name ASC
LIMIT ?;

-- name: CreateJudge :execresult
-- judges has NO created_at/updated_at. Just the static columns.
INSERT INTO judges (id, hackathon_id, user_id, name, title, avatar_url, bio, order_index, role)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateJudge :exec
UPDATE judges
SET user_id = ?, name = ?, title = ?, avatar_url = ?, bio = ?, order_index = ?, role = ?
WHERE id = ?;

-- name: DeleteJudge :execrows
-- Hard delete. NestJS uses prisma.judge.delete.
DELETE FROM judges WHERE id = ?;

-- ==================== Sponsors ====================

-- name: GetSponsorByID :one
SELECT * FROM sponsors WHERE id = ?;

-- name: ListSponsorsByHackathon :many
-- Public list, ordered by tier ASC, orderIndex ASC (NestJS parity).
SELECT * FROM sponsors
WHERE hackathon_id = ?
ORDER BY tier ASC, order_index ASC, name ASC
LIMIT ?;

-- name: CreateSponsor :execresult
-- sponsors has created_at + updated_at. Both are set on insert.
INSERT INTO sponsors (id, hackathon_id, name, logo_url, website_url, tier, order_index, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateSponsor :exec
UPDATE sponsors
SET name = ?, logo_url = ?, website_url = ?, tier = ?, order_index = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteSponsor :execrows
-- Hard delete. NestJS uses prisma.sponsor.delete.
DELETE FROM sponsors WHERE id = ?;
