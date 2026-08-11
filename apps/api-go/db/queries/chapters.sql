-- name: ListChaptersByCourse :many
-- All non-deleted chapters for a course, ordered by orderIndex ASC.
SELECT id, course_id, title, description, order_index, created_at, deleted_at
FROM chapters
WHERE course_id = ? AND deleted_at IS NULL
ORDER BY order_index ASC;

-- name: GetChapterByID :one
-- Look up a chapter by primary key. Filters out soft-deleted.
SELECT id, course_id, title, description, order_index, created_at, deleted_at
FROM chapters
WHERE id = ? AND deleted_at IS NULL;

-- name: GetChapterByIDIncludingDeleted :one
-- Admin / internal: returns the chapter regardless of deleted_at.
SELECT id, course_id, title, description, order_index, created_at, deleted_at
FROM chapters
WHERE id = ?;

-- name: CreateChapter :execresult
-- Inserts a new chapter. Caller supplies id (uuid).
INSERT INTO chapters (id, course_id, title, description, order_index, created_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateChapter :exec
-- Partial update. Caller shapes the patch (UpdateChapterPatch).
UPDATE chapters
SET title = ?, description = ?, order_index = ?
WHERE id = ?;

-- name: SoftDeleteChapter :exec
-- Soft-delete a single chapter. Idempotent.
UPDATE chapters
SET deleted_at = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: SoftDeleteChaptersByCourse :execrows
-- Bulk soft-delete all chapters of a course. Returns count (used by
-- ChapterService.Delete to cascade to lessons).
UPDATE chapters
SET deleted_at = ?
WHERE course_id = ? AND deleted_at IS NULL;

-- name: MaxChapterOrderIndex :one
-- For Create: figure out the next orderIndex. COALESCE(-1) so the
-- first chapter gets 0.
SELECT COALESCE(MAX(order_index), -1) AS max_idx
FROM chapters WHERE course_id = ? AND deleted_at IS NULL;

-- name: CountChaptersInCourse :one
-- Sanity check / count.
SELECT COUNT(*) AS count FROM chapters WHERE course_id = ? AND deleted_at IS NULL;

-- name: ChaptersByIDs :many
-- Used by reorder to fetch ownership in one query. Returns each
-- chapter's id and course_id so the service can verify all belong to
-- the same course (NestJS does the same in chapters.controller.ts:163-178).
SELECT id, course_id FROM chapters WHERE id IN (sqlc.slice('ids'));
