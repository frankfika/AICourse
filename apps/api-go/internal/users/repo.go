// Package users — repo layer for the users module.
//
// Phase 2 T11: thin wrapper around internal/repo/db (sqlc-generated) that
// gives the users service a single interface to call. Most of the queries
// here are static — they live in db/queries/users.sql — and we just
// hand-shape parameters and timestamps. The dynamic List query (with
// role/search/status filter) is the one place we drop down to database/sql
// because sqlc doesn't compose well for nullable filter combinations.
//
// Mirrors apps/api/src/modules/users/users.service.ts.
package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("users: not found")

// Repo is the users data layer. It owns the db.Queries reference and is
// safe to share across goroutines.
type Repo struct {
	q    *db.Queries
	conn *sql.DB // for dynamic List + multi-table joins
}

// NewRepo constructs a Repo from an open *sql.DB.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListFilter holds the optional filters supported by List.
type ListFilter struct {
	Role   string // "admin" | "student" | "instructor" | "" (no filter)
	Search string // email/name LIKE substring
	Status string // "active" | "disabled" | "all" — default "active"
	Page   int    // 1-based
	Limit  int    // page size
}

// ListResult is the paginated response shape.
type ListResult struct {
	Data  []db.User `json:"data"`
	Total int64     `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

// List returns users matching the filter, paginated. The query is built
// dynamically with parameterized SQL — the same pattern NestJS uses via
// Prisma's where-builder — so we don't pay for an "all combos" sqlc query.
func (r *Repo) List(ctx context.Context, f ListFilter) (ListResult, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 200 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	// Build WHERE clause with the same filter set NestJS uses.
	var conds []string
	var args []any
	if f.Status == "active" {
		conds = append(conds, "deleted_at IS NULL")
	} else if f.Status == "disabled" {
		conds = append(conds, "deleted_at IS NOT NULL")
	} // "all" → no deleted_at filter
	if f.Role != "" {
		conds = append(conds, "role = ?")
		args = append(args, f.Role)
	}
	if f.Search != "" {
		conds = append(conds, "(email LIKE ? OR name LIKE ?)")
		like := "%" + f.Search + "%"
		args = append(args, like, like)
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	// Data query
	dataSQL := fmt.Sprintf(`
		SELECT id, email, password_hash, name, role, avatar_url, password_reset_required,
		       points, level, deleted_at, created_at, updated_at, last_login_at
		FROM users
		%s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, where)
	dataArgs := append(append([]any{}, args...), f.Limit, offset)

	data, err := r.scanUsers(ctx, dataSQL, dataArgs)
	if err != nil {
		return ListResult{}, fmt.Errorf("users.repo: list: %w", err)
	}

	// Total count
	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM users %s`, where)
	var total int64
	if err := r.conn.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return ListResult{}, fmt.Errorf("users.repo: count: %w", err)
	}
	return ListResult{Data: data, Total: total, Page: f.Page, Limit: f.Limit}, nil
}

// scanUsers runs a SELECT that returns all User columns and scans them.
func (r *Repo) scanUsers(ctx context.Context, sql string, args []any) ([]db.User, error) {
	rows, err := r.conn.QueryContext(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []db.User{}
	for rows.Next() {
		var u db.User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarUrl,
			&u.PasswordResetRequired, &u.Points, &u.Level, &u.DeletedAt,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
		); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// GetByID looks up a single user (including soft-deleted) by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.User, error) {
	u, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.User{}, ErrNotFound
		}
		return db.User{}, fmt.Errorf("users.repo: get by id: %w", err)
	}
	return u, nil
}

// GetByEmail looks up an active user by email.
func (r *Repo) GetByEmail(ctx context.Context, email string) (db.User, error) {
	u, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.User{}, ErrNotFound
		}
		return db.User{}, fmt.Errorf("users.repo: get by email: %w", err)
	}
	return u, nil
}

// Create inserts a new user. Caller supplies the bcrypt-hashed password
// and the role; timestamps + UUID are generated here.
func (r *Repo) Create(ctx context.Context, email, passwordHash, name string, role db.UsersRole) (db.User, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateUser(ctx, db.CreateUserParams{
		ID:                    id,
		Email:                 email,
		PasswordHash:          passwordHash,
		Name:                  name,
		Role:                  role,
		AvatarUrl:             sql.NullString{},
		PasswordResetRequired: false,
		Points:                0,
		Level:                 0,
		CreatedAt:             now,
		UpdatedAt:             now,
	}); err != nil {
		return db.User{}, fmt.Errorf("users.repo: create: %w", err)
	}
	return db.User{
		ID: id, Email: email, PasswordHash: passwordHash, Name: name, Role: role,
		PasswordResetRequired: false, Points: 0, Level: 0, CreatedAt: now, UpdatedAt: now,
	}, nil
}

// UpdatePatch is a partial update. Use sql.Null* for fields you want to
// leave untouched.
type UpdatePatch struct {
	Name      string
	AvatarUrl sql.NullString
	Role      db.UsersRole // empty-string zero value will be passed to the column; callers should only set if isAdmin
}

// Update applies a partial update. Always bumps updated_at.
func (r *Repo) Update(ctx context.Context, id string, p UpdatePatch) error {
	now := time.Now().UTC()
	if err := r.q.UpdateUser(ctx, db.UpdateUserParams{
		Name:      p.Name,
		AvatarUrl: p.AvatarUrl,
		Role:      p.Role,
		UpdatedAt: now,
		ID:        id,
	}); err != nil {
		return fmt.Errorf("users.repo: update: %w", err)
	}
	return nil
}

// UpdatePassword writes a new bcrypt-hashed password; also sets the
// passwordResetRequired flag.
func (r *Repo) UpdatePassword(ctx context.Context, id, passwordHash string, passwordResetRequired bool) error {
	now := time.Now().UTC()
	if err := r.q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		PasswordHash:          passwordHash,
		PasswordResetRequired: passwordResetRequired,
		UpdatedAt:             now,
		ID:                    id,
	}); err != nil {
		return fmt.Errorf("users.repo: update password: %w", err)
	}
	return nil
}

// SoftDelete sets deleted_at = now. Idempotent.
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.SoftDeleteUser(ctx, db.SoftDeleteUserParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: now,
		ID:        id,
	}); err != nil {
		return fmt.Errorf("users.repo: soft delete: %w", err)
	}
	return nil
}

// Restore re-activates a soft-deleted user. Caller verifies the user is
// currently deleted before calling.
func (r *Repo) Restore(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.RestoreUser(ctx, db.RestoreUserParams{
		UpdatedAt: now,
		ID:        id,
	}); err != nil {
		return fmt.Errorf("users.repo: restore: %w", err)
	}
	return nil
}

// CountActiveAdmins returns the number of non-deleted admin users.
// Used to enforce the "can't disable the last admin" rule.
func (r *Repo) CountActiveAdmins(ctx context.Context) (int64, error) {
	n, err := r.q.CountActiveAdmins(ctx)
	if err != nil {
		return 0, fmt.Errorf("users.repo: count active admins: %w", err)
	}
	return n, nil
}

// FindOneDetail returns the user plus a one-shot join of the admin
// "detail drawer" data NestJS exposes: recent enrollments (with course
// title + thumbnail + degree), recent orders, recent certificates, recent
// point transactions, and counts.
//
// We do this in 4 queries (1 main + 3 helper) instead of one big JOIN
// because:
//  1. NestJS itself does 4 queries (Prisma's `include` is a 1+N under
//     the hood anyway, just less visible).
//  2. Each helper has its own WHERE/ORDER/LIMIT and they're all keyed off
//     the same userId, so it's straightforward to compose.
//
// `recomputeEnrollments` adds completedLessonsCount / totalLessonsCount
// per enrollment (NestJS does the same in service.ts:124-160) by
// groupBy-ing ProgressRecord and chapter counts.
func (r *Repo) FindOneDetail(ctx context.Context, id string) (Detail, error) {
	user, err := r.GetByID(ctx, id)
	if err != nil {
		return Detail{}, err
	}

	enrollments, err := r.listEnrollmentsWithProgress(ctx, id)
	if err != nil {
		return Detail{}, fmt.Errorf("users.repo: find one detail: enrollments: %w", err)
	}
	orders, err := r.listOrders(ctx, id, 20)
	if err != nil {
		return Detail{}, fmt.Errorf("users.repo: find one detail: orders: %w", err)
	}
	certificates, err := r.listCertificates(ctx, id, 20)
	if err != nil {
		return Detail{}, fmt.Errorf("users.repo: find one detail: certs: %w", err)
	}
	pointTxns, err := r.listPointTransactions(ctx, id, 20)
	if err != nil {
		return Detail{}, fmt.Errorf("users.repo: find one detail: points: %w", err)
	}
	counts, err := r.listCounts(ctx, id)
	if err != nil {
		return Detail{}, fmt.Errorf("users.repo: find one detail: counts: %w", err)
	}

	return Detail{
		User:              user,
		Enrollments:       enrollments,
		Orders:            orders,
		Certificates:      certificates,
		PointTransactions: pointTxns,
		Counts:            counts,
	}, nil
}

// Detail is the augmented user payload returned by FindOneDetail.
type Detail struct {
	User              db.User         `json:"-"`
	Enrollments       []EnrollmentRow `json:"enrollments"`
	Orders            []OrderRow      `json:"orders"`
	Certificates      []CertRow       `json:"certificates"`
	PointTransactions []PointRow      `json:"pointTransactions"`
	Counts            Counts          `json:"_count"`
}

// EnrollmentRow is the per-enrollment row in the admin detail drawer.
// Mirrors the Prisma `include` shape (course { id, title, thumbnail } +
// degree { id, title } + computed progress fields).
type EnrollmentRow struct {
	ID                    string         `json:"id"`
	UserID                string         `json:"userId"`
	CourseID              sql.NullString `json:"courseId"`
	DegreeID              sql.NullString `json:"degreeId"`
	EnrolledAt            time.Time      `json:"enrolledAt"`
	ExpiresAt             sql.NullTime   `json:"expiresAt"`
	Source                string         `json:"source"`
	DeletedAt             sql.NullTime   `json:"deletedAt"`
	Course                *CourseLite    `json:"course,omitempty"`
	Degree                *DegreeLite    `json:"degree,omitempty"`
	CompletedLessonsCount int            `json:"completedLessonsCount"`
	TotalLessonsCount     int            `json:"totalLessonsCount"`
	ProgressPercent       int            `json:"progressPercent"`
	IsCompleted           bool           `json:"isCompleted"`
}

// CourseLite / DegreeLite — minimal sub-objects for the drawer.
type CourseLite struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
}

type DegreeLite struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// OrderRow — minimal order preview.
type OrderRow struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	OrderType sql.NullString `json:"orderType"`
	Status    sql.NullString `json:"status"`
	Amount    sql.NullInt64  `json:"amount"`
	CreatedAt time.Time      `json:"createdAt"`
}

// CertRow — minimal certificate preview.
type CertRow struct {
	ID       string         `json:"id"`
	UserID   string         `json:"userId"`
	Type     sql.NullString `json:"type"`
	Title    sql.NullString `json:"title"`
	IssuedAt time.Time      `json:"issuedAt"`
}

// PointRow — minimal point transaction preview.
type PointRow struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	Amount    int32          `json:"amount"`
	RefType   sql.NullString `json:"refType"`
	CreatedAt time.Time      `json:"createdAt"`
}

// Counts — five scalar counts mirroring Prisma's _count.
type Counts struct {
	Enrollments     int64 `json:"enrollments"`
	Orders          int64 `json:"orders"`
	Certificates    int64 `json:"certificates"`
	ProgressRecords int64 `json:"progressRecords"`
	Submissions     int64 `json:"submissions"`
}

func (r *Repo) listEnrollmentsWithProgress(ctx context.Context, userID string) ([]EnrollmentRow, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT e.id, e.user_id, e.course_id, e.degree_id, e.enrolled_at, e.expires_at, e.source, e.deleted_at,
		       c.id, c.title, c.thumbnail,
		       d.id, d.title
		FROM enrollments e
		LEFT JOIN courses c ON c.id = e.course_id
		LEFT JOIN nano_degrees d ON d.id = e.degree_id
		WHERE e.user_id = ? AND e.deleted_at IS NULL
		ORDER BY e.enrolled_at DESC
		LIMIT 20
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []EnrollmentRow
	for rows.Next() {
		var e EnrollmentRow
		var cID, cTitle, cThumb sql.NullString
		var dID, dTitle sql.NullString
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.CourseID, &e.DegreeID, &e.EnrolledAt, &e.ExpiresAt, &e.Source, &e.DeletedAt,
			&cID, &cTitle, &cThumb, &dID, &dTitle,
		); err != nil {
			return nil, err
		}
		if cID.Valid {
			e.Course = &CourseLite{ID: cID.String, Title: cTitle.String, Thumbnail: cThumb.String}
		}
		if dID.Valid {
			e.Degree = &DegreeLite{ID: dID.String, Title: dTitle.String}
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Compute progress per course enrollment. Same algorithm as NestJS.
	courseIDs := []string{}
	for _, e := range out {
		if e.CourseID.Valid {
			courseIDs = append(courseIDs, e.CourseID.String)
		}
	}
	if len(courseIDs) > 0 {
		// Completed lessons per course.
		completedMap, err := r.progressCompletedByCourse(ctx, userID, courseIDs)
		if err != nil {
			return nil, err
		}
		// Total lessons per course (via chapter.lessons).
		totalMap, err := r.lessonTotalByCourse(ctx, courseIDs)
		if err != nil {
			return nil, err
		}
		for i := range out {
			if !out[i].CourseID.Valid {
				continue
			}
			cid := out[i].CourseID.String
			total := totalMap[cid]
			done := completedMap[cid]
			out[i].TotalLessonsCount = total
			out[i].CompletedLessonsCount = done
			out[i].IsCompleted = total > 0 && done >= total
			if total > 0 {
				out[i].ProgressPercent = (done * 100) / total
			}
		}
	}
	return out, nil
}

func (r *Repo) progressCompletedByCourse(ctx context.Context, userID string, courseIDs []string) (map[string]int, error) {
	// Build placeholder list for the IN clause.
	if len(courseIDs) == 0 {
		return nil, nil
	}
	placeholders := strings.Repeat("?,", len(courseIDs))
	placeholders = placeholders[:len(placeholders)-1]
	args := []any{userID}
	for _, id := range courseIDs {
		args = append(args, id)
	}
	q := fmt.Sprintf(`
		SELECT course_id, COUNT(*) AS done
		FROM progress_records
		WHERE user_id = ? AND status = 'completed' AND course_id IN (%s)
		GROUP BY course_id
	`, placeholders)
	rows, err := r.conn.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var cid string
		var done int
		if err := rows.Scan(&cid, &done); err != nil {
			return nil, err
		}
		out[cid] = done
	}
	return out, rows.Err()
}

func (r *Repo) lessonTotalByCourse(ctx context.Context, courseIDs []string) (map[string]int, error) {
	if len(courseIDs) == 0 {
		return nil, nil
	}
	placeholders := strings.Repeat("?,", len(courseIDs))
	placeholders = placeholders[:len(placeholders)-1]
	args := []any{}
	for _, id := range courseIDs {
		args = append(args, id)
	}
	q := fmt.Sprintf(`
		SELECT ch.course_id, COUNT(l.id) AS total
		FROM chapters ch
		LEFT JOIN lessons l ON l.chapter_id = ch.id AND l.deleted_at IS NULL
		WHERE ch.deleted_at IS NULL AND ch.course_id IN (%s)
		GROUP BY ch.course_id
	`, placeholders)
	rows, err := r.conn.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var cid string
		var total int
		if err := rows.Scan(&cid, &total); err != nil {
			return nil, err
		}
		out[cid] = total
	}
	return out, rows.Err()
}

func (r *Repo) listOrders(ctx context.Context, userID string, limit int) ([]OrderRow, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT id, user_id, type, status, amount, created_at
		FROM orders
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OrderRow
	for rows.Next() {
		var o OrderRow
		if err := rows.Scan(&o.ID, &o.UserID, &o.OrderType, &o.Status, &o.Amount, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (r *Repo) listCertificates(ctx context.Context, userID string, limit int) ([]CertRow, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT id, user_id, type, title, issued_at
		FROM certificates
		WHERE user_id = ?
		ORDER BY issued_at DESC
		LIMIT ?
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CertRow
	for rows.Next() {
		var c CertRow
		if err := rows.Scan(&c.ID, &c.UserID, &c.Type, &c.Title, &c.IssuedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repo) listPointTransactions(ctx context.Context, userID string, limit int) ([]PointRow, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT id, user_id, amount, ref_type, created_at
		FROM point_transactions
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PointRow
	for rows.Next() {
		var p PointRow
		if err := rows.Scan(&p.ID, &p.UserID, &p.Amount, &p.RefType, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repo) listCounts(ctx context.Context, userID string) (Counts, error) {
	var c Counts
	if err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM enrollments WHERE user_id = ?`, userID).Scan(&c.Enrollments); err != nil {
		return c, err
	}
	if err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = ?`, userID).Scan(&c.Orders); err != nil {
		return c, err
	}
	if err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM certificates WHERE user_id = ?`, userID).Scan(&c.Certificates); err != nil {
		return c, err
	}
	if err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM progress_records WHERE user_id = ?`, userID).Scan(&c.ProgressRecords); err != nil {
		return c, err
	}
	if err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM submissions WHERE user_id = ?`, userID).Scan(&c.Submissions); err != nil {
		return c, err
	}
	return c, nil
}

// GrantCourseAccess upserts a (userID, courseID) enrollment with source
// 'direct' and clears any soft-delete. Returns the number of grants
// actually applied.
func (r *Repo) GrantCourseAccess(ctx context.Context, userID string, courseIDs []string) (int, error) {
	if len(courseIDs) == 0 {
		return 0, nil
	}
	count := 0
	for _, cid := range courseIDs {
		if err := r.upsertEnrollment(ctx, userID, cid, "", "direct"); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// GrantDegreeAccess is the degree counterpart of GrantCourseAccess.
func (r *Repo) GrantDegreeAccess(ctx context.Context, userID string, degreeIDs []string) (int, error) {
	if len(degreeIDs) == 0 {
		return 0, nil
	}
	count := 0
	for _, did := range degreeIDs {
		if err := r.upsertEnrollment(ctx, userID, "", did, "direct"); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// upsertEnrollment implements the same shape as NestJS's
// prisma.enrollment.upsert call: revive a soft-deleted row, otherwise
// insert. Implementation note: MySQL has INSERT ... ON DUPLICATE KEY
// UPDATE, but the @@unique constraint pairs (userId,courseId) and
// (userId,degreeId), and we want different fields to come into play
// depending on which side is set. So we do a SELECT first and either
// UPDATE or INSERT.
//
// Trade-off: this is two round-trips. The NestJS upsert is one. For
// admin-grant flows the volume is small so it's not a real concern; if
// it ever becomes one, switch to a single MySQL upsert.
func (r *Repo) upsertEnrollment(ctx context.Context, userID, courseID, degreeID, source string) error {
	now := time.Now().UTC()
	// Look up existing (including soft-deleted).
	var existingID string
	var q string
	var args []any
	if courseID != "" {
		q = `SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1`
		args = []any{userID, courseID}
	} else {
		q = `SELECT id FROM enrollments WHERE user_id = ? AND degree_id = ? LIMIT 1`
		args = []any{userID, degreeID}
	}
	err := r.conn.QueryRowContext(ctx, q, args...).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("users.repo: upsert enrollment lookup: %w", err)
	}
	if err == nil {
		// Revive the existing row.
		_, err := r.conn.ExecContext(ctx, `
			UPDATE enrollments
			SET deleted_at = NULL, expires_at = NULL, enrolled_at = ?, source = ?
			WHERE id = ?
		`, now, source, existingID)
		if err != nil {
			return fmt.Errorf("users.repo: upsert enrollment update: %w", err)
		}
		return nil
	}
	// Insert.
	var courseIDArg, degreeIDArg any
	if courseID != "" {
		courseIDArg = courseID
	} else {
		degreeIDArg = degreeID
	}
	_, err = r.conn.ExecContext(ctx, `
		INSERT INTO enrollments (id, user_id, course_id, degree_id, enrolled_at, source)
		VALUES (?, ?, ?, ?, ?, ?)
	`, uuid.NewString(), userID, courseIDArg, degreeIDArg, now, source)
	if err != nil {
		return fmt.Errorf("users.repo: upsert enrollment insert: %w", err)
	}
	return nil
}

// WriteAuditLog appends an entry to audit_logs. Best-effort: the caller
// is expected to log (not return) errors so audit failure doesn't break
// the user-facing action.
//
// Mirrors AuditLogService.log in NestJS (apps/api/src/modules/audit/audit-log.service.ts).
type AuditEntry struct {
	UserID    string
	Action    string
	Entity    string
	EntityID  string
	Details   string // JSON blob (TEXT)
	IPAddress string
	UserAgent string
}

func (r *Repo) WriteAuditLog(ctx context.Context, e AuditEntry) error {
	now := time.Now().UTC()
	_, err := r.q.WriteAuditLog(ctx, db.WriteAuditLogParams{
		ID:        uuid.NewString(),
		UserID:    sql.NullString{String: e.UserID, Valid: e.UserID != ""},
		Action:    e.Action,
		Entity:    e.Entity,
		EntityID:  sql.NullString{String: e.EntityID, Valid: e.EntityID != ""},
		Details:   sql.NullString{String: e.Details, Valid: e.Details != ""},
		IpAddress: sql.NullString{String: e.IPAddress, Valid: e.IPAddress != ""},
		UserAgent: sql.NullString{String: e.UserAgent, Valid: e.UserAgent != ""},
		CreatedAt: now,
	})
	if err != nil {
		return fmt.Errorf("users.repo: write audit log: %w", err)
	}
	return nil
}

// GetProviderAccountByID looks up a provider binding by id.
func (r *Repo) GetProviderAccountByID(ctx context.Context, id string) (db.UserProviderAccount, error) {
	pa, err := r.q.GetProviderAccountByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.UserProviderAccount{}, ErrNotFound
		}
		return db.UserProviderAccount{}, fmt.Errorf("users.repo: get provider account by id: %w", err)
	}
	return pa, nil
}

// SoftDeleteProviderAccount unlinks a provider from a user.
func (r *Repo) SoftDeleteProviderAccount(ctx context.Context, id string) error {
	now := time.Now().UTC()
	if err := r.q.SoftDeleteProviderAccount(ctx, db.SoftDeleteProviderAccountParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: now,
		ID:        id,
	}); err != nil {
		return fmt.Errorf("users.repo: soft delete provider account: %w", err)
	}
	return nil
}

// CountActivePrimaryProviders returns the number of active primary
// provider bindings for a user. Used for the "can't unlink the last
// primary" guard.
func (r *Repo) CountActivePrimaryProviders(ctx context.Context, userID string) (int64, error) {
	n, err := r.q.CountActivePrimaryProviders(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("users.repo: count primary providers: %w", err)
	}
	return n, nil
}
