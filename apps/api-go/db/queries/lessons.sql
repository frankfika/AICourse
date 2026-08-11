-- name: ListLessonsByChapter :many
SELECT id, chapter_id, title, description, video_url, video_duration,
       order_index, is_preview, created_at, deleted_at
FROM lessons
WHERE chapter_id = ? AND deleted_at IS NULL
ORDER BY order_index ASC;

-- name: GetLessonByID :one
SELECT id, chapter_id, title, description, video_url, video_duration,
       order_index, is_preview, created_at, deleted_at
FROM lessons
WHERE id = ? AND deleted_at IS NULL;

-- name: CreateLesson :execresult
INSERT INTO lessons
  (id, chapter_id, title, description, video_url, video_duration, order_index, is_preview, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateLesson :exec
-- Partial update — caller shapes the patch (UpdateLessonPatch).
UPDATE lessons
SET title = ?, description = ?, video_url = ?, video_duration = ?,
    order_index = ?, is_preview = ?
WHERE id = ?;

-- name: SoftDeleteLesson :exec
UPDATE lessons
SET deleted_at = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: SoftDeleteLessonsByChapter :execrows
-- Cascade soft-delete for chapter delete. Returns count.
UPDATE lessons
SET deleted_at = ?
WHERE chapter_id = ? AND deleted_at IS NULL;

-- name: MaxLessonOrderIndex :one
SELECT COALESCE(MAX(order_index), -1) AS max_idx
FROM lessons WHERE chapter_id = ? AND deleted_at IS NULL;

-- name: LessonsByIDs :many
-- Used by reorder to fetch ownership (chapterId) for each lesson.
SELECT id, chapter_id FROM lessons WHERE id IN (sqlc.slice('ids'));
