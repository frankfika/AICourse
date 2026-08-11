-- name: GetCourseByID :one
-- Retrieves a course by id. Filters out drafts from non-admin callers — for
-- the API boundary, the admin/owner path will use a separate unscoped query.
SELECT id, title, description, learning_points, instructor, level, duration,
       thumbnail, tags, cost_type, price, status, course_type, external_url,
       source_video_url, source_platform, created_at, updated_at,
       industry_id, category_id
FROM courses
WHERE id = ? AND status = 'published';

-- name: GetCourseByIDAnyStatus :one
-- Admin / internal: returns the course regardless of status.
SELECT id, title, description, learning_points, instructor, level, duration,
       thumbnail, tags, cost_type, price, status, course_type, external_url,
       source_video_url, source_platform, created_at, updated_at,
       industry_id, category_id
FROM courses
WHERE id = ?;

-- name: ListCoursesByStatus :many
-- Course catalog listing, filter by status, newest first. Paged.
SELECT id, title, description, learning_points, instructor, level, duration,
       thumbnail, tags, cost_type, price, status, course_type, external_url,
       source_video_url, source_platform, created_at, updated_at,
       industry_id, category_id
FROM courses
WHERE status = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: CreateCourse :execresult
-- Inserts a new course. Caller generates id (uuid or cuid).
INSERT INTO courses (
  id, title, description, learning_points, instructor, level, duration,
  thumbnail, tags, cost_type, price, status, course_type, external_url,
  source_video_url, source_platform, created_at, updated_at,
  industry_id, category_id
) VALUES (
  ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?
);

-- name: UpdateCourseStatus :exec
-- Admin: publishes / archives / drafts a course.
UPDATE courses
SET status = ?, updated_at = ?
WHERE id = ?;

-- name: UpdateCourse :exec
-- Partial update for the admin PATCH endpoint. Only the fields the
-- caller explicitly supplies are written; the rest keep their existing
-- values. Caller is responsible for shaping the patch (UpdateCoursePatch
-- in courses.sql.go).
UPDATE courses
SET title = ?, description = ?, learning_points = ?, instructor = ?,
    level = ?, duration = ?, thumbnail = ?, tags = ?, cost_type = ?,
    price = ?, course_type = ?, external_url = ?, source_video_url = ?,
    source_platform = ?, industry_id = ?, category_id = ?,
    updated_at = ?
WHERE id = ?;

-- name: DeleteCourse :exec
-- Hard delete. Cascades to chapters / lessons / resources / enrollments
-- per the FK constraints. Admin only; service layer verifies role.
DELETE FROM courses WHERE id = ?;

-- name: ListAllCourses :many
-- Admin catalog: all statuses, newest first. Paged.
SELECT id, title, description, learning_points, instructor, level, duration,
       thumbnail, tags, cost_type, price, status, course_type, external_url,
       source_video_url, source_platform, created_at, updated_at,
       industry_id, category_id
FROM courses
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: CountCourses :one
-- Total courses matching the optional status filter.
SELECT COUNT(*) AS count FROM courses
WHERE (? = '' OR status = ?);

-- name: MaxOrderIndexInDegree :one
-- For linkDegrees: figure out the next order index in a given degree.
SELECT COALESCE(MAX(order_index), -1) AS max_idx
FROM degree_courses WHERE degree_id = ?;

-- name: DegreeCourseExists :one
-- Idempotency guard for linkDegrees: skip if (degree, course) pair already
-- exists (the @@unique constraint catches inserts, but we want a clean
-- "skipped" count in the response).
SELECT EXISTS(
  SELECT 1 FROM degree_courses WHERE degree_id = ? AND course_id = ?
);

-- name: CreateDegreeCourse :execresult
-- Append a (degree, course) link at the supplied order_index.
INSERT INTO degree_courses (degree_id, course_id, order_index) VALUES (?, ?, ?);
