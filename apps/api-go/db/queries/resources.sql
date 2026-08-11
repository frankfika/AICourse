-- name: ListResourcesByLesson :many
SELECT id, lesson_id, title, url, type, is_locked, created_at, deleted_at
FROM resources
WHERE lesson_id = ? AND deleted_at IS NULL
ORDER BY created_at ASC;

-- name: GetResourceByID :one
SELECT id, lesson_id, title, url, type, is_locked, created_at, deleted_at
FROM resources
WHERE id = ? AND deleted_at IS NULL;

-- name: CreateResource :execresult
INSERT INTO resources (id, lesson_id, title, url, type, is_locked, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateResource :exec
UPDATE resources
SET title = ?, url = ?, type = ?, is_locked = ?
WHERE id = ?;

-- name: SoftDeleteResource :exec
UPDATE resources
SET deleted_at = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: SoftDeleteResourcesByLesson :execrows
-- Cascade soft-delete for lesson delete. Returns count.
UPDATE resources
SET deleted_at = ?
WHERE lesson_id = ? AND deleted_at IS NULL;

-- name: ResourcesByIDs :many
-- Used by future reorder to verify ownership (lessonId).
SELECT id, lesson_id FROM resources WHERE id IN (sqlc.slice('ids'));
