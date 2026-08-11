-- name: ListPracticeProjectsByCourse :many
-- Active projects only, ordered. Public list endpoint.
SELECT * FROM practice_projects
WHERE course_id = ? AND is_active = 1
ORDER BY order_index ASC, created_at ASC
LIMIT 100;

-- name: ListAllPracticeProjectsByCourse :many
-- Admin: all projects (active + inactive).
SELECT * FROM practice_projects
WHERE course_id = ?
ORDER BY order_index ASC, created_at ASC
LIMIT 100;

-- name: GetPracticeProjectByID :one
SELECT * FROM practice_projects WHERE id = ?;

-- name: CreatePracticeProject :execresult
INSERT INTO practice_projects
  (id, course_id, title, description, project_url, thumbnail_url, difficulty, estimated_time, tags, project_type, order_index, requirements, objectives, is_active, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdatePracticeProject :exec
UPDATE practice_projects
SET title = ?, description = ?, project_url = ?, thumbnail_url = ?, difficulty = ?,
    estimated_time = ?, tags = ?, project_type = ?, order_index = ?, requirements = ?,
    objectives = ?, is_active = ?, updated_at = ?
WHERE id = ?;

-- name: DeletePracticeProject :exec
DELETE FROM practice_projects WHERE id = ?;

-- name: GetCourseForPracticeAccess :one
-- Used by assertCourseAccess to check costType before allowing access.
SELECT cost_type FROM courses WHERE id = ?;

-- name: GetActiveEnrollmentForUserCourse :one
-- Used to check if user has an active enrollment for a paid course.
SELECT id FROM enrollments
WHERE user_id = ? AND course_id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetPracticeCompletion :one
-- Used by start/complete/skip. Unique (user_id, project_id).
SELECT * FROM practice_completions WHERE user_id = ? AND project_id = ?;

-- name: CreatePracticeCompletion :execresult
INSERT INTO practice_completions
  (id, user_id, project_id, status, started_at, submission_url, notes, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL);

-- name: UpdatePracticeCompletion :exec
UPDATE practice_completions
SET status = ?, completed_at = ?, submission_url = ?, notes = ?
WHERE user_id = ? AND project_id = ?;

-- name: ListUserPracticeCompletions :many
-- Used by getUserProgress. Joins project to filter by courseId.
SELECT pc.id, pc.user_id, pc.project_id, pc.status, pc.started_at,
       pc.completed_at, pc.submission_url, pc.notes, pc.deleted_at,
       pp.id, pp.course_id, pp.title, pp.difficulty, pp.estimated_time, pp.project_type
FROM practice_completions pc
JOIN practice_projects pp ON pp.id = pc.project_id
WHERE pc.user_id = ? AND (? = '' OR pp.course_id = ?)
ORDER BY pc.started_at DESC;

-- name: CountActivePracticeProjects :one
SELECT COUNT(*) FROM practice_projects WHERE course_id = ? AND is_active = 1;
