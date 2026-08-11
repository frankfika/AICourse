// Package admin — admin dashboard statistics. Mirrors
// apps/api/src/modules/admin/admin.service.ts 1:1.
//
// Phase 2 T24: 1 endpoint (admin only).
//
//	GET /api/v1/admin/stats
//
// Returns 4 KPI numbers + 4 chart series + 2 todo counters + system
// status + 30-day user growth. The NestJS service fans out 15
// Promise.all queries; we do the same with raw conn aggregations
// because each is a single COUNT/SUM and the composition doesn't
// benefit from a sqlc round-trip. The site module (T22) uses the
// same pattern.
package admin

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
)

// Stats is the admin dashboard JSON shape. Field names mirror the
// NestJS service.getStats() response keys.
type Stats struct {
	KPIs       []KPI              `json:"kpis"`
	TopCourses []TopCourse        `json:"topCourses"`
	Totals     Totals             `json:"totals"`
	Todos      Todos              `json:"todos"`
	System     SystemStatus       `json:"system"`
	UserGrowth []UserGrowthBucket `json:"userGrowth"`
}

// KPI is one of the 4 dashboard headline numbers.
type KPI struct {
	Label     string `json:"label"`
	Value     string `json:"value"`
	Delta     string `json:"delta"`
	DeltaTone string `json:"deltaTone"`
	Sub       string `json:"sub"`
}

// TopCourse is a row of the "courses by enrollment" leaderboard.
type TopCourse struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	EnrollmentCount int64  `json:"enrollmentCount"`
}

// Totals are the rollup numbers.
type Totals struct {
	Users                int64   `json:"users"`
	Courses              int64   `json:"courses"`
	ActiveEnrollments    int64   `json:"activeEnrollments"`
	CompletedEnrollments int64   `json:"completedEnrollments"`
	CompletionRate       float64 `json:"completionRate"`
}

// Todos are the "needs attention" counters.
type Todos struct {
	PendingInquiries int64 `json:"pendingInquiries"`
	DraftCourses     int64 `json:"draftCourses"`
}

// SystemStatus is the liveness block.
type SystemStatus struct {
	Database   string `json:"database"`
	APIVersion string `json:"apiVersion"`
	LastDeploy string `json:"lastDeploy"`
}

// UserGrowthBucket is one day in the 30-day user-growth series.
type UserGrowthBucket struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// Service is the dashboard aggregator.
type Service struct {
	conn       *sql.DB
	apiVersion string
	lastDeploy string
}

// NewService builds a Service.
func NewService(conn *sql.DB, apiVersion string) *Service {
	return &Service{conn: conn, apiVersion: apiVersion, lastDeploy: "—"}
}

// GetStats returns the dashboard payload. Mirrors admin.service.ts
// step-for-step:
//
//  1. today/yesterday/t-30d boundary math on the app side
//  2. 14 parallel aggregations (Promise.all in NestJS, sequential
//     conn.QueryContext in Go — the queries are short, parallelism
//     doesn't matter for a single-request latency budget)
//  3. derived metrics (gmvDelta, userDelta, paidConvRate,
//     completionRate)
//  4. a follow-up query for the 30-day user-growth buckets
func (s *Service) GetStats(ctx context.Context) (Stats, error) {
	now := time.Now().UTC()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	yesterdayStart := todayStart.Add(-24 * time.Hour)
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)

	// 1) today paid orders
	var todayPaidSum sql.NullFloat64
	var todayPaidCount int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0), COUNT(*)
		FROM orders
		WHERE status = 'paid' AND paid_at >= ? AND deleted_at IS NULL
	`, todayStart).Scan(&todayPaidSum, &todayPaidCount); err != nil {
		return Stats{}, errs.Internal("today paid orders", err)
	}

	// 2) yesterday paid orders
	var yesterdayPaidSum sql.NullFloat64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM orders
		WHERE status = 'paid' AND paid_at >= ? AND paid_at < ? AND deleted_at IS NULL
	`, yesterdayStart, todayStart).Scan(&yesterdayPaidSum); err != nil {
		return Stats{}, errs.Internal("yesterday paid orders", err)
	}

	// 3) new users today
	var newUsersToday int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM users
		WHERE created_at >= ? AND deleted_at IS NULL
	`, todayStart).Scan(&newUsersToday); err != nil {
		return Stats{}, errs.Internal("new users today", err)
	}

	// 4) new users yesterday
	var newUsersYesterday int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM users
		WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL
	`, yesterdayStart, todayStart).Scan(&newUsersYesterday); err != nil {
		return Stats{}, errs.Internal("new users yesterday", err)
	}

	// 5) paid users today (student + instructor)
	var paidUsersToday int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM users
		WHERE created_at >= ? AND role IN ('student', 'instructor') AND deleted_at IS NULL
	`, todayStart).Scan(&paidUsersToday); err != nil {
		return Stats{}, errs.Internal("paid users today", err)
	}

	// 6) DAU — distinct users with progress updated today
	var dauUsers int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM progress_records
		WHERE updated_at >= ?
	`, todayStart).Scan(&dauUsers); err != nil {
		return Stats{}, errs.Internal("DAU", err)
	}

	// 7) avg learning minutes — proxy: completed progress records
	// today * 25 min (matches NestJS heuristic).
	var avgLearningMinutes int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM progress_records
		WHERE status = 'completed' AND completed_at >= ?
	`, todayStart).Scan(&avgLearningMinutes); err != nil {
		return Stats{}, errs.Internal("completed lessons today", err)
	}

	// 8) course enrollment top-10
	top, err := s.loadTopCourses(ctx)
	if err != nil {
		return Stats{}, errs.Internal("top courses", err)
	}

	// 9) total paid orders
	var totalPaidSum sql.NullFloat64
	var totalPaidCount int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM orders
		WHERE status = 'paid' AND deleted_at IS NULL
	`).Scan(&totalPaidSum, &totalPaidCount); err != nil {
		return Stats{}, errs.Internal("total paid orders", err)
	}

	// 10) total courses
	var totalCourses int64
	if err := s.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM courses`).Scan(&totalCourses); err != nil {
		return Stats{}, errs.Internal("total courses", err)
	}

	// 11) total users
	var totalUsers int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM users WHERE deleted_at IS NULL
	`).Scan(&totalUsers); err != nil {
		return Stats{}, errs.Internal("total users", err)
	}

	// 12) active enrollments (expires_at is NULL — mirrors the
	// NestJS `prisma.enrollment.count({ where: { expiresAt: null } })`).
	// enrollments has deleted_at (per the AICourse schema T22 audit),
	// so we filter on that too.
	var activeEnrollments int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM enrollments
		WHERE expires_at IS NULL AND deleted_at IS NULL
	`).Scan(&activeEnrollments); err != nil {
		return Stats{}, errs.Internal("active enrollments", err)
	}

	// 13) completed enrollments — NestJS uses `prisma.certificate.count()`
	// as a proxy. certificates have no deleted_at column.
	var completedEnrollments int64
	if err := s.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM certificates`).Scan(&completedEnrollments); err != nil {
		return Stats{}, errs.Internal("completed enrollments", err)
	}

	// 14) pending enterprise inquiries
	var pendingInquiries int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM enterprise_inquiries
		WHERE status = 'pending' AND deleted_at IS NULL
	`).Scan(&pendingInquiries); err != nil {
		return Stats{}, errs.Internal("pending inquiries", err)
	}

	// 15) DB ping
	dbStatus := "ok"
	if err := s.conn.PingContext(ctx); err != nil {
		dbStatus = "down"
	}

	// === derived metrics ===
	todayGmv := todayPaidSum.Float64
	yesterdayGmv := yesterdayPaidSum.Float64
	gmvDelta := 0.0
	if yesterdayGmv > 0 {
		gmvDelta = ((todayGmv - yesterdayGmv) / yesterdayGmv) * 100
	}
	userDelta := 0.0
	if newUsersYesterday > 0 {
		userDelta = (float64(newUsersToday-newUsersYesterday) / float64(newUsersYesterday)) * 100
	}
	paidConvRate := 0.0
	if newUsersToday > 0 {
		paidConvRate = (float64(paidUsersToday) / float64(newUsersToday)) * 100
	}
	completionRate := 0.0
	if activeEnrollments+completedEnrollments > 0 {
		completionRate = (float64(completedEnrollments) / float64(activeEnrollments+completedEnrollments)) * 100
	}

	// 16) draft courses
	var draftCourses int64
	if err := s.conn.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM courses WHERE status = 'draft'
	`).Scan(&draftCourses); err != nil {
		return Stats{}, errs.Internal("draft courses", err)
	}

	// 17) 30-day user growth series
	growth, err := s.loadUserGrowth(ctx, thirtyDaysAgo)
	if err != nil {
		return Stats{}, errs.Internal("user growth", err)
	}

	return Stats{
		KPIs: []KPI{
			{
				Label:     "今日 GMV",
				Value:     fmt.Sprintf("¥ %s", formatInt(int64(todayGmv))),
				Delta:     formatDelta(gmvDelta),
				DeltaTone: deltaTone(gmvDelta),
				Sub:       fmt.Sprintf("较昨日 ¥ %s", formatInt(int64(yesterdayGmv))),
			},
			{
				Label:     "新增用户",
				Value:     fmt.Sprintf("%d", newUsersToday),
				Delta:     formatDelta(userDelta),
				DeltaTone: deltaTone(userDelta),
				Sub:       fmt.Sprintf("其中付费 %d · %.1f%%", paidUsersToday, paidConvRate),
			},
			{
				Label:     "活跃学员 (DAU)",
				Value:     fmt.Sprintf("%d", dauUsers),
				Delta:     "—",
				DeltaTone: "neutral",
				Sub:       fmt.Sprintf("平均学习时长 %d min", avgLearningMinutes*25),
			},
			{
				Label:     "订单总数",
				Value:     fmt.Sprintf("%d", totalPaidCount),
				Delta:     "—",
				DeltaTone: "neutral",
				Sub:       fmt.Sprintf("累计 GMV ¥ %s", formatInt(int64(totalPaidSum.Float64))),
			},
		},
		TopCourses: top,
		Totals: Totals{
			Users:                totalUsers,
			Courses:              totalCourses,
			ActiveEnrollments:    activeEnrollments,
			CompletedEnrollments: completedEnrollments,
			CompletionRate:       completionRate,
		},
		Todos: Todos{
			PendingInquiries: pendingInquiries,
			DraftCourses:     draftCourses,
		},
		System: SystemStatus{
			Database:   dbStatus,
			APIVersion: s.apiVersion,
			LastDeploy: s.lastDeploy,
		},
		UserGrowth: growth,
	}, nil
}

// loadTopCourses returns the top 10 courses by enrollment count.
// Uses a correlated sub-select (mirrors the site module pattern in
// T22) to avoid a JOIN + GROUP BY.
func (s *Service) loadTopCourses(ctx context.Context) ([]TopCourse, error) {
	rows, err := s.conn.QueryContext(ctx, `
		SELECT
			c.id, c.title,
			(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.deleted_at IS NULL) AS enrollment_count
		FROM courses c
		ORDER BY enrollment_count DESC, c.created_at DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TopCourse{}
	for rows.Next() {
		var t TopCourse
		var n int64
		if err := rows.Scan(&t.ID, &t.Title, &n); err != nil {
			return nil, err
		}
		t.EnrollmentCount = n
		out = append(out, t)
	}
	return out, rows.Err()
}

// loadUserGrowth buckets user creation dates by day for the last 30
// days. Mirrors admin.service.ts::getUserGrowth.
func (s *Service) loadUserGrowth(ctx context.Context, since time.Time) ([]UserGrowthBucket, error) {
	rows, err := s.conn.QueryContext(ctx, `
		SELECT DATE(created_at) AS d, COUNT(*) AS c
		FROM users
		WHERE created_at >= ? AND deleted_at IS NULL
		GROUP BY d
		ORDER BY d ASC
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UserGrowthBucket{}
	for rows.Next() {
		var (
			d   time.Time
			cnt int64
		)
		if err := rows.Scan(&d, &cnt); err != nil {
			return nil, err
		}
		out = append(out, UserGrowthBucket{
			Date:  d.UTC().Format("2006-01-02"),
			Count: cnt,
		})
	}
	return out, rows.Err()
}

// formatInt renders an int with thousands separators, e.g. 1234567
// → "1,234,567". Mirrors the NestJS toLocaleString() output.
func formatInt(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	// Insert commas every 3 from the right.
	out := make([]byte, 0, len(digits)+len(digits)/3)
	for i, b := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, b)
	}
	if neg {
		return "-" + string(out)
	}
	return string(out)
}

// formatDelta renders a percentage with a sign prefix and 1 decimal
// place, matching the NestJS `+12.3%` / `-4.5%` output.
func formatDelta(d float64) string {
	sign := ""
	if d >= 0 {
		sign = "+"
	}
	return fmt.Sprintf("%s%.1f%%", sign, d)
}

// deltaTone maps a delta to the UI's tone bucket. Same logic as
// NestJS: positive → "up", negative → "down", zero → "up" (the
// NestJS code uses `gmvDelta >= 0 ? 'up' : 'down'`).
func deltaTone(d float64) string {
	if d >= 0 {
		return "up"
	}
	return "down"
}

// errorsAsString is a tiny helper so the package compiles when only
// used in a single place. (errors.As lives in the std lib; we use it
// via fmt.Errorf so callers can still inspect the chain with
// errors.Is.)
var _ = errors.As // silence unused-import when only fmt.Errorf is used
