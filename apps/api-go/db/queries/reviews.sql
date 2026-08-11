-- name: ListReviewsByCourse :many
-- Public list of reviews for a course, newest first. Excludes
-- soft-deleted (deleted_at IS NOT NULL).
SELECT * FROM reviews
WHERE course_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ?;

-- name: GetReviewByID :one
SELECT * FROM reviews WHERE id = ?;

-- name: GetReviewByUserCourse :one
-- Idempotency: one review per (user, course).
SELECT * FROM reviews WHERE user_id = ? AND course_id = ?;

-- name: CreateReview :execresult
INSERT INTO reviews
  (id, user_id, course_id, rating, content, helpful, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, 0, ?, ?);

-- name: IncrementReviewHelpful :exec
UPDATE reviews SET helpful = helpful + 1, updated_at = ? WHERE id = ?;

-- name: SoftDeleteReview :exec
UPDATE reviews SET deleted_at = ?, updated_at = ? WHERE id = ?;

-- name: ListAllReviews :many
-- Admin: full list with optional filters. Soft-delete aware.
SELECT * FROM reviews
WHERE (? = '' OR course_id = ?)
  AND (? = 0 OR rating = ?)
  AND (? = 0 OR deleted_at IS NOT NULL)
ORDER BY created_at DESC
LIMIT ?;
