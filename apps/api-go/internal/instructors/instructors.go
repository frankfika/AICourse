// Package instructors — site-wide instructor / mentor management. Mirrors
// apps/api/src/modules/instructors/instructors.service.ts 1:1.
//
// Phase 2 T20: 12 endpoints total (2 public + 10 admin). The public
// surface forces published_at IS NOT NULL; the admin surface is
// unrestricted and gated by middleware.RequireRole("admin") in the
// handler layer.
//
// Note: the NestJS source exposes the course-link CRUD under
// `/admin/courses/:courseId/instructors` (course-centric). Frank's T20
// spec asks for the instructor-centric URLs
// (`/admin/instructors/:id/course-links`) which match the existing
// courses handler convention better, so we port that layout here.
package instructors

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("instructors: not found")

// Repo is the instructors data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Service is the instructors business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// =============================================================
// Public DTO shapes (snake-cased to match NestJS Prisma JSON)
// =============================================================

// InstructorView is the public shape of an instructor (camelCase keys
// to match the NestJS API contract; nullable fields use *string).
type InstructorView struct {
	ID                string     `json:"id"`
	Slug              string     `json:"slug"`
	Name              string     `json:"name"`
	NameEn            *string    `json:"nameEn,omitempty"`
	Title             *string    `json:"title,omitempty"`
	TitleEn           *string    `json:"titleEn,omitempty"`
	Headline          *string    `json:"headline,omitempty"`
	HeadlineEn        *string    `json:"headlineEn,omitempty"`
	Bio               *string    `json:"bio,omitempty"`
	BioEn             *string    `json:"bioEn,omitempty"`
	AvatarURL         *string    `json:"avatarUrl,omitempty"`
	Company           *string    `json:"company,omitempty"`
	YearsOfExperience *int32     `json:"yearsOfExperience,omitempty"`
	LinkedinURL       *string    `json:"linkedinUrl,omitempty"`
	GithubURL         *string    `json:"githubUrl,omitempty"`
	TwitterURL        *string    `json:"twitterUrl,omitempty"`
	WebsiteURL        *string    `json:"websiteUrl,omitempty"`
	ContactEmail      *string    `json:"contactEmail,omitempty"`
	Notes             *string    `json:"notes,omitempty"`
	OrderIndex        int32      `json:"orderIndex"`
	PublishedAt       *time.Time `json:"publishedAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

// CourseInstructorLinkView is the public shape of a course-link row
// (instructor-centric listing with course info joined).
type CourseInstructorLinkView struct {
	ID           string    `json:"id"`
	CourseID     string    `json:"courseId"`
	InstructorID string    `json:"instructorId"`
	Role         string    `json:"role"`
	IsPrimary    bool      `json:"isPrimary"`
	OrderIndex   int32     `json:"orderIndex"`
	CreatedAt    time.Time `json:"createdAt"`
	// Course info (nullable because the join may not always populate
	// these in the future; for T20 the join is unconditional).
	CourseTitle     *string `json:"courseTitle,omitempty"`
	CourseStatus    *string `json:"courseStatus,omitempty"`
	CourseThumbnail *string `json:"courseThumbnail,omitempty"`
	CourseLevel     *string `json:"courseLevel,omitempty"`
	CourseCostType  *string `json:"courseCostType,omitempty"`
}

// =============================================================
// API inputs (the handler binds JSON into these)
// =============================================================

// CreateInput is the admin create-instructor payload.
type CreateInput struct {
	Slug              *string
	Name              string
	NameEn            *string
	Title             *string
	TitleEn           *string
	Headline          *string
	HeadlineEn        *string
	Bio               *string
	BioEn             *string
	AvatarURL         *string
	Company           *string
	YearsOfExperience *int32
	LinkedinURL       *string
	GithubURL         *string
	TwitterURL        *string
	WebsiteURL        *string
	ContactEmail      *string
	Notes             *string
	OrderIndex        *int32
	Published         *bool
	// Course-link IDs to attach at create time. Optional.
	CourseIDs []string
}

// UpdateInput is the admin partial-update payload. Service does
// the "read first, merge, then write" dance.
type UpdateInput struct {
	Slug              *string
	Name              *string
	NameEn            *string
	Title             *string
	TitleEn           *string
	Headline          *string
	HeadlineEn        *string
	Bio               *string
	BioEn             *string
	AvatarURL         *string
	Company           *string
	YearsOfExperience *int32
	LinkedinURL       *string
	GithubURL         *string
	TwitterURL        *string
	WebsiteURL        *string
	ContactEmail      *string
	Notes             *string
	OrderIndex        *int32
	Published         *bool
}

// ListParams mirrors the public + admin query-string inputs.
type ListParams struct {
	Search   string
	Sort     string // "" | "orderIndex" | "name" | "recent"
	Page     int
	Limit    int
	AdminAll bool // when true, don't force published filter
}

// ListResult is the paginated list response.
type ListResult struct {
	Data       []InstructorView `json:"data"`
	Total      int64            `json:"total"`
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
	TotalPages int              `json:"totalPages"`
}

// LinkCourseInput is the admin add-link payload.
type LinkCourseInput struct {
	CourseID   string
	Role       string // "instructor" | "mentor"
	IsPrimary  bool
	OrderIndex int32
}

// SyncLinksInput is the admin bulk-replace payload.
type SyncLinksInput struct {
	Links []LinkCourseInput
}

// =============================================================
// Public list (前台 only published) / detail (by slug)
// =============================================================

// List returns a paginated instructor list. publishedOnly mirrors the
// NestJS option flag — when true we add a published_at IS NOT NULL
// filter on top of whatever Search / sort is supplied.
func (s *Service) List(ctx context.Context, p ListParams, publishedOnly bool) (ListResult, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 || p.Limit > 100 {
		p.Limit = 24
	}
	offset := (p.Page - 1) * p.Limit

	// Build WHERE.
	conds := []string{}
	args := []any{}
	if publishedOnly {
		conds = append(conds, "published_at IS NOT NULL")
	}
	if p.Search != "" {
		conds = append(conds, "(name LIKE ? OR name_en LIKE ? OR title LIKE ? OR headline LIKE ?)")
		like := "%" + p.Search + "%"
		args = append(args, like, like, like, like)
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	// Order.
	orderBy := "order_index ASC, id ASC"
	switch p.Sort {
	case "name":
		orderBy = "name ASC"
	case "recent":
		orderBy = "created_at DESC"
	}

	// Count.
	var total int64
	if err := s.repo.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM instructors "+where, args...).Scan(&total); err != nil {
		return ListResult{}, errs.Internal("count instructors", err)
	}

	// Page.
	rows, err := s.repo.conn.QueryContext(ctx, fmt.Sprintf(`
		SELECT * FROM instructors
		%s
		ORDER BY %s
		LIMIT ? OFFSET ?
	`, where, orderBy), append(append([]any{}, args...), p.Limit, offset)...)
	if err != nil {
		return ListResult{}, errs.Internal("list instructors", err)
	}
	defer rows.Close()
	out := []InstructorView{}
	for rows.Next() {
		var x db.Instructor
		if err := scanInstructor(&x, rows); err != nil {
			return ListResult{}, errs.Internal("scan instructor", err)
		}
		out = append(out, instructorToView(x))
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, errs.Internal("iterate instructors", err)
	}
	totalPages := 0
	if p.Limit > 0 {
		totalPages = int((total + int64(p.Limit) - 1) / int64(p.Limit))
	}
	return ListResult{
		Data: out, Total: total, Page: p.Page, Limit: p.Limit, TotalPages: totalPages,
	}, nil
}

// GetBySlug returns a single instructor by slug. publishedOnly enforces
// the public filter.
func (s *Service) GetBySlug(ctx context.Context, slug string, publishedOnly bool) (InstructorView, error) {
	var (
		ins db.Instructor
		err error
	)
	if publishedOnly {
		ins, err = s.repo.q.GetPublishedInstructorBySlug(ctx, slug)
	} else {
		ins, err = s.repo.q.GetInstructorBySlug(ctx, slug)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return InstructorView{}, errs.NotFound("Instructor not found")
		}
		return InstructorView{}, errs.Internal("get instructor by slug", err)
	}
	return instructorToView(ins), nil
}

// GetByID returns a single instructor by id (admin / internal).
func (s *Service) GetByID(ctx context.Context, id string) (InstructorView, error) {
	ins, err := s.repo.q.GetInstructorByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return InstructorView{}, errs.NotFound("Instructor not found")
		}
		return InstructorView{}, errs.Internal("get instructor by id", err)
	}
	return instructorToView(ins), nil
}

// =============================================================
// Admin create / update / soft-delete
// =============================================================

// Create inserts a new instructor.
func (s *Service) Create(ctx context.Context, in CreateInput) (InstructorView, error) {
	if strings.TrimSpace(in.Name) == "" {
		return InstructorView{}, errs.BadRequest("name is required")
	}
	if in.ContactEmail != nil && *in.ContactEmail != "" {
		if _, err := mail.ParseAddress(*in.ContactEmail); err != nil {
			return InstructorView{}, errs.BadRequest("contactEmail is not a valid email")
		}
	}

	// Slug: explicit > auto-slugified. For auto-slug, append -N until
	// free. For explicit slug, hard-fail with 409 on collision —
	// NestJS does the same (only auto-slugs go through the suffix loop).
	var (
		slug string
		err  error
	)
	if in.Slug != nil && *in.Slug != "" {
		var existing db.GetInstructorBySlugAnyRow
		existing, err = s.repo.q.GetInstructorBySlugAny(ctx, *in.Slug)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return InstructorView{}, errs.Internal("slug uniqueness check", err)
		}
		if err == nil && existing.ID != "" {
			return InstructorView{}, errs.Conflict(`Slug "` + *in.Slug + `" 已被占用`)
		}
		slug = *in.Slug
	} else {
		baseSlug := slugifyName(in.Name)
		slug, err = s.ensureUniqueSlug(ctx, baseSlug, "")
		if err != nil {
			return InstructorView{}, err
		}
	}

	now := time.Now().UTC()
	id := generateInstructorID()
	publishedAt := sql.NullTime{}
	if in.Published != nil && *in.Published {
		publishedAt = sql.NullTime{Time: now, Valid: true}
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}

	_, err = s.repo.q.CreateInstructor(ctx, db.CreateInstructorParams{
		ID:                id,
		Slug:              slug,
		Name:              in.Name,
		NameEn:            ns(in.NameEn),
		Title:             ns(in.Title),
		TitleEn:           ns(in.TitleEn),
		Headline:          ns(in.Headline),
		HeadlineEn:        ns(in.HeadlineEn),
		Bio:               ns(in.Bio),
		BioEn:             ns(in.BioEn),
		AvatarUrl:         ns(in.AvatarURL),
		Company:           ns(in.Company),
		YearsOfExperience: ni32(in.YearsOfExperience),
		LinkedinUrl:       ns(in.LinkedinURL),
		GithubUrl:         ns(in.GithubURL),
		TwitterUrl:        ns(in.TwitterURL),
		WebsiteUrl:        ns(in.WebsiteURL),
		ContactEmail:      ns(in.ContactEmail),
		Notes:             ns(in.Notes),
		OrderIndex:        orderIdx,
		PublishedAt:       publishedAt,
		CreatedAt:         now,
		UpdatedAt:         now,
	})
	if err != nil {
		return InstructorView{}, errs.Internal("create instructor", err)
	}

	s.writeAudit(ctx, "instructor.create", id)

	// Re-read so the response matches the DB exactly.
	out, err := s.GetByID(ctx, id)
	if err != nil {
		return InstructorView{}, err
	}
	return out, nil
}

// Update applies a partial update. The NestJS source does the same
// "read first, merge, then write" pattern so unchanged fields survive.
func (s *Service) Update(ctx context.Context, id string, in UpdateInput) (InstructorView, error) {
	before, err := s.repo.q.GetInstructorByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return InstructorView{}, errs.NotFound("Instructor not found")
		}
		return InstructorView{}, errs.Internal("lookup instructor", err)
	}
	if in.ContactEmail != nil && *in.ContactEmail != "" {
		if _, err := mail.ParseAddress(*in.ContactEmail); err != nil {
			return InstructorView{}, errs.BadRequest("contactEmail is not a valid email")
		}
	}

	// Slug change → ensure unique (allow same slug when unchanged).
	slug := before.Slug
	if in.Slug != nil && *in.Slug != "" && *in.Slug != before.Slug {
		slug, err = s.ensureUniqueSlug(ctx, *in.Slug, id)
		if err != nil {
			return InstructorView{}, err
		}
	}

	// publishedAt transition.
	publishedAt := before.PublishedAt
	if in.Published != nil {
		if *in.Published {
			publishedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
		} else {
			publishedAt = sql.NullTime{}
		}
	}

	// Merge each field — *in.X overrides before.X when non-nil.
	now := time.Now().UTC()
	params := db.UpdateInstructorParams{
		Slug:              slug,
		Name:              strDeref(in.Name, before.Name),
		NameEn:            nsMerge(in.NameEn, before.NameEn),
		Title:             nsMerge(in.Title, before.Title),
		TitleEn:           nsMerge(in.TitleEn, before.TitleEn),
		Headline:          nsMerge(in.Headline, before.Headline),
		HeadlineEn:        nsMerge(in.HeadlineEn, before.HeadlineEn),
		Bio:               nsMerge(in.Bio, before.Bio),
		BioEn:             nsMerge(in.BioEn, before.BioEn),
		AvatarUrl:         nsMerge(in.AvatarURL, before.AvatarUrl),
		Company:           nsMerge(in.Company, before.Company),
		YearsOfExperience: ni32Merge(in.YearsOfExperience, before.YearsOfExperience),
		LinkedinUrl:       nsMerge(in.LinkedinURL, before.LinkedinUrl),
		GithubUrl:         nsMerge(in.GithubURL, before.GithubUrl),
		TwitterUrl:        nsMerge(in.TwitterURL, before.TwitterUrl),
		WebsiteUrl:        nsMerge(in.WebsiteURL, before.WebsiteUrl),
		ContactEmail:      nsMerge(in.ContactEmail, before.ContactEmail),
		Notes:             nsMerge(in.Notes, before.Notes),
		OrderIndex:        i32Deref(in.OrderIndex, before.OrderIndex),
		PublishedAt:       publishedAt,
		UpdatedAt:         now,
		ID:                id,
	}
	if err := s.repo.q.UpdateInstructor(ctx, params); err != nil {
		return InstructorView{}, errs.Internal("update instructor", err)
	}
	s.writeAudit(ctx, "instructor.update", id)
	return s.GetByID(ctx, id)
}

// SoftDelete sets published_at = NULL and unlinks all course
// associations. The NestJS source does this in a $transaction; here
// we run the two queries back-to-back because the FKs are ON DELETE
// CASCADE and any interleaved failure leaves the instructor intact.
func (s *Service) SoftDelete(ctx context.Context, id string) (InstructorView, error) {
	if _, err := s.repo.q.GetInstructorByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return InstructorView{}, errs.NotFound("Instructor not found")
		}
		return InstructorView{}, errs.Internal("lookup instructor", err)
	}
	now := time.Now().UTC()
	if err := s.repo.q.SoftDeleteInstructor(ctx, db.SoftDeleteInstructorParams{
		UpdatedAt: now, ID: id,
	}); err != nil {
		return InstructorView{}, errs.Internal("soft delete instructor", err)
	}
	if err := s.repo.q.DeleteCourseInstructorLinksByInstructor(ctx, id); err != nil {
		return InstructorView{}, errs.Internal("unlink courses", err)
	}
	s.writeAudit(ctx, "instructor.softDelete", id)
	return s.GetByID(ctx, id)
}

// Reorder updates order_index for each id in the supplied list. The
// NestJS source uses $transaction(Promise.all) so all updates succeed
// or none do. sqlc doesn't expose the transaction helper here, so we
// run them in a database/sql tx directly.
func (s *Service) Reorder(ctx context.Context, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, errs.BadRequest("orderedIds is required")
	}
	// Verify all IDs exist before touching anything.
	rows, err := s.repo.conn.QueryContext(ctx,
		`SELECT id FROM instructors WHERE id IN (`+placeholders(len(ids))+`)`,
		toAnySlice(ids)...)
	if err != nil {
		return 0, errs.Internal("verify reorder ids", err)
	}
	defer rows.Close()
	found := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return 0, errs.Internal("scan ids", err)
		}
		found[id] = true
	}
	if err := rows.Err(); err != nil {
		return 0, errs.Internal("iterate ids", err)
	}
	missing := []string{}
	for _, id := range ids {
		if !found[id] {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		return 0, errs.BadRequest("部分讲师 ID 不存在: " + strings.Join(missing, ", "))
	}

	tx, err := s.repo.conn.BeginTx(ctx, nil)
	if err != nil {
		return 0, errs.Internal("begin tx", err)
	}
	defer tx.Rollback() //nolint:errcheck
	q := db.New(tx)
	now := time.Now().UTC()
	for i, id := range ids {
		if err := q.SetInstructorOrderIndex(ctx, db.SetInstructorOrderIndexParams{
			OrderIndex: int32(i), UpdatedAt: now, ID: id,
		}); err != nil {
			return 0, errs.Internal("reorder", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, errs.Internal("commit reorder tx", err)
	}
	s.writeAudit(ctx, "instructor.reorder", "")
	return len(ids), nil
}

// =============================================================
// Course-link operations (instructor-centric URLs per T20 spec)
// =============================================================

// ListCourseLinks returns the links for a given instructor, with course
// info joined in for the admin UI.
func (s *Service) ListCourseLinks(ctx context.Context, instructorID string) ([]CourseInstructorLinkView, error) {
	if _, err := s.repo.q.GetInstructorByID(ctx, instructorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("Instructor not found")
		}
		return nil, errs.Internal("verify instructor", err)
	}
	rows, err := s.repo.q.ListCourseInstructorLinksByInstructorWithCourse(ctx, instructorID)
	if err != nil {
		return nil, errs.Internal("list course links", err)
	}
	out := make([]CourseInstructorLinkView, 0, len(rows))
	for _, r := range rows {
		out = append(out, courseLinkRowToView(r))
	}
	return out, nil
}

// AddCourseLink attaches a (course, instructor) pair with a role + isPrimary
// flag. Mirrors the NestJS linkToCourse: if isPrimary is true and role
// is "instructor", clear isPrimary on the other links of the same
// (course, role).
func (s *Service) AddCourseLink(ctx context.Context, instructorID string, in LinkCourseInput) (CourseInstructorLinkView, error) {
	if in.CourseID == "" {
		return CourseInstructorLinkView{}, errs.BadRequest("courseId is required")
	}
	role, err := parseInstructorRole(in.Role)
	if err != nil {
		return CourseInstructorLinkView{}, err
	}
	if _, err := s.repo.q.GetInstructorByID(ctx, instructorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CourseInstructorLinkView{}, errs.NotFound("Instructor not found")
		}
		return CourseInstructorLinkView{}, errs.Internal("verify instructor", err)
	}
	// Verify course exists. Direct SQL keeps the dependency on the
	// courses sqlc queries out of this package for T20.
	var courseID string
	err = s.repo.conn.QueryRowContext(ctx, `SELECT id FROM courses WHERE id = ?`, in.CourseID).Scan(&courseID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CourseInstructorLinkView{}, errs.NotFound("Course not found")
		}
		return CourseInstructorLinkView{}, errs.Internal("verify course", err)
	}

	// role=mentor → force isPrimary=false (NestJS rule).
	isPrimary := in.IsPrimary
	if role == db.CourseInstructorLinksRoleMentor {
		isPrimary = false
	}

	id := generateLinkID()
	now := time.Now().UTC()
	if _, err := s.repo.q.UpsertCourseInstructorLink(ctx, db.UpsertCourseInstructorLinkParams{
		ID:           id,
		CourseID:     in.CourseID,
		InstructorID: instructorID,
		Role:         role,
		IsPrimary:    isPrimary,
		OrderIndex:   in.OrderIndex,
		CreatedAt:    now,
	}); err != nil {
		return CourseInstructorLinkView{}, errs.Internal("upsert link", err)
	}

	if isPrimary {
		// Find the row we just upserted so the clear excludes the
		// right id (the unique key is course+instructor+role).
		var insertedID string
		err := s.repo.conn.QueryRowContext(ctx, `
			SELECT id FROM course_instructor_links
			WHERE course_id = ? AND instructor_id = ? AND role = ?
			LIMIT 1
		`, in.CourseID, instructorID, role).Scan(&insertedID)
		if err == nil {
			if err := s.repo.q.ClearPrimaryInstructorForRole(ctx, db.ClearPrimaryInstructorForRoleParams{
				CourseID: in.CourseID, Role: role, ID: insertedID,
			}); err != nil {
				return CourseInstructorLinkView{}, errs.Internal("clear primary", err)
			}
		}
	}
	s.writeAudit(ctx, "instructor.link", id)

	// Re-read for the response.
	link, err := s.repo.q.GetCourseInstructorLinkByID(ctx, id)
	if err != nil {
		// The unique (course, instructor, role) could mean we re-used
		// the id of a previous link in a race. Re-read by (course, instructor, role).
		link, err = s.lookupLinkByTriple(ctx, in.CourseID, instructorID, role)
		if err != nil {
			return CourseInstructorLinkView{}, errs.Internal("read back link", err)
		}
	}
	return s.decorateLink(ctx, link)
}

// RemoveCourseLink deletes a single link. Verified to belong to the
// path-param instructor (defense in depth; admin URL is
// /admin/instructors/:id/course-links?linkId=X so the URL itself
// already constrains this).
func (s *Service) RemoveCourseLink(ctx context.Context, linkID string) error {
	link, err := s.repo.q.GetCourseInstructorLinkByID(ctx, linkID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errs.NotFound("Link not found")
		}
		return errs.Internal("lookup link", err)
	}
	if err := s.repo.q.DeleteCourseInstructorLink(ctx, linkID); err != nil {
		return errs.Internal("delete link", err)
	}
	s.writeAudit(ctx, "instructor.unlink", linkID)
	_ = link // silence
	return nil
}

// SyncCourseLinks replaces the entire link set for an instructor.
// Mirrors NestJS syncCourseLinks: delete-all-then-create inside a tx.
// Primary-instructor constraint: per-role at most 1 link with isPrimary=true
// across the *course* — but since we're scoped to one instructor here,
// the constraint is much simpler: among the new links for this
// instructor, at most one (instructor role) can be primary.
func (s *Service) SyncCourseLinks(ctx context.Context, instructorID string, in SyncLinksInput) ([]CourseInstructorLinkView, error) {
	if _, err := s.repo.q.GetInstructorByID(ctx, instructorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("Instructor not found")
		}
		return nil, errs.Internal("verify instructor", err)
	}
	// Validate roles + primary constraint (instructor role only).
	primarySeen := map[string]bool{}
	for i, l := range in.Links {
		if l.CourseID == "" {
			return nil, errs.BadRequest("links[" + strconv.Itoa(i) + "].courseId is required")
		}
		if _, err := parseInstructorRole(l.Role); err != nil {
			return nil, errs.BadRequest("links[" + strconv.Itoa(i) + "].role: " + err.Error())
		}
		if l.IsPrimary && l.Role == "instructor" {
			if primarySeen["instructor"] {
				return nil, errs.BadRequest("同 role=instructor 只能有 1 个主讲师")
			}
			primarySeen["instructor"] = true
		}
	}

	tx, err := s.repo.conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, errs.Internal("begin tx", err)
	}
	defer tx.Rollback() //nolint:errcheck
	q := db.New(tx)
	if err := q.DeleteCourseInstructorLinksByInstructor(ctx, instructorID); err != nil {
		return nil, errs.Internal("delete old links", err)
	}
	now := time.Now().UTC()
	created := []db.CourseInstructorLink{}
	for _, l := range in.Links {
		role, _ := parseInstructorRole(l.Role) // already validated above
		isPrimary := l.IsPrimary
		if role == db.CourseInstructorLinksRoleMentor {
			isPrimary = false
		}
		id := generateLinkID()
		if _, err := q.CreateCourseInstructorLink(ctx, db.CreateCourseInstructorLinkParams{
			ID:           id,
			CourseID:     l.CourseID,
			InstructorID: instructorID,
			Role:         role,
			IsPrimary:    isPrimary,
			OrderIndex:   l.OrderIndex,
			CreatedAt:    now,
		}); err != nil {
			return nil, errs.Internal("insert link", err)
		}
		created = append(created, db.CourseInstructorLink{
			ID: id, CourseID: l.CourseID, InstructorID: instructorID,
			Role: role, IsPrimary: isPrimary, OrderIndex: l.OrderIndex,
			CreatedAt: now,
		})
	}
	if err := tx.Commit(); err != nil {
		return nil, errs.Internal("commit sync tx", err)
	}
	s.writeAudit(ctx, "instructor.syncLinks", instructorID)

	// Build the response shape with course info joined.
	out := make([]CourseInstructorLinkView, 0, len(created))
	for _, c := range created {
		view, err := s.decorateLink(ctx, c)
		if err != nil {
			// Fall back to bare link if the course row vanished mid-flight.
			out = append(out, bareLinkView(c))
			continue
		}
		out = append(out, view)
	}
	return out, nil
}

// =============================================================
// helpers
// =============================================================

// ensureUniqueSlug appends -N (or a sha1 suffix) until the candidate is
// free, or returns excludeId when the existing match is the same row.
func (s *Service) ensureUniqueSlug(ctx context.Context, base, excludeID string) (string, error) {
	if base == "" {
		return "", errs.BadRequest("slug cannot be empty")
	}
	for i := 0; i < 100; i++ {
		candidate := base
		if i > 0 {
			candidate = base + "-" + strconv.Itoa(i)
		}
		existing, err := s.repo.q.GetInstructorBySlugAny(ctx, candidate)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return candidate, nil
			}
			return "", errs.Internal("slug uniqueness check", err)
		}
		if existing.ID == excludeID {
			return candidate, nil
		}
	}
	// Pathological — fall back to a hash so we never deadlock.
	h := sha1.Sum([]byte(base + strconv.FormatInt(time.Now().UnixNano(), 10)))
	return base + "-" + hex.EncodeToString(h[:3]), nil
}

// lookupLinkByTriple fetches a link by its natural unique key.
func (s *Service) lookupLinkByTriple(ctx context.Context, courseID, instructorID string, role db.CourseInstructorLinksRole) (db.CourseInstructorLink, error) {
	rows, err := s.repo.conn.QueryContext(ctx, `
		SELECT id, course_id, instructor_id, role, is_primary, order_index, created_at
		FROM course_instructor_links
		WHERE course_id = ? AND instructor_id = ? AND role = ?
		LIMIT 1
	`, courseID, instructorID, role)
	if err != nil {
		return db.CourseInstructorLink{}, err
	}
	defer rows.Close()
	if !rows.Next() {
		return db.CourseInstructorLink{}, sql.ErrNoRows
	}
	var l db.CourseInstructorLink
	if err := rows.Scan(&l.ID, &l.CourseID, &l.InstructorID, &l.Role, &l.IsPrimary, &l.OrderIndex, &l.CreatedAt); err != nil {
		return db.CourseInstructorLink{}, err
	}
	return l, nil
}

// decorateLink joins course info into a single-link view.
func (s *Service) decorateLink(ctx context.Context, l db.CourseInstructorLink) (CourseInstructorLinkView, error) {
	var (
		title, status, thumb, level, costType sql.NullString
	)
	err := s.repo.conn.QueryRowContext(ctx, `
		SELECT title, status, thumbnail, level, cost_type
		FROM courses WHERE id = ?
	`, l.CourseID).Scan(&title, &status, &thumb, &level, &costType)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return bareLinkView(l), err
	}
	return CourseInstructorLinkView{
		ID:              l.ID,
		CourseID:        l.CourseID,
		InstructorID:    l.InstructorID,
		Role:            string(l.Role),
		IsPrimary:       l.IsPrimary,
		OrderIndex:      l.OrderIndex,
		CreatedAt:       l.CreatedAt,
		CourseTitle:     nullStrPtr(title),
		CourseStatus:    nullStrPtr(status),
		CourseThumbnail: nullStrPtr(thumb),
		CourseLevel:     nullStrPtr(level),
		CourseCostType:  nullStrPtr(costType),
	}, nil
}

// writeAudit is a best-effort write to the audit_logs table. Mirrors
// the courses service pattern.
func (s *Service) writeAudit(ctx context.Context, action, entityID string) {
	_, err := s.repo.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, entity, entity_id, created_at)
		VALUES (UUID(), ?, 'instructor', ?, NOW(3))
	`, action, entityID)
	if err != nil {
		s.log.Warn("audit log write failed", zap.String("action", action), zap.Error(err))
	}
}

// slugifyName mirrors the NestJS ASCII slugifier. Non-ASCII names
// fall back to `i-<sha1-4>` (the NestJS hash branch).
var slugNonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

func slugifyName(name string) string {
	ascii := slugNonAlnum.ReplaceAllString(strings.ToLower(name), "-")
	ascii = strings.Trim(ascii, "-")
	if ascii == "" {
		h := sha1.Sum([]byte(name))
		return "i-" + hex.EncodeToString(h[:2])
	}
	if len(ascii) > 40 {
		ascii = ascii[:40]
	}
	return ascii
}

// generateInstructorID uses the same "c" prefix as Prisma's cuid() so
// the IDs look native to MySQL tools that grep for `c[a-z0-9]{24}`.
func generateInstructorID() string {
	return "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
}

// generateLinkID does the same for the link rows.
func generateLinkID() string {
	return "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
}

func parseInstructorRole(s string) (db.CourseInstructorLinksRole, error) {
	switch s {
	case "instructor", "":
		return db.CourseInstructorLinksRoleInstructor, nil
	case "mentor":
		return db.CourseInstructorLinksRoleMentor, nil
	}
	return "", errs.BadRequest("role must be one of instructor|mentor")
}

// scanInstructor is the explicit *sql.Rows → db.Instructor scanner
// (used for the dynamic list query; static sqlc queries do their own).
func scanInstructor(x *db.Instructor, rows *sql.Rows) error {
	return rows.Scan(
		&x.ID, &x.Slug, &x.Name, &x.NameEn, &x.Title, &x.TitleEn,
		&x.Headline, &x.HeadlineEn, &x.Bio, &x.BioEn,
		&x.AvatarUrl, &x.Company, &x.YearsOfExperience,
		&x.LinkedinUrl, &x.GithubUrl, &x.TwitterUrl, &x.WebsiteUrl,
		&x.ContactEmail, &x.Notes, &x.OrderIndex,
		&x.PublishedAt, &x.CreatedAt, &x.UpdatedAt,
	)
}

// instructorToView converts the sqlc row into the public JSON shape.
func instructorToView(x db.Instructor) InstructorView {
	return InstructorView{
		ID:                x.ID,
		Slug:              x.Slug,
		Name:              x.Name,
		NameEn:            nullStrPtr(x.NameEn),
		Title:             nullStrPtr(x.Title),
		TitleEn:           nullStrPtr(x.TitleEn),
		Headline:          nullStrPtr(x.Headline),
		HeadlineEn:        nullStrPtr(x.HeadlineEn),
		Bio:               nullStrPtr(x.Bio),
		BioEn:             nullStrPtr(x.BioEn),
		AvatarURL:         nullStrPtr(x.AvatarUrl),
		Company:           nullStrPtr(x.Company),
		YearsOfExperience: nullInt32Ptr(x.YearsOfExperience),
		LinkedinURL:       nullStrPtr(x.LinkedinUrl),
		GithubURL:         nullStrPtr(x.GithubUrl),
		TwitterURL:        nullStrPtr(x.TwitterUrl),
		WebsiteURL:        nullStrPtr(x.WebsiteUrl),
		ContactEmail:      nullStrPtr(x.ContactEmail),
		Notes:             nullStrPtr(x.Notes),
		OrderIndex:        x.OrderIndex,
		PublishedAt:       nullTimePtr(x.PublishedAt),
		CreatedAt:         x.CreatedAt,
		UpdatedAt:         x.UpdatedAt,
	}
}

// courseLinkRowToView converts the joined-row into the public shape.
func courseLinkRowToView(r db.ListCourseInstructorLinksByInstructorWithCourseRow) CourseInstructorLinkView {
	title := r.CourseTitle
	status := string(r.CourseStatus)
	thumb := r.CourseThumbnail
	level := string(r.CourseLevel)
	cost := string(r.CourseCostType)
	return CourseInstructorLinkView{
		ID:              r.CilID,
		CourseID:        r.CilCourseID,
		InstructorID:    r.CilInstructorID,
		Role:            string(r.CilRole),
		IsPrimary:       r.CilIsPrimary,
		OrderIndex:      r.CilOrderIndex,
		CreatedAt:       r.CilCreatedAt,
		CourseTitle:     strPtr(title),
		CourseStatus:    strPtr(status),
		CourseThumbnail: strPtr(thumb),
		CourseLevel:     strPtr(level),
		CourseCostType:  strPtr(cost),
	}
}

// bareLinkView produces a view without joined course info.
func bareLinkView(l db.CourseInstructorLink) CourseInstructorLinkView {
	return CourseInstructorLinkView{
		ID:           l.ID,
		CourseID:     l.CourseID,
		InstructorID: l.InstructorID,
		Role:         string(l.Role),
		IsPrimary:    l.IsPrimary,
		OrderIndex:   l.OrderIndex,
		CreatedAt:    l.CreatedAt,
	}
}

// ============ small sql.Null helpers ============

func ns(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

func nsMerge(in *string, before sql.NullString) sql.NullString {
	if in == nil {
		return before
	}
	if *in == "" {
		return sql.NullString{} // explicit clear
	}
	return sql.NullString{String: *in, Valid: true}
}

func ni32(in *int32) sql.NullInt32 {
	if in == nil {
		return sql.NullInt32{}
	}
	return sql.NullInt32{Int32: *in, Valid: true}
}

func ni32Merge(in *int32, before sql.NullInt32) sql.NullInt32 {
	if in == nil {
		return before
	}
	return sql.NullInt32{Int32: *in, Valid: true}
}

func i32Deref(in *int32, fallback int32) int32 {
	if in == nil {
		return fallback
	}
	return *in
}

func strDeref(in *string, fallback string) string {
	if in == nil || *in == "" {
		return fallback
	}
	return *in
}

func nullStrPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullInt32Ptr(s sql.NullInt32) *int32 {
	if !s.Valid {
		return nil
	}
	v := s.Int32
	return &v
}

func nullTimePtr(s sql.NullTime) *time.Time {
	if !s.Valid {
		return nil
	}
	t := s.Time
	return &t
}

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat("?,", n-1) + "?"
}

func toAnySlice(in []string) []any {
	out := make([]any, len(in))
	for i, s := range in {
		out[i] = s
	}
	return out
}
