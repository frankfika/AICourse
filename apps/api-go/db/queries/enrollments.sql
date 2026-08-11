-- name: GetEnrollmentByID :one
-- Retrieves an enrollment by id.
SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
FROM enrollments
WHERE id = ?;

-- name: ListEnrollmentsByUser :many
-- All non-deleted enrollments for a user, newest first. Used by /me dashboard.
SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
FROM enrollments
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY enrolled_at DESC;

-- name: GetUserCourseEnrollment :one
-- Look up a specific course enrollment for a user. Returns ErrNoRows if not enrolled.
SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
FROM enrollments
WHERE user_id = ? AND course_id = ? AND deleted_at IS NULL;

-- name: CreateEnrollment :execresult
-- Inserts a new enrollment. Caller supplies id (uuid).
-- The @@unique([userId, courseId]) constraint enforces one active enrollment per (user, course);
-- Service layer uses upsert to revive a soft-deleted row.
INSERT INTO enrollments (
  id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: SoftDeleteEnrollment :exec
-- Admin withdraw / user drop / batch cleanup. Enrollments use soft-delete
-- because the cert/point trail depends on enrollment history.
UPDATE enrollments
SET deleted_at = ?, source = source
WHERE id = ?;
