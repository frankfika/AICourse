-- name: GetInstructorByID :one
-- Admin / internal: returns the instructor regardless of status.
SELECT * FROM instructors WHERE id = ?;

-- name: GetInstructorBySlug :one
-- Admin / internal: returns the instructor regardless of status.
SELECT * FROM instructors WHERE slug = ?;

-- name: GetPublishedInstructorBySlug :one
-- Public-facing detail page: enforces published_at IS NOT NULL.
SELECT * FROM instructors WHERE slug = ? AND published_at IS NOT NULL;

-- name: GetInstructorBySlugAny :one
-- For slug uniqueness check during create/update.
SELECT id, slug FROM instructors WHERE slug = ? LIMIT 1;

-- name: CreateInstructor :execresult
-- Admin: inserts a new instructor. Caller supplies id (cuid) + timestamps.
INSERT INTO instructors (
  id, slug, name, name_en, title, title_en, headline, headline_en,
  bio, bio_en, avatar_url, company, years_of_experience,
  linkedin_url, github_url, twitter_url, website_url,
  contact_email, notes, order_index, published_at,
  created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?
);

-- name: UpdateInstructor :exec
-- Admin: full update. Service layer reads the current row first and
-- passes the merged patch in (idempotent re-write of unchanged fields).
UPDATE instructors
SET slug = ?, name = ?, name_en = ?, title = ?, title_en = ?,
    headline = ?, headline_en = ?, bio = ?, bio_en = ?,
    avatar_url = ?, company = ?, years_of_experience = ?,
    linkedin_url = ?, github_url = ?, twitter_url = ?, website_url = ?,
    contact_email = ?, notes = ?, order_index = ?,
    published_at = ?, updated_at = ?
WHERE id = ?;

-- name: SoftDeleteInstructor :exec
-- Admin: sets published_at = NULL (前台 404, 课程卡 fallback). Keeps the
-- row for audit + historical enrollments. The service layer unlinks
-- all course_instructor_links in the same transaction.
UPDATE instructors SET published_at = NULL, updated_at = ? WHERE id = ?;

-- name: SetInstructorOrderIndex :exec
-- Admin: drag-sort. Service calls this in a transaction.
UPDATE instructors SET order_index = ?, updated_at = ? WHERE id = ?;

-- name: CountInstructorsByFilter :one
-- Mirrors the public/admin list filter. Built dynamically by the repo
-- because the WHERE composition depends on the query string.
-- This static query is only used for the admin "all statuses, no filter"
-- path (when no args are supplied). See repo for the dynamic version.
SELECT COUNT(*) AS count FROM instructors;

-- ==================== course_instructor_links ====================

-- name: GetCourseInstructorLinkByID :one
SELECT * FROM course_instructor_links WHERE id = ?;

-- name: ListCourseInstructorLinksByInstructor :many
-- Admin: list a single instructor's course assignments (instructor-centric).
SELECT * FROM course_instructor_links
WHERE instructor_id = ?
ORDER BY role ASC, order_index ASC, created_at ASC;

-- name: ListCourseInstructorLinksByInstructorWithCourse :many
-- Admin: list a single instructor's course assignments with course info joined.
-- The frontend can render the course title / status without a second roundtrip.
SELECT
  cil.id           AS cil_id,
  cil.course_id    AS cil_course_id,
  cil.instructor_id AS cil_instructor_id,
  cil.role         AS cil_role,
  cil.is_primary   AS cil_is_primary,
  cil.order_index  AS cil_order_index,
  cil.created_at   AS cil_created_at,
  c.title          AS course_title,
  c.status         AS course_status,
  c.thumbnail      AS course_thumbnail,
  c.level          AS course_level,
  c.cost_type      AS course_cost_type
FROM course_instructor_links cil
JOIN courses c ON c.id = cil.course_id
WHERE cil.instructor_id = ?
ORDER BY cil.role ASC, cil.order_index ASC, cil.created_at ASC;

-- name: CreateCourseInstructorLink :execresult
-- Admin: insert a (course, instructor, role) link. The DB has a unique
-- constraint on (course_id, instructor_id, role) so a duplicate insert
-- errors — the service uses UpsertCourseInstructorLink instead.
INSERT INTO course_instructor_links
  (id, course_id, instructor_id, role, is_primary, order_index, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpsertCourseInstructorLink :execresult
-- Admin: idempotent link insert. If a row with the same
-- (course_id, instructor_id, role) exists, refresh its role / primary /
-- order fields. NestJS uses prisma.upsert with the same composite key.
INSERT INTO course_instructor_links
  (id, course_id, instructor_id, role, is_primary, order_index, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  is_primary = VALUES(is_primary),
  order_index = VALUES(order_index);

-- name: DeleteCourseInstructorLink :exec
DELETE FROM course_instructor_links WHERE id = ?;

-- name: DeleteCourseInstructorLinksByInstructor :exec
-- Used by soft-delete (unlink all courses) and by SyncCourseLinks
-- (delete-then-create in a tx).
DELETE FROM course_instructor_links WHERE instructor_id = ?;

-- name: ClearPrimaryInstructorForRole :exec
-- When promoting a new primary instructor for a given (course, role),
-- clear is_primary on every other link in the same (course, role) — the
-- id of the freshly-inserted link is excluded.
UPDATE course_instructor_links
SET is_primary = false
WHERE course_id = ? AND role = ? AND id != ? AND is_primary = true;

-- ==================== instructor_expertises (T24) ====================

-- name: ListExpertises :many
-- Public + admin: all expertises ordered by NestJS
-- `orderBy: [{ isActive: 'desc' }, { orderIndex: 'asc' }]`.
-- Active rows first (true > false in MySQL ordering), then by manual order.
SELECT * FROM instructor_expertises
ORDER BY is_active DESC, order_index ASC, id ASC;

-- name: GetExpertiseByID :one
SELECT * FROM instructor_expertises WHERE id = ?;

-- name: GetExpertiseByKey :one
-- Uniqueness check during create. Throws 409 on duplicate key.
SELECT id, `key`, label, label_en, is_active, order_index, created_at, updated_at
FROM instructor_expertises
WHERE `key` = ? LIMIT 1;

-- name: CreateExpertise :execresult
-- Admin: insert a new expertise. Caller supplies id (cuid) + timestamps.
INSERT INTO instructor_expertises
  (id, `key`, label, label_en, is_active, order_index, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateExpertise :exec
-- Admin: full update (service layer reads first + merges, same pattern
-- as the instructors update).
UPDATE instructor_expertises
SET `key` = ?, label = ?, label_en = ?, is_active = ?,
    order_index = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteExpertise :exec
-- Admin: hard delete. instructor_expertise_links cascade-deletes
-- automatically via FK.
DELETE FROM instructor_expertises WHERE id = ?;
