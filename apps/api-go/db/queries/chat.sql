-- name: CreateChatSession :execresult
INSERT INTO chat_sessions (id, user_id, lesson_id, title, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: GetChatSession :one
SELECT id, user_id, lesson_id, title, created_at, updated_at
FROM chat_sessions
WHERE id = ? AND user_id = ?;

-- name: ListChatSessions :many
-- Returns the user's general-scope sessions, newest first, with message count.
SELECT s.id, s.user_id, s.lesson_id, s.title, s.created_at, s.updated_at,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
FROM chat_sessions s
WHERE s.user_id = ? AND s.lesson_id IS NULL
ORDER BY s.updated_at DESC
LIMIT 100;

-- name: DeleteChatSession :execrows
-- Hard-delete (cascades to chat_messages via FK).
DELETE FROM chat_sessions WHERE id = ? AND user_id = ?;

-- name: ListChatMessages :many
SELECT id, session_id, role, content, tokens, created_at
FROM chat_messages
WHERE session_id = ?
ORDER BY created_at ASC
LIMIT 500;

-- name: CreateChatMessage :execresult
INSERT INTO chat_messages (id, session_id, role, content, tokens, created_at)
VALUES (?, ?, ?, ?, 0, ?);

-- name: TouchChatSession :exec
-- Bump updated_at when a new message is added.
UPDATE chat_sessions SET updated_at = ? WHERE id = ?;
