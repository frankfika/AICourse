// Package site — public site-wide statistics (homepage / AuthShell hero).
//
// Phase 2 T22: ports the single endpoint of
// apps/api/src/modules/site/site.controller.ts.
//
// Route:
//
//	GET /api/v1/site/stats   public, no auth
//
// The NestJS service runs 7 parallel Prisma aggregations against
// users / courses / practice_completions / nano_degrees / hackathons
// and derives a "term label" (春季/夏季/秋季/冬季) from the latest
// active/upcoming hackathon start date.
//
// In Go we use raw conn.QueryContext for the aggregations (they're
// one-off and don't need a sqlc round-trip per call). The featured
// course is picked by enrollment count, falling back to most recent
// published course when no enrollments exist — same logic as the
// NestJS orderBy.
package site

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
)

// Stats is the public JSON shape returned by GET /api/v1/site/stats.
type Stats struct {
	ActiveLearners       int64       `json:"activeLearners"`
	TotalCourses         int64       `json:"totalCourses"`
	TotalProjects        int64       `json:"totalProjects"`
	TotalDegrees         int64       `json:"totalDegrees"`
	ActiveHackathonCount int64       `json:"activeHackathonCount"`
	CurrentTermLabel     string      `json:"currentTermLabel"`
	FeaturedCourse       *CourseCard `json:"featuredCourse"`
}

// CourseCard is the trimmed course shape used for the homepage
// recommendation. Counts are flat integers to match the NestJS shape.
type CourseCard struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Description     *string `json:"description,omitempty"`
	Level           string  `json:"level"`
	Duration        string  `json:"duration"`
	Instructor      string  `json:"instructor"`
	Tags            string  `json:"tags"`
	Thumbnail       *string `json:"thumbnail,omitempty"`
	EnrollmentCount int64   `json:"enrollmentCount"`
	ChapterCount    int64   `json:"chapterCount"`
	ModuleCount     int64   `json:"moduleCount"` // mirror of chapterCount, see NestJS site.service.ts:82
}

// Service is the site-stats business logic.
type Service struct {
	conn *sql.DB
}

// NewService builds a Service.
func NewService(conn *sql.DB) *Service {
	return &Service{conn: conn}
}

// GetStats returns the homepage / AuthShell hero numbers. Errors are
// wrapped via errs.Internal so the global errs.Handler can render
// the standard NestJS-shaped envelope.
func (s *Service) GetStats(ctx context.Context) (Stats, error) {
	var (
		activeLearners       int64
		totalCourses         int64
		totalProjects        int64
		totalDegrees         int64
		activeHackathonCount int64
		latestStart          sql.NullTime
		featured             *CourseCard
	)

	// 1) activeLearners — student + instructor users, excludes admin.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users WHERE role IN ('student','instructor') AND deleted_at IS NULL`,
	).Scan(&activeLearners); err != nil {
		return Stats{}, errs.Internal("count active learners", err)
	}

	// 2) totalCourses — published only. courses has no soft-delete
	//    column (only `chapters` / `enrollments` / `users` do), so
	//    we filter on status alone.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM courses WHERE status = 'published'`,
	).Scan(&totalCourses); err != nil {
		return Stats{}, errs.Internal("count published courses", err)
	}

	// 3) totalProjects — practice completions (any status). Mirrors
	//    NestJS's prisma.practiceCompletion.count() which has no
	//    filter.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM practice_completions`,
	).Scan(&totalProjects); err != nil {
		return Stats{}, errs.Internal("count practice completions", err)
	}

	// 4) totalDegrees — nano_degrees (any status). nano_degrees has
	//    no soft-delete column.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM nano_degrees`,
	).Scan(&totalDegrees); err != nil {
		return Stats{}, errs.Internal("count nano degrees", err)
	}

	// 5) activeHackathonCount — active + upcoming.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM hackathons WHERE status IN ('active','upcoming')`,
	).Scan(&activeHackathonCount); err != nil {
		return Stats{}, errs.Internal("count active hackathons", err)
	}

	// 6) featured course — published, ordered by enrollment count desc,
	// fallback to created_at desc. Returns NULL when no published
	// course exists (early-stage DB).
	featured, err := s.loadFeaturedCourse(ctx)
	if err != nil {
		return Stats{}, errs.Internal("load featured course", err)
	}

	// 7) latest active/upcoming hackathon start date — drives term label.
	if err := s.conn.QueryRowContext(ctx,
		`SELECT MIN(start_date) FROM hackathons WHERE status IN ('active','upcoming')`,
	).Scan(&latestStart); err != nil {
		// MIN over an empty set returns NULL, no row error — but if
		// the query itself errors (e.g. broken conn) we surface it.
		return Stats{}, errs.Internal("load latest hackathon start", err)
	}

	termDate := time.Now().UTC()
	if latestStart.Valid {
		termDate = latestStart.Time
	}

	return Stats{
		ActiveLearners:       activeLearners,
		TotalCourses:         totalCourses,
		TotalProjects:        totalProjects,
		TotalDegrees:         totalDegrees,
		ActiveHackathonCount: activeHackathonCount,
		CurrentTermLabel:     deriveTermLabel(termDate),
		FeaturedCourse:       featured,
	}, nil
}

// loadFeaturedCourse picks the published course with the most
// enrollments. When multiple courses have zero enrollments, the
// orderBy tiebreak is created_at DESC (newest first). Returns nil
// (not error) when no published course exists.
func (s *Service) loadFeaturedCourse(ctx context.Context) (*CourseCard, error) {
	row := s.conn.QueryRowContext(ctx, `
		SELECT
			c.id, c.title, c.description, c.level, c.duration, c.instructor, c.tags, c.thumbnail,
			(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.deleted_at IS NULL) AS enrollment_count,
			(SELECT COUNT(*) FROM chapters ch WHERE ch.course_id = c.id AND ch.deleted_at IS NULL) AS chapter_count
		FROM courses c
		WHERE c.status = 'published'
		ORDER BY enrollment_count DESC, c.created_at DESC
		LIMIT 1
	`)
	var (
		card    CourseCard
		descNS  sql.NullString
		thumbNS sql.NullString
	)
	if err := row.Scan(
		&card.ID, &card.Title, &descNS, &card.Level, &card.Duration,
		&card.Instructor, &card.Tags, &thumbNS,
		&card.EnrollmentCount, &card.ChapterCount,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan featured course: %w", err)
	}
	if descNS.Valid {
		s := descNS.String
		card.Description = &s
	}
	if thumbNS.Valid {
		s := thumbNS.String
		card.Thumbnail = &s
	}
	card.ModuleCount = card.ChapterCount // mirrors NestJS site.service.ts:82 alias
	return &card, nil
}

// deriveTermLabel returns "<year> <season>" for a date.
// 3-5月 → 春季, 6-8月 → 夏季, 9-11月 → 秋季, 12-2月 → 冬季.
// Mirrors NestJS site.service.ts:deriveTermLabel verbatim.
func deriveTermLabel(d time.Time) string {
	d = d.UTC()
	month := int(d.Month())
	year := d.Year()
	var term string
	switch {
	case month <= 5:
		term = "春季"
	case month <= 8:
		term = "夏季"
	case month <= 11:
		term = "秋季"
	default:
		term = "冬季"
	}
	return fmt.Sprintf("%d %s", year, term)
}
