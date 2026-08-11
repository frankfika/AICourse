-- name: ListMyCertificates :many
-- Returns the user's certificates, newest first, optionally filtered by type.
-- Excludes revoked certificates (revokedAt IS NULL).
SELECT id, user_id, type, ref_id, title, description, serial_number,
       issued_at, completed_at, image_url, verify_url,
       IFNULL(metadata, JSON_OBJECT()) AS metadata,
       revoked_at, created_at, updated_at
FROM certificates
WHERE user_id = ? AND revoked_at IS NULL
  AND (? = '' OR type = ?)
ORDER BY issued_at DESC;

-- name: GetCertificateByID :one
SELECT id, user_id, type, ref_id, title, description, serial_number,
       issued_at, completed_at, image_url, verify_url,
       IFNULL(metadata, JSON_OBJECT()) AS metadata,
       revoked_at, created_at, updated_at
FROM certificates WHERE id = ?;

-- name: GetCertificateBySerial :one
-- Used by verifyCertificate for the public /verify/:serial endpoint.
SELECT id, user_id, type, ref_id, title, description, serial_number,
       issued_at, completed_at, image_url, verify_url,
       IFNULL(metadata, JSON_OBJECT()) AS metadata,
       revoked_at, created_at, updated_at
FROM certificates WHERE serial_number = ?;

-- name: GetCertificateByUserTypeRef :one
-- Idempotency check for issueCertificate: same (user, type, ref) returns
-- the existing certificate.
SELECT id, user_id, type, ref_id, title, description, serial_number,
       issued_at, completed_at, image_url, verify_url,
       IFNULL(metadata, JSON_OBJECT()) AS metadata,
       revoked_at, created_at, updated_at
FROM certificates WHERE user_id = ? AND type = ? AND ref_id = ?;

-- name: CreateCertificate :execresult
INSERT INTO certificates
  (id, user_id, type, ref_id, title, description, serial_number, issued_at, completed_at, image_url, verify_url, metadata, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: RevokeCertificate :exec
UPDATE certificates SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL;

-- name: CountSerialByPrefix :one
-- Returns the count of existing certificates with the same serial prefix.
-- Used by the serial number generator to detect when to bump the sequence.
-- Note: the actual seq is parsed from the serial_number string at the Go
-- layer (serial format: OCSG-{year}-{TYPE}-{0001..N}).
SELECT COUNT(*) FROM certificates WHERE serial_number LIKE ?;
