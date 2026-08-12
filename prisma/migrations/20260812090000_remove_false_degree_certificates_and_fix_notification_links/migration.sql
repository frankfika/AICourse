-- Revoke degree certificates that were incorrectly issued for payment rather
-- than verified learning completion. Public verification treats revoked rows
-- as invalid while preserving an audit trail.
UPDATE `certificates`
SET `revoked_at` = COALESCE(`revoked_at`, CURRENT_TIMESTAMP(3)),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `type` = 'degree'
  AND JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.source')) = 'order.mockPay';

-- Repair notification destinations created by earlier releases.
UPDATE `notifications`
SET `link_url` = CONCAT('/dashboard/orders/', SUBSTRING(`link_url`, LENGTH('/orders/') + 1))
WHERE `link_url` LIKE '/orders/%';

UPDATE `notifications`
SET `link_url` = CONCAT('/dashboard/certificates/', SUBSTRING(`link_url`, LENGTH('/certificates/') + 1))
WHERE `link_url` LIKE '/certificates/%';
