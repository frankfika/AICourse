-- name: ListNotesByUserLesson :many
-- All notes for a (user, lesson) pair, oldest first (so the user
-- can see them in chronological order).
SELECT * FROM notes
WHERE user_id = ? AND lesson_id = ?
ORDER BY created_at ASC;

-- name: GetNoteByID :one
SELECT * FROM notes WHERE id = ?;

-- name: CreateNote :execresult
INSERT INTO notes
  (id, user_id, lesson_id, content, position_sec, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateNote :exec
UPDATE notes
SET content = ?, position_sec = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteNote :exec
DELETE FROM notes WHERE id = ?;
