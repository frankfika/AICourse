// Package enrollments — service layer.
//
// Phase 2 T13-1: business logic for /api/v1/enrollments/*.
// Mirrors apps/api/src/modules/enrollments/enrollments.service.ts 1:1.
//
// The badge check that NestJS kicks off in the background is exposed
// as a service-level hook (`BadgeCheckAward`); mountEnrollments in
// main.go overrides it with a no-op until T14 ships the badges
// module.
package enrollments

import (
	"context"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Service is the enrollments business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// FindByUser returns the user's active enrollments.
func (s *Service) FindByUser(ctx context.Context, userID string) ([]EnrollWithRefs, error) {
	rows, err := s.repo.FindByUser(ctx, userID)
	if err != nil {
		return nil, errs.Internal("find enrollments", err)
	}
	return rows, nil
}

// EnrollFreeCourse enrolls a user in a free course. Verifies the
// course is free/charity; if the user is already enrolled, revives
// the row (idempotent upsert).
//
// After successful enrollment, kicks off a non-blocking badge check
// (stub for now — T14).
func (s *Service) EnrollFreeCourse(ctx context.Context, userID, courseID string) (EnrollWithRefs, error) {
	costType, err := s.courseCostType(ctx, courseID)
	if err != nil {
		return EnrollWithRefs{}, err
	}
	if costType != "free" && costType != "charity" {
		return EnrollWithRefs{}, errs.BadRequest("This course is not free")
	}

	enr, err := s.repo.EnrollFreeCourse(ctx, EnrollInput{
		UserID:   userID,
		CourseID: courseID,
		Source:   db.EnrollmentsSourceDirect,
	})
	if err != nil {
		return EnrollWithRefs{}, errs.Internal("enroll", err)
	}

	// Fire-and-forget badge check (the hook is wired in mountBadges
	// to the real implementation; before that, it's a no-op stub).
	// Use a detached context so the badge check doesn't get cancelled
	// when the request context is done.
	go func() {
		bgCtx := context.Background()
		if err := BadgeCheckAward(bgCtx, userID); err != nil {
			s.log.Warn("badge check failed", zap.String("userId", userID), zap.Error(err))
		}
	}()

	// Re-fetch with course/degree refs so the response shape is
	// consistent with FindByUser.
	rows, err := s.repo.FindByUser(ctx, userID)
	if err != nil {
		// Not fatal — return the bare enrollment.
		return EnrollWithRefs{Enrollment: toEnrollmentDTO(enr)}, nil
	}
	for _, r := range rows {
		if r.Enrollment.ID == enr.ID {
			return r, nil
		}
	}
	return EnrollWithRefs{Enrollment: toEnrollmentDTO(enr)}, nil
}

// courseCostType looks up the cost_type of a course. Returns "" if
// the course doesn't exist.
func (s *Service) courseCostType(ctx context.Context, courseID string) (string, error) {
	c, err := s.repo.GetCourseCostType(ctx, courseID)
	if err != nil {
		return "", err
	}
	return c, nil
}

// BadgeCheckAward is a hook for the badges service. Stub for now —
// mountEnrollments in main.go overrides it with a no-op. When T14
// ships, the real impl is wired up.
var BadgeCheckAward = func(_ context.Context, _ string) error { return nil }
