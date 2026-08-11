-- name: ListActiveBadges :many
-- Public list — only active badges, sorted by category + order.
-- IFNULL(criteria_json, ...) returns an empty JSON object instead of
-- NULL so the *json.RawMessage scan target doesn't fail.
SELECT id, code, name, description, icon, category, criteria_type,
       criteria_value, IFNULL(criteria_json, JSON_OBJECT()) AS criteria_json,
       points, is_active, order_index, created_at, updated_at
FROM badges WHERE is_active = 1
ORDER BY category ASC, order_index ASC, created_at ASC;

-- name: GetBadgeByID :one
SELECT id, code, name, description, icon, category, criteria_type,
       criteria_value, IFNULL(criteria_json, JSON_OBJECT()) AS criteria_json,
       points, is_active, order_index, created_at, updated_at
FROM badges WHERE id = ?;

-- name: GetBadgeByCode :one
SELECT id, code, name, description, icon, category, criteria_type,
       criteria_value, IFNULL(criteria_json, JSON_OBJECT()) AS criteria_json,
       points, is_active, order_index, created_at, updated_at
FROM badges WHERE code = ?;

-- name: CreateBadge :execresult
INSERT INTO badges (id, code, name, description, icon, category, criteria_type, criteria_value, criteria_json, points, is_active, order_index, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateBadge :exec
UPDATE badges
SET code = ?, name = ?, description = ?, icon = ?, category = ?,
    criteria_type = ?, criteria_value = ?, criteria_json = ?, points = ?,
    is_active = ?, order_index = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteBadge :exec
DELETE FROM badges WHERE id = ?;

-- name: ListAllBadges :many
-- Admin list — includes inactive badges.
SELECT id, code, name, description, icon, category, criteria_type,
       criteria_value, IFNULL(criteria_json, JSON_OBJECT()) AS criteria_json,
       points, is_active, order_index, created_at, updated_at
FROM badges
ORDER BY category ASC, order_index ASC, created_at ASC;

-- name: ListUserBadges :many
SELECT id, user_id, badge_id, unlocked_at FROM user_badges WHERE user_id = ?;

-- name: GetUserBadge :one
-- Used by checkAndAward to detect duplicates (unique key on user_id+badge_id).
SELECT id, user_id, badge_id, unlocked_at FROM user_badges WHERE user_id = ? AND badge_id = ?;

-- name: CreateUserBadge :execresult
INSERT INTO user_badges (id, user_id, badge_id, unlocked_at)
VALUES (?, ?, ?, ?);

-- name: CountUserBadges :one
SELECT COUNT(*) FROM user_badges;

-- name: CountBadgeDistribution :many
SELECT badge_id, COUNT(*) AS cnt FROM user_badges GROUP BY badge_id ORDER BY cnt DESC;
