-- name: WriteAuditLog :execresult
-- Append an audit log entry. Caller supplies the id (uuid) and the
-- timestamp; details is a JSON blob (TEXT in MySQL) for the before/after
-- diff that NestJS's AuditLogService stores.
INSERT INTO audit_logs (
  id, user_id, action, entity, entity_id, details, ip_address, user_agent, created_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?
);
