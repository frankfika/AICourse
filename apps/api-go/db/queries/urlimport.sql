-- name: CreateUrlImport :execresult
-- Record a new URL-import task. T22 stores every request as a row
-- with status='pending'; T22.1 will flip the status when the real
-- metadata extraction completes.
INSERT INTO url_imports
  (id, url, platform, status, requested_by, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetUrlImportByID :one
SELECT * FROM url_imports WHERE id = ?;

-- name: ListUrlImports :many
-- Recent import tasks, newest first. Used by the admin dashboard
-- (T22 ships without a dedicated list endpoint, but the query is
-- here for the T22.1 follow-up that exposes /admin/imports).
SELECT * FROM url_imports
ORDER BY created_at DESC
LIMIT 100;

-- name: ListUrlImportsByRequester :many
-- Per-admin "what did I import" view. T22.1 will mount this.
SELECT * FROM url_imports
WHERE requested_by = ?
ORDER BY created_at DESC
LIMIT 100;

-- name: UpdateUrlImportStatus :exec
-- Flip a task from pending → completed/failed. result_course_id and
-- error_message are nullable.
UPDATE url_imports
SET status = ?,
    result_course_id = ?,
    error_message = ?,
    updated_at = ?
WHERE id = ?;

-- name: UpdateUrlImportFetched :exec
-- T22.1: persist the metadata extracted from YouTube oEmbed or the
-- Bilibili view API, and flip the status to 'fetched'. All metadata
-- columns are nullable so partial fetches (e.g. Bilibili 404) still
-- land a row, and Gemini step failures can later promote to 'imported'
-- or roll back to 'failed' from the same row.
UPDATE url_imports
SET status = ?,
    title = ?,
    author = ?,
    thumbnail_url = ?,
    duration_seconds = ?,
    extracted_json = ?,
    fetched_at = ?,
    error_message = ?,
    updated_at = ?
WHERE id = ?;
