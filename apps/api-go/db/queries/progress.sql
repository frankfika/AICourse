-- name: GetProgressByUser :many
-- All progress records for a user, newest first.
SELECT * FROM progress_records
WHERE user_id = ?
ORDER BY updated_at DESC
LIMIT 500;

-- name: GetProgressByUserCourse :many
-- All progress records for a user in a specific course.
SELECT * FROM progress_records
WHERE user_id = ? AND course_id = ?
ORDER BY updated_at DESC;

-- name: GetProgressByUserLesson :one
-- Used by completeLesson to detect existing record (unique on user+lesson).
SELECT * FROM progress_records
WHERE user_id = ? AND lesson_id = ?;

-- name: UpsertProgress :execresult
-- Insert or update by user+lesson. ON DUPLICATE updates status +
-- completed_at + last_position.
INSERT INTO progress_records
  (id, user_id, course_id, lesson_id, status, completed_at, last_position, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  completed_at = VALUES(completed_at),
  last_position = VALUES(last_position),
  updated_at = VALUES(updated_at);

-- name: CountCompletedLessonsByUser :one
-- Used by badges.computeProgress (course_completed, lessons_completed)
-- and orders.CheckRefundEligibility.
SELECT COUNT(*) FROM progress_records
WHERE user_id = ? AND status = 'completed';

-- name: CountCompletedCoursesByUser :one
-- Returns the number of courses the user has fully completed.
-- "Fully completed" = all lessons in the course have a progress
-- record with status='completed' for this user.
SELECT COUNT(DISTINCT course_id) FROM progress_records
WHERE user_id = ? AND status = 'completed'
GROUP BY course_id
HAVING COUNT(DISTINCT lesson_id) = (
  SELECT COUNT(*) FROM lessons l
  WHERE l.course_id = progress_records.course_id
    AND l.deleted_at IS NULL
);

-- name: ListCompletedCourseIDs :many
-- Returns the list of fully-completed course IDs for a user. Used by
-- badges.computeProgress (course_specific leaf) and admin stats.
-- Lessons don't have a direct course_id; the join goes lesson →
-- chapter → course.
SELECT DISTINCT pr.course_id FROM progress_records pr
WHERE pr.user_id = ? AND pr.status = 'completed'
GROUP BY pr.course_id
HAVING COUNT(DISTINCT pr.lesson_id) = (
  SELECT COUNT(*) FROM lessons l
  JOIN chapters c ON c.id = l.chapter_id
  WHERE c.course_id = pr.course_id
    AND l.deleted_at IS NULL
    AND c.deleted_at IS NULL
);

-- name: ListCompletedDatesByUser :many
-- Distinct completed_at dates for streak calculation.
-- Returned as DATE strings (e.g. "2026-08-11") for easy diff.
SELECT DISTINCT DATE(completed_at) AS d FROM progress_records
WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
ORDER BY d DESC
LIMIT 365;
