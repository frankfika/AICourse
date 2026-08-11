// Package badges — service layer.
//
// Phase 2 T14-2: business logic for /api/v1/badges/*.
// Mirrors apps/api/src/modules/badges/badges.service.ts 1:1.
//
// Cross-module dependencies:
//   - enrollments.BadgeCheckAward: this service provides the real
//     implementation; main.go wires it at boot.
//   - points service: stubbed (T16 will wire the real impl).
package badges

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service is the badges business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// BadgeDTO is the public JSON shape of a badge. Flattens
// json.RawMessage (criteriaJson) to a plain `any` (parsed object)
// and uses camelCase keys.
type BadgeDTO struct {
	ID            string `json:"id"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Icon          string `json:"icon"`
	Category      string `json:"category"`
	CriteriaType  string `json:"criteriaType"`
	CriteriaValue int32  `json:"criteriaValue"`
	CriteriaJson  any    `json:"criteriaJson,omitempty"`
	Points        int32  `json:"points"`
	IsActive      bool   `json:"isActive"`
	OrderIndex    int32  `json:"orderIndex"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// toBadgeDTO converts db.Badge to the public DTO.
func toBadgeDTO(b db.Badge) BadgeDTO {
	dto := BadgeDTO{
		ID:            b.ID,
		Code:          b.Code,
		Name:          b.Name,
		Description:   b.Description,
		Icon:          b.Icon,
		Category:      b.Category,
		CriteriaType:  string(b.CriteriaType),
		CriteriaValue: b.CriteriaValue,
		Points:        b.Points,
		IsActive:      b.IsActive,
		OrderIndex:    b.OrderIndex,
		CreatedAt:     b.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:     b.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if len(b.CriteriaJson) > 0 {
		var v any
		if err := json.Unmarshal(b.CriteriaJson, &v); err == nil {
			dto.CriteriaJson = v
		}
	}
	return dto
}

// APIInput is the create/update payload.
type APIInput struct {
	Code          string
	Name          string
	Description   string
	Icon          string
	Category      string
	CriteriaType  string
	CriteriaValue int32
	CriteriaJson  json.RawMessage
	Points        int32
	IsActive      *bool
	OrderIndex    int32
}

// ListActive returns all active badges (public).
func (s *Service) ListActive(ctx context.Context) ([]BadgeDTO, error) {
	rows, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, errs.Internal("list active badges", err)
	}
	out := make([]BadgeDTO, 0, len(rows))
	for _, b := range rows {
		out = append(out, toBadgeDTO(b))
	}
	return out, nil
}

// GetByID returns a single badge.
func (s *Service) GetByID(ctx context.Context, id string) (BadgeDTO, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return BadgeDTO{}, errs.NotFound("Badge not found")
		}
		return BadgeDTO{}, errs.Internal("get badge", err)
	}
	return toBadgeDTO(b), nil
}

// Create inserts a new badge.
func (s *Service) Create(ctx context.Context, in APIInput) (BadgeDTO, error) {
	if in.Code == "" || in.Name == "" {
		return BadgeDTO{}, errs.BadRequest("code and name required")
	}
	if in.CriteriaType == "" {
		return BadgeDTO{}, errs.BadRequest("criteriaType required")
	}
	if !validCriteriaType(in.CriteriaType) {
		return BadgeDTO{}, errs.BadRequest("invalid criteriaType")
	}
	// Check unique code
	if _, err := s.repo.GetByCode(ctx, in.Code); err == nil {
		return BadgeDTO{}, errs.Conflict("Badge code already exists")
	} else if !errors.Is(err, ErrNotFound) {
		return BadgeDTO{}, errs.Internal("check code", err)
	}

	now := time.Now().UTC()
	b := db.Badge{
		ID:            uuid.NewString(),
		Code:          in.Code,
		Name:          in.Name,
		Description:   in.Description,
		Icon:          orDefault(in.Icon, "award"),
		Category:      orDefault(in.Category, "general"),
		CriteriaType:  db.BadgesCriteriaType(in.CriteriaType),
		CriteriaValue: defaultInt32(in.CriteriaValue, 1),
		CriteriaJson:  in.CriteriaJson,
		Points:        in.Points,
		IsActive:      in.IsActive == nil || *in.IsActive,
		OrderIndex:    in.OrderIndex,
		UpdatedAt:     now,
	}
	if err := s.repo.Create(ctx, b); err != nil {
		return BadgeDTO{}, errs.Internal("create badge", err)
	}
	// Reload to get createdAt
	reloaded, err := s.repo.GetByID(ctx, b.ID)
	if err != nil {
		return BadgeDTO{}, errs.Internal("reload badge", err)
	}
	return toBadgeDTO(reloaded), nil
}

// Update overwrites a badge row in full.
func (s *Service) Update(ctx context.Context, id string, in APIInput) (BadgeDTO, error) {
	cur, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return BadgeDTO{}, errs.NotFound("Badge not found")
		}
		return BadgeDTO{}, errs.Internal("get badge", err)
	}
	if in.Code != "" {
		cur.Code = in.Code
	}
	if in.Name != "" {
		cur.Name = in.Name
	}
	if in.Description != "" {
		cur.Description = in.Description
	}
	if in.Icon != "" {
		cur.Icon = in.Icon
	}
	if in.Category != "" {
		cur.Category = in.Category
	}
	if in.CriteriaType != "" {
		if !validCriteriaType(in.CriteriaType) {
			return BadgeDTO{}, errs.BadRequest("invalid criteriaType")
		}
		cur.CriteriaType = db.BadgesCriteriaType(in.CriteriaType)
	}
	if in.CriteriaValue != 0 {
		cur.CriteriaValue = in.CriteriaValue
	}
	if len(in.CriteriaJson) > 0 {
		cur.CriteriaJson = in.CriteriaJson
	}
	if in.Points != 0 {
		cur.Points = in.Points
	}
	if in.IsActive != nil {
		cur.IsActive = *in.IsActive
	}
	if in.OrderIndex != 0 {
		cur.OrderIndex = in.OrderIndex
	}
	cur.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, cur); err != nil {
		return BadgeDTO{}, errs.Internal("update badge", err)
	}
	upd, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return BadgeDTO{}, errs.Internal("reload badge", err)
	}
	return toBadgeDTO(upd), nil
}

// Delete removes a badge (and cascades to user_badges via FK).
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Badge not found")
		}
		return errs.Internal("get badge", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete badge", err)
	}
	return nil
}

// UserBadgeWithStatus is the /me endpoint response: badge + unlocked + progress.
type UserBadgeWithStatus struct {
	Badge      BadgeDTO `json:"badge"`
	Unlocked   bool     `json:"unlocked"`
	UnlockedAt *string  `json:"unlockedAt,omitempty"`
	Progress   int32    `json:"progress"`
	Target     int32    `json:"target"`
}

// GetMyBadges returns the user's badge wall with unlock status + progress.
func (s *Service) GetMyBadges(ctx context.Context, userID string) ([]UserBadgeWithStatus, error) {
	badges, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, errs.Internal("list badges", err)
	}
	userBadges, err := s.repo.ListUserBadges(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list user badges", err)
	}
	unlockedMap := map[string]time.Time{}
	for _, ub := range userBadges {
		unlockedMap[ub.BadgeID] = ub.UnlockedAt
	}
	out := make([]UserBadgeWithStatus, 0, len(badges))
	for _, b := range badges {
		var unlockedAt *time.Time
		if t, ok := unlockedMap[b.ID]; ok {
			t2 := t
			unlockedAt = &t2
		}
		progress, target := s.computeProgress(ctx, userID, b)
		entry := UserBadgeWithStatus{
			Badge:    toBadgeDTO(b),
			Unlocked: unlockedAt != nil,
			Progress: progress,
			Target:   target,
		}
		if unlockedAt != nil {
			s := unlockedAt.UTC().Format("2006-01-02T15:04:05.000Z")
			entry.UnlockedAt = &s
		}
		out = append(out, entry)
	}
	return out, nil
}

// computeProgress returns (current, target) for a single badge.
// Phase 2 T14-2 supports criteria types that don't need the T15
// progress records. The progress-dependent types (course_completed,
// lessons_completed, streak_days, practice_completed) return 0/target.
//
// When T15 ships, this function will be extended to query the
// progress_records + practice_completions tables.
func (s *Service) computeProgress(ctx context.Context, userID string, b db.Badge) (int32, int32) {
	switch b.CriteriaType {
	case db.BadgesCriteriaTypeFirstEnrollment:
		// current = active enrollments, target = max(1, criteria_value)
		n, _ := s.repo.CountActiveEnrollments(ctx, userID)
		target := b.CriteriaValue
		if target < 1 {
			target = 1
		}
		return int32(n), target
	case db.BadgesCriteriaTypePointsReached:
		// current = user.points, target = criteria_value
		pts, _ := s.repo.GetUserPoints(ctx, userID)
		return pts, b.CriteriaValue
	default:
		// T15 will fill in: course_completed, lessons_completed,
		// streak_days, practice_completed, course_specific
		return 0, b.CriteriaValue
	}
}

// CheckAndAward scans all active badges, evaluates each, and inserts
// user_badge rows for newly-unlocked badges. The points reward is
// stubbed (T16 will wire the points service).
//
// Returns the list of newly-unlocked badge IDs (for the enrollments
// service hook to log / trigger notifications).
func (s *Service) CheckAndAward(ctx context.Context, userID string) ([]string, error) {
	badges, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, errs.Internal("list badges", err)
	}
	unlocked := []string{}
	for _, b := range badges {
		has, err := s.repo.HasUserBadge(ctx, userID, b.ID)
		if err != nil {
			return nil, errs.Internal("has user badge", err)
		}
		if has {
			continue
		}
		progress, target := s.computeProgress(ctx, userID, b)
		if progress >= target && target > 0 {
			if err := s.repo.AwardBadge(ctx, userID, b.ID); err != nil {
				s.log.Warn("award badge failed", zap.String("badge", b.Code), zap.Error(err))
				continue
			}
			// T16 will award points here via pointsService.Award(...).
			unlocked = append(unlocked, b.ID)
		}
	}
	return unlocked, nil
}

// AdminStats is the /admin/stats response.
type AdminStats struct {
	TotalUsers          int64               `json:"totalUsers"`
	TotalBadgesUnlocked int64               `json:"totalBadgesUnlocked"`
	BadgeDistribution   []BadgeDistribution `json:"badgeDistribution"`
	Leaderboard         []LeaderboardEntry  `json:"leaderboard"`
}

// BadgeDistribution is one row in the admin stats distribution list.
type BadgeDistribution struct {
	BadgeID string `json:"badgeId"`
	Name    string `json:"name"`
	Icon    string `json:"icon"`
	Count   int64  `json:"count"`
}

// LeaderboardEntry is one row in the admin stats leaderboard.
type LeaderboardEntry struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Points int32  `json:"points"`
	Level  int32  `json:"level"`
}

// GetAdminStats aggregates badge data for the admin dashboard.
// Some fields (activeUsers7d, totalLessonsCompleted) need T15's
// progress records — they're 0 in T14-2.
func (s *Service) GetAdminStats(ctx context.Context) (AdminStats, error) {
	totalUsers, err := s.repo.CountUsers(ctx)
	if err != nil {
		return AdminStats{}, errs.Internal("count users", err)
	}
	totalBadges, err := s.repo.CountUserBadges(ctx)
	if err != nil {
		return AdminStats{}, errs.Internal("count user badges", err)
	}
	dist, err := s.repo.CountBadgeDistribution(ctx)
	if err != nil {
		return AdminStats{}, errs.Internal("badge distribution", err)
	}
	// Hydrate distribution with badge name + icon
	allBadges, _ := s.repo.ListAll(ctx)
	badgeByID := map[string]db.Badge{}
	for _, b := range allBadges {
		badgeByID[b.ID] = b
	}
	distDTO := make([]BadgeDistribution, 0, len(dist))
	for _, d := range dist {
		name, icon := d.BadgeID, "award"
		if b, ok := badgeByID[d.BadgeID]; ok {
			name = b.Name
			icon = b.Icon
		}
		distDTO = append(distDTO, BadgeDistribution{
			BadgeID: d.BadgeID,
			Name:    name,
			Icon:    icon,
			Count:   d.Cnt,
		})
	}
	// Leaderboard top 10
	top, err := s.repo.TopUsersByPoints(ctx, 10)
	if err != nil {
		return AdminStats{}, errs.Internal("top users", err)
	}
	lb := make([]LeaderboardEntry, 0, len(top))
	for _, u := range top {
		name := u.Name
		if name == "" {
			name = "匿名用户"
		}
		lb = append(lb, LeaderboardEntry{
			UserID: u.ID,
			Name:   name,
			Points: u.Points,
			Level:  u.Level,
		})
	}
	return AdminStats{
		TotalUsers:          totalUsers,
		TotalBadgesUnlocked: totalBadges,
		BadgeDistribution:   distDTO,
		Leaderboard:         lb,
	}, nil
}

// ============ helpers ============

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func defaultInt32(v, def int32) int32 {
	if v == 0 {
		return def
	}
	return v
}

func validCriteriaType(s string) bool {
	switch db.BadgesCriteriaType(s) {
	case db.BadgesCriteriaTypeCourseCompleted,
		db.BadgesCriteriaTypeLessonsCompleted,
		db.BadgesCriteriaTypeStreakDays,
		db.BadgesCriteriaTypeFirstEnrollment,
		db.BadgesCriteriaTypePracticeCompleted,
		db.BadgesCriteriaTypePointsReached,
		db.BadgesCriteriaTypeCourseSpecific:
		return true
	}
	return false
}
