// Package progress — service layer.
//
// Phase 2 T15-1: business logic for /api/v1/progress/*.
// Mirrors apps/api/src/modules/progress/progress.service.ts 1:1.
//
// Cross-module dependencies:
//   - badges.AwardOnLessonComplete: fired when a lesson transitions
//     to 'completed' (not on re-completes). Stub for now (T14-2 wired
//     enrollments, this is the second caller).
package progress

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the progress business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ProgressDTO is the public JSON shape of a progress record.
type ProgressDTO struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	CourseID     string  `json:"courseId"`
	LessonID     string  `json:"lessonId"`
	Status       string  `json:"status"`
	CompletedAt  *string `json:"completedAt,omitempty"`
	LastPosition *int32  `json:"lastPosition,omitempty"`
	UpdatedAt    string  `json:"updatedAt"`
}

func toProgressDTO(p db.ProgressRecord) ProgressDTO {
	dto := ProgressDTO{
		ID:        p.ID,
		UserID:    p.UserID,
		CourseID:  p.CourseID,
		LessonID:  p.LessonID,
		Status:    string(p.Status),
		UpdatedAt: p.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if p.CompletedAt.Valid {
		s := p.CompletedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.CompletedAt = &s
	}
	if p.LastPosition.Valid {
		v := p.LastPosition.Int32
		dto.LastPosition = &v
	}
	return dto
}

// GetMyProgress returns all progress records for the user.
func (s *Service) GetMyProgress(ctx context.Context, userID string) ([]ProgressDTO, error) {
	rows, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list progress", err)
	}
	out := make([]ProgressDTO, 0, len(rows))
	for _, p := range rows {
		out = append(out, toProgressDTO(p))
	}
	return out, nil
}

// GetCourseProgress returns the user's progress for a specific course.
// The NestJS service groups by chapter + computes completion %.
// The Go port returns the raw records (frontend does the grouping).
func (s *Service) GetCourseProgress(ctx context.Context, userID, courseID string) ([]ProgressDTO, error) {
	rows, err := s.repo.ListByUserCourse(ctx, userID, courseID)
	if err != nil {
		return nil, errs.Internal("list course progress", err)
	}
	out := make([]ProgressDTO, 0, len(rows))
	for _, p := range rows {
		out = append(out, toProgressDTO(p))
	}
	return out, nil
}

// CompleteLesson marks a lesson as completed. Idempotent: re-completing
// returns the same record. Kicks off a non-blocking badge check on
// the first transition to 'completed'.
//
// The NestJS service also tracks `lastPosition` for video scrub
// position. T15-1 doesn't expose that yet — it's a future API.
func (s *Service) CompleteLesson(ctx context.Context, userID, lessonID string) (ProgressDTO, error) {
	now := time.Now().UTC()
	res, err := s.repo.Upsert(ctx, userID, lessonID,
		db.ProgressRecordsStatusCompleted,
		sql.NullTime{Time: now, Valid: true},
		sql.NullInt32{})
	if err != nil {
		if err == ErrNotFound {
			return ProgressDTO{}, errs.NotFound("Lesson not found")
		}
		return ProgressDTO{}, errs.Internal("complete lesson", err)
	}
	if !res.WasCompleted {
		// Fire-and-forget badge check.
		go func() {
			_ = AwardOnLessonComplete(context.Background(), userID)
		}()
	}
	return toProgressDTO(res.Record), nil
}

// LearningStats is the /me/stats response shape.
type LearningStats struct {
	TotalLessonsCompleted int64    `json:"totalLessonsCompleted"`
	CompletedCourseIDs    []string `json:"completedCourseIds"`
	StreakDays            int32    `json:"streakDays"`
	EnrollmentsCount      int64    `json:"enrollmentsCount"`
	CompletedPractices    int64    `json:"completedPractices"`
	Points                int32    `json:"points"`
}

// GetLearningStats aggregates the user's learning data for the dashboard.
func (s *Service) GetLearningStats(ctx context.Context, userID string) (LearningStats, error) {
	completed, err := s.repo.CountCompletedLessons(ctx, userID)
	if err != nil {
		return LearningStats{}, errs.Internal("count completed", err)
	}
	completedCourses, err := s.repo.ListCompletedCourseIDs(ctx, userID)
	if err != nil {
		return LearningStats{}, errs.Internal("list completed courses", err)
	}
	streak, err := s.computeStreak(ctx, userID)
	if err != nil {
		s.log.Warn("compute streak failed", zap.Error(err))
		streak = 0
	}
	enrollments, err := s.repo.conn.QueryContext(ctx,
		`SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND deleted_at IS NULL`, userID)
	_ = enrollments
	enrollCount := int64(0)
	if err == nil {
		defer enrollments.Close()
		if enrollments.Next() {
			_ = enrollments.Scan(&enrollCount)
		}
	}
	practices, err := s.repo.conn.QueryContext(ctx,
		`SELECT COUNT(*) FROM practice_completions WHERE user_id = ? AND status = 'completed'`, userID)
	practiceCount := int64(0)
	if err == nil {
		defer practices.Close()
		if practices.Next() {
			_ = practices.Scan(&practiceCount)
		}
	}
	points, err := s.repo.conn.QueryContext(ctx,
		`SELECT points FROM users WHERE id = ?`, userID)
	pointsVal := int32(0)
	if err == nil {
		defer points.Close()
		if points.Next() {
			_ = points.Scan(&pointsVal)
		}
	}
	return LearningStats{
		TotalLessonsCompleted: completed,
		CompletedCourseIDs:    completedCourses,
		StreakDays:            streak,
		EnrollmentsCount:      enrollCount,
		CompletedPractices:    practiceCount,
		Points:                pointsVal,
	}, nil
}

// computeStreak returns the number of consecutive days ending today
// (or yesterday) the user has at least one lesson completion.
func (s *Service) computeStreak(ctx context.Context, userID string) (int32, error) {
	dates, err := s.repo.ListCompletedDates(ctx, userID)
	if err != nil {
		return 0, err
	}
	if len(dates) == 0 {
		return 0, nil
	}
	today := time.Now().UTC().Format("2006-01-02")
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	// If most recent date is neither today nor yesterday, streak = 0.
	if dates[0] != today && dates[0] != yesterday {
		return 0, nil
	}
	streak := int32(1)
	for i := 1; i < len(dates); i++ {
		prev, err1 := time.Parse("2006-01-02", dates[i-1])
		curr, err2 := time.Parse("2006-01-02", dates[i])
		if err1 != nil || err2 != nil {
			break
		}
		diff := prev.Sub(curr).Hours() / 24
		if diff == 1 {
			streak++
		} else {
			break
		}
	}
	return streak, nil
}

// ============ helpers ============

// AwardOnLessonComplete is a cross-module hook fired when a lesson
// transitions to 'completed'. Default is no-op; main.go overrides
// it with the badges service's CheckAndAward.
var AwardOnLessonComplete = func(_ context.Context, _ string) error { return nil }

// Unused helper to keep fmt in scope if other code paths need it.
var _ = fmt.Sprintf
