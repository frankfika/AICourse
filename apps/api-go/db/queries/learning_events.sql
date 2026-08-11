-- name: ListLearningEventsByUser :many
-- The user's most recent N events, newest first. Default 50, max 100.
-- IFNULL(metadata, JSON_OBJECT()) prevents the *json.RawMessage
-- scan target from failing on NULL.
SELECT id, user_id, lesson_id, event_type, position_sec, duration_ms,
       IFNULL(metadata, JSON_OBJECT()) AS metadata, created_at
FROM learning_events
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: ListLearningEventsByLesson :many
-- All events for a lesson, newest first. Admin/instructor only.
SELECT id, user_id, lesson_id, event_type, position_sec, duration_ms,
       IFNULL(metadata, JSON_OBJECT()) AS metadata, created_at
FROM learning_events
WHERE lesson_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: CreateLearningEvent :execresult
INSERT INTO learning_events
  (id, user_id, lesson_id, event_type, position_sec, duration_ms, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?);
