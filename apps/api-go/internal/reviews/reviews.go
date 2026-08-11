// Package reviews — repo + service for the reviews module. Mirrors
// apps/api/src/modules/reviews/.
//
// Phase 2 T15-4. 5 endpoints:
//
//	GET  /courses/:id/reviews         public list
//	POST /courses/:id/reviews         auth create (one per user-course)
//	POST /reviews/:id/helpful         auth like
//	GET  /reviews                      admin list (all)
//	DELETE /reviews/:id                admin soft-delete
package reviews

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("reviews: not found")

// Repo is the reviews data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByCourse returns public reviews for a course, newest first.
func (r *Repo) ListByCourse(ctx context.Context, courseID string, limit int32) ([]db.Review, error) {
	rows, err := r.q.ListReviewsByCourse(ctx, db.ListReviewsByCourseParams{
		CourseID: courseID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("reviews.repo: list by course: %w", err)
	}
	return rows, nil
}

// GetByID looks up a review by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Review, error) {
	rv, err := r.q.GetReviewByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Review{}, ErrNotFound
		}
		return db.Review{}, fmt.Errorf("reviews.repo: get: %w", err)
	}
	return rv, nil
}

// FindByUserCourse returns the existing review (idempotency check).
func (r *Repo) FindByUserCourse(ctx context.Context, userID, courseID string) (db.Review, error) {
	rv, err := r.q.GetReviewByUserCourse(ctx, db.GetReviewByUserCourseParams{
		UserID: userID, CourseID: courseID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Review{}, ErrNotFound
		}
		return db.Review{}, fmt.Errorf("reviews.repo: find: %w", err)
	}
	return rv, nil
}

// Create inserts a new review.
func (r *Repo) Create(ctx context.Context, rv db.Review) error {
	_, err := r.q.CreateReview(ctx, db.CreateReviewParams{
		ID:        rv.ID,
		UserID:    rv.UserID,
		CourseID:  rv.CourseID,
		Rating:    rv.Rating,
		Content:   rv.Content,
		CreatedAt: rv.CreatedAt,
		UpdatedAt: rv.UpdatedAt,
	})
	return err
}

// IncrementHelpful bumps the helpful counter atomically.
func (r *Repo) IncrementHelpful(ctx context.Context, id string) error {
	return r.q.IncrementReviewHelpful(ctx, db.IncrementReviewHelpfulParams{
		UpdatedAt: time.Now().UTC(),
		ID:        id,
	})
}

// SoftDelete sets deleted_at = now().
func (r *Repo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	return r.q.SoftDeleteReview(ctx, db.SoftDeleteReviewParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: now,
		ID:        id,
	})
}

// ListAll is the admin list with optional filters.
func (r *Repo) ListAll(ctx context.Context, courseID string, rating int32, onlyDeleted bool, limit int32) ([]db.Review, error) {
	// sqlc infers Column1/Column3/Column5 as interface{} because of the
	// (? = '' OR ...) pattern. Pass string-converted values.
	var courseArg any = courseID
	if courseID == "" {
		courseArg = ""
	}
	var ratingArg any = rating
	if rating == 0 {
		ratingArg = int32(0)
	}
	var onlyDelArg any = int32(0)
	if onlyDeleted {
		onlyDelArg = int32(1)
	}
	rows, err := r.q.ListAllReviews(ctx, db.ListAllReviewsParams{
		Column1:  courseArg,
		CourseID: courseID,
		Column3:  ratingArg,
		Rating:   rating,
		Column5:  onlyDelArg,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("reviews.repo: list all: %w", err)
	}
	return rows, nil
}

// ReviewDTO is the public JSON shape of a review.
type ReviewDTO struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	CourseID  string `json:"courseId"`
	Rating    int32  `json:"rating"`
	Content   string `json:"content"`
	Helpful   int32  `json:"helpful"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func toReviewDTO(rv db.Review) ReviewDTO {
	return ReviewDTO{
		ID:        rv.ID,
		UserID:    rv.UserID,
		CourseID:  rv.CourseID,
		Rating:    rv.Rating,
		Content:   rv.Content,
		Helpful:   rv.Helpful,
		CreatedAt: rv.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: rv.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
}

// Service is the reviews business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ListByCourse returns public reviews for a course.
func (s *Service) ListByCourse(ctx context.Context, courseID string) ([]ReviewDTO, error) {
	rows, err := s.repo.ListByCourse(ctx, courseID, 100)
	if err != nil {
		return nil, errs.Internal("list reviews", err)
	}
	out := make([]ReviewDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toReviewDTO(r))
	}
	return out, nil
}

// APIInput is the create payload.
type APIInput struct {
	Rating  int32
	Content string
}

// Create inserts a new review. Idempotent: one per (user, course).
func (s *Service) Create(ctx context.Context, userID, courseID string, in APIInput) (ReviewDTO, error) {
	if in.Rating < 1 || in.Rating > 5 {
		return ReviewDTO{}, errs.BadRequest("rating must be 1-5")
	}
	if in.Content == "" {
		return ReviewDTO{}, errs.BadRequest("content required")
	}
	// Idempotency check
	if existing, err := s.repo.FindByUserCourse(ctx, userID, courseID); err == nil {
		// Return existing (NestJS: 409 ConflictException). We mirror 200
		// to keep idempotency friendlier for the frontend.
		return toReviewDTO(existing), nil
	} else if !errors.Is(err, ErrNotFound) {
		return ReviewDTO{}, errs.Internal("check existing", err)
	}
	now := time.Now().UTC()
	rv := db.Review{
		ID:        uuid.NewString(),
		UserID:    userID,
		CourseID:  courseID,
		Rating:    in.Rating,
		Content:   in.Content,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(ctx, rv); err != nil {
		return ReviewDTO{}, errs.Internal("create review", err)
	}
	created, err := s.repo.GetByID(ctx, rv.ID)
	if err != nil {
		return ReviewDTO{}, errs.Internal("reload review", err)
	}
	return toReviewDTO(created), nil
}

// MarkHelpful bumps the helpful counter.
func (s *Service) MarkHelpful(ctx context.Context, userID, reviewID string) (ReviewDTO, error) {
	rv, err := s.repo.GetByID(ctx, reviewID)
	if err != nil {
		if err == ErrNotFound {
			return ReviewDTO{}, errs.NotFound("Review not found")
		}
		return ReviewDTO{}, errs.Internal("get review", err)
	}
	if rv.DeletedAt.Valid {
		return ReviewDTO{}, errs.NotFound("Review not found")
	}
	if err := s.repo.IncrementHelpful(ctx, reviewID); err != nil {
		return ReviewDTO{}, errs.Internal("increment helpful", err)
	}
	upd, err := s.repo.GetByID(ctx, reviewID)
	if err != nil {
		return ReviewDTO{}, errs.Internal("reload review", err)
	}
	return toReviewDTO(upd), nil
}

// ListAll is the admin list.
func (s *Service) ListAll(ctx context.Context, courseID string, rating int32, onlyDeleted bool) ([]ReviewDTO, error) {
	rows, err := s.repo.ListAll(ctx, courseID, rating, onlyDeleted, 500)
	if err != nil {
		return nil, errs.Internal("list all", err)
	}
	out := make([]ReviewDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toReviewDTO(r))
	}
	return out, nil
}

// SoftDelete marks a review as deleted (admin only).
func (s *Service) SoftDelete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Review not found")
		}
		return errs.Internal("get review", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete", err)
	}
	return nil
}
