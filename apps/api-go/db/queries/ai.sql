-- ============================================================================
-- AI config queries (T21).
--
-- Two distinct tables:
--   ai_configs                 — admin-global provider configs (no user_id)
--   user_ai_provider_configs   — per-user overrides
--
-- Field notes:
--   api_key_enc: ciphertext (AES-256-GCM). The Go layer encrypts on write
--                and decrypts on read for masking. List/upsert endpoints
--                only ever return the masked form.
--   base_url: nullable for the official gemini/openai/claude providers
--             that have a fixed endpoint. Required for openai-compatible
--             and ollama.
-- ============================================================================

-- name: ListAiConfigs :many
SELECT id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at
FROM ai_configs
ORDER BY provider ASC;

-- name: GetAiConfigByProvider :one
SELECT id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at
FROM ai_configs
WHERE provider = ?;

-- name: CreateAiConfig :execresult
INSERT INTO ai_configs (id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateAiConfig :exec
UPDATE ai_configs
SET api_key_enc = ?,
    model       = ?,
    base_url    = ?,
    is_active   = ?,
    updated_at  = ?
WHERE provider = ?;

-- name: DeleteAiConfig :execrows
DELETE FROM ai_configs WHERE provider = ?;

-- name: CountAiConfigs :one
SELECT COUNT(*) FROM ai_configs;

-- ============================================================================
-- user_ai_provider_configs
-- ============================================================================

-- name: ListUserAiConfigs :many
SELECT id, user_id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at
FROM user_ai_provider_configs
WHERE user_id = ?
ORDER BY provider ASC;

-- name: GetUserAiConfig :one
SELECT id, user_id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at
FROM user_ai_provider_configs
WHERE user_id = ? AND provider = ?;

-- name: CreateUserAiConfig :execresult
INSERT INTO user_ai_provider_configs (id, user_id, provider, api_key_enc, model, base_url, is_active, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateUserAiConfig :exec
UPDATE user_ai_provider_configs
SET api_key_enc = ?,
    model       = ?,
    base_url    = ?,
    is_active   = ?,
    updated_at  = ?
WHERE user_id = ? AND provider = ?;

-- name: DeleteUserAiConfig :execrows
DELETE FROM user_ai_provider_configs WHERE user_id = ? AND provider = ?;

-- name: CountUserAiConfigs :one
SELECT COUNT(*) FROM user_ai_provider_configs WHERE user_id = ?;
