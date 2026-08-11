// Package points — repo + service for the points module. Mirrors
// apps/api/src/modules/points/.
//
// Phase 2 T16-2. 1 endpoint:
//
//	GET /points/me   auth: user's points, level, and recent transactions
//
// The service also exposes an internal `Award(...)` method used by
// cross-module hooks (e.g. practices.AwardOnPracticeComplete can
// call points.Award to grant +N points). Wiring that hook is
// deferred — T16-2 only delivers the public read API.
package points

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("points: not found")

// Repo is the points data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// GetUserPoints returns the user's current points + level. Returns
// ErrNotFound if the user doesn't exist or is soft-deleted.
func (r *Repo) GetUserPoints(ctx context.Context, userID string) (db.GetUserPointsRow, error) {
	row, err := r.q.GetUserPoints(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.GetUserPointsRow{}, ErrNotFound
		}
		return db.GetUserPointsRow{}, fmt.Errorf("points.repo: get user points: %w", err)
	}
	return row, nil
}

// ListRecent returns the user's most recent non-deleted point
// transactions, newest first, up to `limit` entries.
func (r *Repo) ListRecent(ctx context.Context, userID string, limit int32) ([]db.PointTransaction, error) {
	rows, err := r.q.ListRecentPointTransactions(ctx, db.ListRecentPointTransactionsParams{
		UserID: userID, Limit: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("points.repo: list recent: %w", err)
	}
	return rows, nil
}

// PointTransactionDTO is the public JSON shape of a point ledger row.
type PointTransactionDTO struct {
	ID        string  `json:"id"`
	UserID    string  `json:"userId"`
	Amount    int32   `json:"amount"`
	Reason    string  `json:"reason"`
	RefType   *string `json:"refType,omitempty"`
	RefID     *string `json:"refId,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

func toPointTransactionDTO(tx db.PointTransaction) PointTransactionDTO {
	dto := PointTransactionDTO{
		ID:        tx.ID,
		UserID:    tx.UserID,
		Amount:    tx.Amount,
		Reason:    tx.Reason,
		CreatedAt: tx.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if tx.RefType.Valid {
		s := string(tx.RefType.PointTransactionsRefType)
		dto.RefType = &s
	}
	if tx.RefID.Valid {
		s := tx.RefID.String
		dto.RefID = &s
	}
	return dto
}

// PointsDTO bundles the user's points, level, level-progress, and
// recent transactions in one response. Matches the NestJS shape.
type PointsDTO struct {
	Points             int32                 `json:"points"`
	Level              int32                 `json:"level"`
	CurrentLevelPoints int32                 `json:"currentLevelPoints"`
	NextLevelPoints    int32                 `json:"nextLevelPoints"`
	PointsToNextLevel  int32                 `json:"pointsToNextLevel"`
	RecentTransactions []PointTransactionDTO `json:"recentTransactions"`
}

// emptyPointsDTO is the default response when the user is not found
// (NestJS does the same — it returns 0/1/100/100/100/[]).
func emptyPointsDTO() PointsDTO {
	return PointsDTO{
		Points:             0,
		Level:              1,
		CurrentLevelPoints: 0,
		NextLevelPoints:    100,
		PointsToNextLevel:  100,
		RecentTransactions: []PointTransactionDTO{},
	}
}

// Service is the points business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// GetUserPoints returns the user's points, level, and recent
// transactions. Matches NestJS:
//
//	calculateLevel(points) = floor(sqrt(points/100)) + 1
//	levelThreshold(level)  = max(0, (level-1)^2 * 100)
func (s *Service) GetUserPoints(ctx context.Context, userID string) (PointsDTO, error) {
	up, err := s.repo.GetUserPoints(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return emptyPointsDTO(), nil
		}
		return PointsDTO{}, errs.Internal("get user points", err)
	}
	txs, err := s.repo.ListRecent(ctx, userID, 10)
	if err != nil {
		return PointsDTO{}, errs.Internal("list recent transactions", err)
	}

	level := calculateLevel(up.Points)
	current := levelThreshold(level)
	next := levelThreshold(level + 1)
	items := make([]PointTransactionDTO, 0, len(txs))
	for _, t := range txs {
		items = append(items, toPointTransactionDTO(t))
	}
	return PointsDTO{
		Points:             up.Points,
		Level:              level,
		CurrentLevelPoints: current,
		NextLevelPoints:    next,
		PointsToNextLevel:  int32(math.Max(0, float64(next-up.Points))),
		RecentTransactions: items,
	}, nil
}

// calculateLevel returns the level for a given total points.
// Mirrors apps/api/src/modules/points/points.service.ts exactly.
func calculateLevel(points int32) int32 {
	if points <= 0 {
		return 1
	}
	return int32(math.Floor(math.Sqrt(float64(points)/100.0))) + 1
}

// levelThreshold returns the points needed to *reach* the given level.
// Mirrors apps/api/src/modules/points/points.service.ts exactly.
func levelThreshold(level int32) int32 {
	if level <= 1 {
		return 0
	}
	d := float64(level - 1)
	return int32(d * d * 100)
}

// _ keeps time import live (used elsewhere in the package's award path
// when the cross-module hook gets wired).
var _ = time.Now
