-- name: GetUserByID :one
-- Retrieves a single user by primary key. Returns ErrNoRows if not found.
SELECT id, email, password_hash, name, role, avatar_url, password_reset_required,
       points, level, deleted_at, created_at, updated_at, last_login_at
FROM users
WHERE id = ?;

-- name: GetUserByEmail :one
-- Used by login flow to look up a user by email.
SELECT id, email, password_hash, name, role, avatar_url, password_reset_required,
       points, level, deleted_at, created_at, updated_at, last_login_at
FROM users
WHERE email = ? AND deleted_at IS NULL;

-- name: ListActiveUsers :many
-- Returns active (non-deleted) users, newest first. Paged.
SELECT id, email, password_hash, name, role, avatar_url, password_reset_required,
       points, level, deleted_at, created_at, updated_at, last_login_at
FROM users
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: CreateUser :execresult
-- Inserts a new user. Caller is responsible for generating the UUID.
INSERT INTO users (
  id, email, password_hash, name, role, avatar_url, password_reset_required,
  points, level, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?
);

-- name: UpdateUserLastLogin :exec
-- Bumps last_login_at on successful authentication.
UPDATE users
SET last_login_at = ?, updated_at = ?
WHERE id = ?;

-- name: SoftDeleteUser :exec
-- Admin ban / user self-delete goes through deleted_at (see schema.prisma line 21-22).
-- Never prisma.user.delete — 17 FK cascades would orphan certificates / points / reviews / progress.
UPDATE users
SET deleted_at = ?, updated_at = ?
WHERE id = ?;

-- name: UpdateUser :exec
-- Partial update: name, avatar_url, role. Caller decides which fields to
-- change and passes the right sql.Null* values. updated_at always bumps.
UPDATE users
SET name = ?, avatar_url = ?, role = ?, updated_at = ?
WHERE id = ?;

-- name: UpdateUserPassword :exec
-- Change password (current user flow) and reset password (admin flow).
-- Both write the same columns; the difference is whether the caller also
-- flips password_reset_required. Service layer is responsible for that flag.
UPDATE users
SET password_hash = ?, password_reset_required = ?, updated_at = ?
WHERE id = ?;

-- name: RestoreUser :exec
-- Re-activate a soft-deleted account. Sets deleted_at = NULL. The user
-- must already exist (callers verify with GetUserByID first).
UPDATE users
SET deleted_at = NULL, updated_at = ?
WHERE id = ?;

-- name: CountActiveAdmins :one
-- Last-admin guard for the disable endpoint. Counts non-deleted admins.
-- Phase 2 T11: "不能停用最后一个管理员账号" rule.
SELECT COUNT(*) AS count
FROM users
WHERE role = 'admin' AND deleted_at IS NULL;
