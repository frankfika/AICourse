-- name: GetDegreeByID :one
-- Used by findOne and update. No soft-delete on degrees (use
-- status='archived' instead per the schema).
SELECT * FROM nano_degrees WHERE id = ?;

-- name: ListDegrees :many
-- Public list (status filter applied by service layer to enforce
-- "drafts hidden from public"). Search is by title OR description LIKE.
-- Returns all 4 fields needed for the list view.
SELECT id, title, description, cost_type, price, status, thumbnail
FROM nano_degrees
ORDER BY created_at DESC
LIMIT 200;

-- name: CreateDegree :execresult
INSERT INTO nano_degrees
  (id, title, description, learning_points, price, icon, cost_type, thumbnail, status, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateDegree :exec
UPDATE nano_degrees
SET title = ?, description = ?, learning_points = ?, price = ?,
    icon = ?, cost_type = ?, thumbnail = ?, status = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteDegree :exec
DELETE FROM nano_degrees WHERE id = ?;

-- name: ListDegreeCourses :many
-- Returns the courses linked to a degree in curriculum order.
SELECT course_id FROM degree_courses WHERE degree_id = ? ORDER BY order_index ASC;

-- name: GetDegreeCourseLink :one
-- Used by linkCourses to detect duplicate (degree_id, course_id) pairs
-- when bulk-inserting.
SELECT order_index FROM degree_courses WHERE degree_id = ? AND course_id = ?;

-- name: UpsertDegreeCourse :exec
INSERT INTO degree_courses (degree_id, course_id, order_index)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE order_index = VALUES(order_index);

-- name: CountDegreeCourses :one
SELECT COUNT(*) FROM degree_courses WHERE degree_id = ?;

-- name: MaxDegreeCourseOrder :one
-- Used by linkCourses when no order_index is provided (default = max + 1).
SELECT COALESCE(MAX(order_index), -1) FROM degree_courses WHERE degree_id = ?;

-- name: CountActiveEnrollmentsByDegree :one
-- Used by delete to ensure no one is actively enrolled.
SELECT COUNT(*) FROM enrollments WHERE degree_id = ? AND deleted_at IS NULL;
