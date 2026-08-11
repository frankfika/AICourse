-- name: ListNotificationsByUser :many
-- User's notifications, newest first. Excludes soft-deleted.
SELECT * FROM notifications
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ?;

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL;

-- name: MarkNotificationRead :exec
UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications SET is_read = 1, read_at = ?
WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL;

-- name: SoftDeleteNotification :exec
UPDATE notifications SET deleted_at = ? WHERE id = ? AND user_id = ?;

-- name: ClearReadNotifications :exec
-- Bulk soft-delete: delete all read notifications.
UPDATE notifications SET deleted_at = ?
WHERE user_id = ? AND is_read = 1 AND deleted_at IS NULL;

-- name: CreateNotification :execresult
INSERT INTO notifications
  (id, user_id, type, title, body, link_url, is_read, read_at, deleted_at, created_at)
VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?);
