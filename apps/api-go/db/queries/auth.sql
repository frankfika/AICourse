-- name: CreateRefreshToken :execresult
-- Stores a refresh token. Caller supplies the opaque token value.
INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at)
VALUES (?, ?, ?, ?, ?);

-- name: GetRefreshToken :one
-- Looks up a refresh token by its raw value. Used on /auth/refresh.
SELECT id, token, user_id, expires_at, created_at
FROM refresh_tokens
WHERE token = ?;

-- name: DeleteRefreshToken :exec
-- Revoke a single refresh token (rotation / logout).
DELETE FROM refresh_tokens
WHERE id = ?;

-- name: DeleteRefreshTokenByToken :execrows
-- Atomic consume a refresh token by its hashed value. Returns the number of
-- rows deleted (0 = token was already consumed / rotated / never existed;
-- 1 = this call consumed it). Used by /auth/refresh for race-free rotation.
DELETE FROM refresh_tokens
WHERE token = ? AND expires_at >= ?;

-- name: RevokeAllRefreshTokensForUser :exec
-- Cascade revoke: wipe every refresh token for a given user. Used for
-- reuse detection (replay of a rotated token) and password-reset
-- "log out everywhere" semantics. T7 deliverable.
DELETE FROM refresh_tokens
WHERE user_id = ?;

-- name: CountActiveRefreshTokensForUser :one
-- Diagnostics / test helper: how many non-expired refresh tokens does a
-- user currently hold? Used by the e2e reuse-detection test.
SELECT COUNT(*) AS count
FROM refresh_tokens
WHERE user_id = ? AND expires_at >= ?;

-- name: DeleteExpiredRefreshTokens :exec
-- Periodic janitor. Wipes all tokens whose expires_at is in the past.
DELETE FROM refresh_tokens
WHERE expires_at < ?;

-- name: CreatePasswordResetToken :execresult
-- Stores a password-reset token (hashed, CHAR(64)).
INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
VALUES (?, ?, ?, ?, ?);

-- name: GetPasswordResetToken :one
-- Look up by the hashed token. Service compares the hash of the submitted value.
SELECT id, user_id, token_hash, expires_at, used_at, created_at
FROM password_reset_tokens
WHERE token_hash = ?;

-- name: MarkPasswordResetTokenUsed :exec
-- Once the user has reset their password, mark the token consumed.
UPDATE password_reset_tokens
SET used_at = ?
WHERE id = ?;

-- name: CreateProviderAccount :execresult
-- Binds a new auth provider to a user (email_password / oauth.google / sso.saml).
INSERT INTO user_provider_accounts (
  id, user_id, provider, provider_user_id,
  email, display_name, is_primary, linked_at, last_used_at, deleted_at,
  profile, created_at, updated_at
) VALUES (
  ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?
);

-- name: GetProviderAccountByProvider :one
-- OAuth/SAML callback flow: look up (provider, providerUserId).
SELECT id, user_id, provider, provider_user_id,
       email, display_name, is_primary, linked_at, last_used_at, deleted_at,
       profile, created_at, updated_at
FROM user_provider_accounts
WHERE provider = ? AND provider_user_id = ? AND deleted_at IS NULL;

-- name: ListProviderAccountsByUser :many
-- User's BindingsPage.
SELECT id, user_id, provider, provider_user_id,
       email, display_name, is_primary, linked_at, last_used_at, deleted_at,
       profile, created_at, updated_at
FROM user_provider_accounts
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY is_primary DESC, linked_at ASC;

-- name: GetProviderAccountByID :one
-- Look up a specific provider binding by id. Used by the unlink endpoint
-- to verify ownership and read is_primary for the last-primary guard.
SELECT id, user_id, provider, provider_user_id,
       email, display_name, is_primary, linked_at, last_used_at, deleted_at,
       profile, created_at, updated_at
FROM user_provider_accounts
WHERE id = ?;

-- name: SoftDeleteProviderAccount :exec
-- Unlink a provider from a user. Soft delete keeps the audit trail
-- (P2 redesign: don't hard-delete bindings, in case a user re-binds and
-- we want to see history).
UPDATE user_provider_accounts
SET deleted_at = ?, updated_at = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: CountActivePrimaryProviders :one
-- Last-primary guard for the unlink endpoint: at least one active primary
-- provider must remain for a user (typically their email_password binding).
-- Phase 2 T11: don't allow unlinking the last primary.
SELECT COUNT(*) AS count
FROM user_provider_accounts
WHERE user_id = ? AND is_primary = 1 AND deleted_at IS NULL;


-- name: UnlinkProviderAccount :execrows
UPDATE user_provider_accounts SET deleted_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL;

-- name: CountUserProviderAccounts :one
-- Used to refuse unlinking the last provider for a user.
SELECT COUNT(*) AS count FROM user_provider_accounts
WHERE user_id = ? AND deleted_at IS NULL;
