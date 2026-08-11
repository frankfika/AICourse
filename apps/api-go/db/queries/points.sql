-- name: GetUserPoints :one
-- Returns the user's points + level. Returns no rows if the user doesn't exist.
SELECT points, level FROM users
WHERE id = ? AND deleted_at IS NULL;

-- name: ListRecentPointTransactions :many
-- The user's most recent non-deleted point transactions, newest first.
SELECT * FROM point_transactions
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ?;
