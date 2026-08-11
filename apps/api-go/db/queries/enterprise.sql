-- name: CreateEnterpriseInquiry :execresult
-- Insert a new B2B inquiry row. Caller (service) sets the UUID and
-- timestamps; default status 'pending' is applied at the DB layer.
INSERT INTO enterprise_inquiries
  (id, name, email, company, team_size, phone, topic, description, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetEnterpriseInquiryByID :one
SELECT * FROM enterprise_inquiries WHERE id = ?;

-- name: ListEnterpriseInquiries :many
-- All non-deleted inquiries, newest first. Mirrors the NestJS
-- service.findAll() ordering.
SELECT * FROM enterprise_inquiries
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateEnterpriseInquiryStatus :exec
-- Patch only the status column. updated_at is set by the service.
UPDATE enterprise_inquiries
SET status = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteEnterpriseInquiry :exec
-- Hard delete — NestJS service.delete() also issues a plain delete.
-- (Soft-delete via deletedAt is supported by the schema but the
-- service uses hard delete for the admin "delete inquiry" action.)
DELETE FROM enterprise_inquiries WHERE id = ?;

-- name: CountEnterpriseInquiriesByStatus :one
-- Lightweight count used for the admin dashboard chip. Includes all
-- rows (admin wants to see archived / closed counts too).
SELECT COUNT(*) FROM enterprise_inquiries WHERE status = ? AND deleted_at IS NULL;
