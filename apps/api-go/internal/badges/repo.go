// Package badges — repo layer.
//
// Phase 2 T14-2: thin wrapper around internal/repo/db for the
// badges module. Mirrors apps/api/src/modules/badges/badges.service.ts.
package badges

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("badges: not found")

// Repo is the badges data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListActive returns all active badges (is_active=1).
func (r *Repo) ListActive(ctx context.Context) ([]db.Badge, error) {
	rows, err := r.q.ListActiveBadges(ctx)
	if err != nil {
		return nil, fmt.Errorf("badges.repo: list active: %w", err)
	}
	out := make([]db.Badge, 0, len(rows))
	for _, x := range rows {
		out = append(out, badgeRowToBadge(x.ID, x.Code, x.Name, x.Description, x.Icon, x.Category, x.CriteriaType, x.CriteriaValue, x.CriteriaJson, x.Points, x.IsActive, x.OrderIndex, x.CreatedAt, x.UpdatedAt))
	}
	return out, nil
}

// ListAll returns all badges (active + inactive). Admin only.
func (r *Repo) ListAll(ctx context.Context) ([]db.Badge, error) {
	rows, err := r.q.ListAllBadges(ctx)
	if err != nil {
		return nil, fmt.Errorf("badges.repo: list all: %w", err)
	}
	out := make([]db.Badge, 0, len(rows))
	for _, x := range rows {
		out = append(out, badgeRowToBadge(x.ID, x.Code, x.Name, x.Description, x.Icon, x.Category, x.CriteriaType, x.CriteriaValue, x.CriteriaJson, x.Points, x.IsActive, x.OrderIndex, x.CreatedAt, x.UpdatedAt))
	}
	return out, nil
}

// GetByID looks up a badge by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Badge, error) {
	b, err := r.q.GetBadgeByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Badge{}, ErrNotFound
		}
		return db.Badge{}, fmt.Errorf("badges.repo: get: %w", err)
	}
	return badgeRowToBadge(b.ID, b.Code, b.Name, b.Description, b.Icon, b.Category, b.CriteriaType, b.CriteriaValue, b.CriteriaJson, b.Points, b.IsActive, b.OrderIndex, b.CreatedAt, b.UpdatedAt), nil
}

// GetByCode looks up a badge by its unique code.
func (r *Repo) GetByCode(ctx context.Context, code string) (db.Badge, error) {
	b, err := r.q.GetBadgeByCode(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Badge{}, ErrNotFound
		}
		return db.Badge{}, fmt.Errorf("badges.repo: get by code: %w", err)
	}
	return badgeRowToBadge(b.ID, b.Code, b.Name, b.Description, b.Icon, b.Category, b.CriteriaType, b.CriteriaValue, b.CriteriaJson, b.Points, b.IsActive, b.OrderIndex, b.CreatedAt, b.UpdatedAt), nil
}

// badgeRowToBadge converts the row fields (with criteria_json as
// interface{}) to a db.Badge (with criteria_json as json.RawMessage).
// sqlc can't infer the type of JSON_OBJECT() so the row types all
// have interface{} for the criteria_json field.
func badgeRowToBadge(
	id, code, name, description, icon, category string,
	criteriaType db.BadgesCriteriaType,
	criteriaValue int32,
	criteriaJson interface{},
	points int32,
	isActive bool,
	orderIndex int32,
	createdAt, updatedAt time.Time,
) db.Badge {
	var cj json.RawMessage
	switch v := criteriaJson.(type) {
	case nil:
		cj = nil
	case []byte:
		cj = v
	case string:
		cj = json.RawMessage(v)
	default:
		// Last resort: re-marshal whatever shape the driver gave us.
		b, _ := json.Marshal(v)
		cj = b
	}
	return db.Badge{
		ID:            id,
		Code:          code,
		Name:          name,
		Description:   description,
		Icon:          icon,
		Category:      category,
		CriteriaType:  criteriaType,
		CriteriaValue: criteriaValue,
		CriteriaJson:  cj,
		Points:        points,
		IsActive:      isActive,
		OrderIndex:    orderIndex,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}
}

// Create inserts a new badge.
func (r *Repo) Create(ctx context.Context, b db.Badge) error {
	_, err := r.q.CreateBadge(ctx, db.CreateBadgeParams{
		ID:            b.ID,
		Code:          b.Code,
		Name:          b.Name,
		Description:   b.Description,
		Icon:          b.Icon,
		Category:      b.Category,
		CriteriaType:  b.CriteriaType,
		CriteriaValue: b.CriteriaValue,
		CriteriaJson:  b.CriteriaJson,
		Points:        b.Points,
		IsActive:      b.IsActive,
		OrderIndex:    b.OrderIndex,
		UpdatedAt:     b.UpdatedAt,
	})
	return err
}

// Update overwrites a badge row in full. Caller is responsible for
// the find-then-fill pattern (service does this).
func (r *Repo) Update(ctx context.Context, b db.Badge) error {
	return r.q.UpdateBadge(ctx, db.UpdateBadgeParams{
		Code:          b.Code,
		Name:          b.Name,
		Description:   b.Description,
		Icon:          b.Icon,
		Category:      b.Category,
		CriteriaType:  b.CriteriaType,
		CriteriaValue: b.CriteriaValue,
		CriteriaJson:  b.CriteriaJson,
		Points:        b.Points,
		IsActive:      b.IsActive,
		OrderIndex:    b.OrderIndex,
		UpdatedAt:     b.UpdatedAt,
		ID:            b.ID,
	})
}

// Delete removes a badge. FK ON DELETE CASCADE removes user_badges.
func (r *Repo) Delete(ctx context.Context, id string) error {
	return r.q.DeleteBadge(ctx, id)
}

// ListUserBadges returns the user's unlocked badge records.
func (r *Repo) ListUserBadges(ctx context.Context, userID string) ([]db.UserBadge, error) {
	rows, err := r.q.ListUserBadges(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("badges.repo: list user badges: %w", err)
	}
	return rows, nil
}

// HasUserBadge returns true if the user already unlocked this badge.
func (r *Repo) HasUserBadge(ctx context.Context, userID, badgeID string) (bool, error) {
	_, err := r.q.GetUserBadge(ctx, db.GetUserBadgeParams{
		UserID: userID, BadgeID: badgeID,
	})
	if err == nil {
		return true, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return false, fmt.Errorf("badges.repo: get user badge: %w", err)
}

// AwardBadge inserts a user_badge row. Idempotent (caller checks
// HasUserBadge first to avoid P2002).
func (r *Repo) AwardBadge(ctx context.Context, userID, badgeID string) error {
	_, err := r.q.CreateUserBadge(ctx, db.CreateUserBadgeParams{
		ID:         uuid.NewString(),
		UserID:     userID,
		BadgeID:    badgeID,
		UnlockedAt: time.Now().UTC(),
	})
	return err
}

// CountUserBadges returns the total unlocked badges across all users.
func (r *Repo) CountUserBadges(ctx context.Context) (int64, error) {
	return r.q.CountUserBadges(ctx)
}

// CountBadgeDistribution returns the per-badge unlock counts.
func (r *Repo) CountBadgeDistribution(ctx context.Context) ([]db.CountBadgeDistributionRow, error) {
	return r.q.CountBadgeDistribution(ctx)
}

// CountActiveEnrollments returns the user's active enrollment count.
// Used by the "first_enrollment" criteria type.
func (r *Repo) CountActiveEnrollments(ctx context.Context, userID string) (int64, error) {
	var n int64
	err := r.conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND deleted_at IS NULL`,
		userID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("badges.repo: count enrollments: %w", err)
	}
	return n, nil
}

// GetUserPoints returns the user's current points + level.
// Used by the "points_reached" criteria type.
func (r *Repo) GetUserPoints(ctx context.Context, userID string) (int32, error) {
	var p int32
	err := r.conn.QueryRowContext(ctx,
		`SELECT points FROM users WHERE id = ?`, userID).Scan(&p)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("badges.repo: get user points: %w", err)
	}
	return p, nil
}

// CountUsers returns the total number of users. Used by admin stats.
func (r *Repo) CountUsers(ctx context.Context) (int64, error) {
	var n int64
	err := r.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("badges.repo: count users: %w", err)
	}
	return n, nil
}

// TopUserRow is the local shape returned by TopUsersByPoints.
type TopUserRow struct {
	ID     string
	Name   string
	Points int32
	Level  int32
}

// TopUsersByPoints returns the top N users by points.
func (r *Repo) TopUsersByPoints(ctx context.Context, limit int) ([]TopUserRow, error) {
	rows, err := r.conn.QueryContext(ctx, `
		SELECT id, name, points, level FROM users
		WHERE deleted_at IS NULL
		ORDER BY points DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("badges.repo: top users: %w", err)
	}
	defer rows.Close()
	out := []TopUserRow{}
	for rows.Next() {
		var u TopUserRow
		var name sql.NullString
		if err := rows.Scan(&u.ID, &name, &u.Points, &u.Level); err != nil {
			return nil, err
		}
		if name.Valid {
			u.Name = name.String
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
