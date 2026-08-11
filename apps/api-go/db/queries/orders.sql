-- name: CancelOrder :exec
UPDATE orders
SET status = 'expired', updated_at = ?
WHERE id = ? AND status = 'pending';

-- name: CreateOrder :execresult
INSERT INTO orders
  (id, user_id, type, course_id, degree_id, amount, currency, status, payment_method, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetActiveEnrollmentByCourse :one
SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
FROM enrollments
WHERE user_id = ? AND course_id = ? AND deleted_at IS NULL;

-- name: GetActiveEnrollmentByDegree :one
SELECT id, user_id, course_id, degree_id, enrolled_at, expires_at, source, deleted_at
FROM enrollments
WHERE user_id = ? AND degree_id = ? AND deleted_at IS NULL;

-- name: GetCourseForOrder :one
SELECT id, title, cost_type, price FROM courses WHERE id = ?;

-- name: GetDegreeCourses :many
SELECT course_id FROM degree_courses WHERE degree_id = ? ORDER BY order_index ASC;

-- name: GetDegreeForOrder :one
SELECT id, title, cost_type, price FROM nano_degrees WHERE id = ?;

-- name: GetOrderByID :one
SELECT id, user_id, type, course_id, degree_id, amount, currency,
       status, payment_method, transaction_id, paid_at, deleted_at, created_at, updated_at
FROM orders
WHERE id = ?;

-- name: ListOrdersByUser :many
SELECT id, user_id, type, course_id, degree_id, amount, currency,
       status, payment_method, transaction_id, paid_at, deleted_at, created_at, updated_at
FROM orders
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 100;

-- name: MarkOrderPaid :exec
UPDATE orders
SET status = 'paid', paid_at = ?, payment_method = ?, transaction_id = ?, updated_at = ?
WHERE id = ? AND status = 'pending';

-- ============================================================================
-- Refund flow (T15-final)
-- ============================================================================

-- name: RefundCountCompletedLessonsForCourse :one
-- Count the user's progress records in a course with status='completed'.
SELECT COUNT(*) FROM progress_records
WHERE user_id = ? AND course_id = ? AND status = 'completed';

-- name: RefundCountTotalLessonsForCourse :one
-- Total lessons in a course (via chapters join). Used to compute refund
-- progress ratio = completed / total.
SELECT COUNT(*) FROM lessons l
JOIN chapters c ON c.id = l.chapter_id
WHERE c.course_id = ? AND l.deleted_at IS NULL AND c.deleted_at IS NULL;

-- name: RefundCountStartedDegreeCourses :one
-- Count the user's started progress records (in_progress + completed)
-- across all degree-courses. If 0, degree is refundable.
SELECT COUNT(*) FROM progress_records pr
JOIN degree_courses dc ON dc.course_id = pr.course_id
WHERE pr.user_id = ? AND dc.degree_id = ?
  AND pr.status IN ('in_progress', 'completed');

-- name: RefundCountDegreeCourses :one
SELECT COUNT(*) FROM degree_courses WHERE degree_id = ?;

-- name: RefundRevokeEnrollmentsForCourse :execrows
-- Soft-delete the user's order-sourced enrollment for a course.
UPDATE enrollments
SET deleted_at = ?, expires_at = NULL
WHERE user_id = ? AND course_id = ? AND source = 'order' AND deleted_at IS NULL;

-- name: RefundRevokeEnrollmentsForDegree :execrows
UPDATE enrollments
SET deleted_at = ?, expires_at = NULL
WHERE user_id = ? AND degree_id = ? AND source = 'order' AND deleted_at IS NULL;

-- name: RefundRevokeDegreeCourseEnrollments :execrows
UPDATE enrollments
SET deleted_at = ?, expires_at = NULL
WHERE user_id = ? AND enrollments.course_id IN (
    SELECT dc.course_id FROM degree_courses dc WHERE dc.degree_id = ?
) AND enrollments.source = 'degree' AND enrollments.deleted_at IS NULL;

-- name: GetOrderForRefund :one
-- Fetch the order with paid_at for the refund flow.
SELECT id, user_id, type, course_id, degree_id, amount, paid_at, status
FROM orders WHERE id = ?;
