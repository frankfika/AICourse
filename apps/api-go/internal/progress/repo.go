// Package progress — repo layer.
//
// Phase 2 T15-1: thin wrapper around internal/repo/db for the
// progress module. Mirrors apps/api/src/modules/progress/progress.service.ts.
//
// ProgressRecord is the per-(user, lesson) record. Completed-lesson
// writes are the primary write path (used by /complete-lesson
// + T15's "lesson complete" hook for badge awards).
package progress

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("progress: not found")

// Repo is the progress data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUser returns the user's progress records, newest first.
func (r *Repo) ListByUser(ctx context.Context, userID string) ([]db.ProgressRecord, error) {
	rows, err := r.q.GetProgressByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("progress.repo: list: %w", err)
	}
	return rows, nil
}

// ListByUserCourse returns the user's progress for a specific course.
func (r *Repo) ListByUserCourse(ctx context.Context, userID, courseID string) ([]db.ProgressRecord, error) {
	rows, err := r.q.GetProgressByUserCourse(ctx, db.GetProgressByUserCourseParams{
		UserID:   userID,
		CourseID: courseID,
	})
	if err != nil {
		return nil, fmt.Errorf("progress.repo: list by course: %w", err)
	}
	return rows, nil
}

// GetByUserLesson returns the progress record for (user, lesson).
func (r *Repo) GetByUserLesson(ctx context.Context, userID, lessonID string) (db.ProgressRecord, error) {
	p, err := r.q.GetProgressByUserLesson(ctx, db.GetProgressByUserLessonParams{
		UserID:   userID,
		LessonID: lessonID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.ProgressRecord{}, ErrNotFound
		}
		return db.ProgressRecord{}, fmt.Errorf("progress.repo: get: %w", err)
	}
	return p, nil
}

// GetCourseForLesson returns the parent course_id of a lesson. Used by
// Upsert to populate the denormalized course_id column. Lessons are
// linked to chapters (not courses directly), so we join through
// the chapter.
func (r *Repo) GetCourseForLesson(ctx context.Context, lessonID string) (string, error) {
	var courseID string
	err := r.conn.QueryRowContext(ctx, `
		SELECT c.course_id FROM lessons l
		JOIN chapters c ON c.id = l.chapter_id
		WHERE l.id = ?`, lessonID).Scan(&courseID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("progress.repo: get course for lesson: %w", err)
	}
	return courseID, nil
}

// UpsertResult indicates whether the upsert inserted a new row or
// updated an existing one.
type UpsertResult struct {
	Record       db.ProgressRecord
	IsNew        bool
	WasCompleted bool // was already in 'completed' state before this upsert
}

// Upsert inserts a new progress record or updates the existing one.
// On update, the unique key is (user_id, lesson_id).
func (r *Repo) Upsert(ctx context.Context, userID, lessonID string, status db.ProgressRecordsStatus, completedAt sql.NullTime, lastPosition sql.NullInt32) (UpsertResult, error) {
	courseID, err := r.GetCourseForLesson(ctx, lessonID)
	if err != nil {
		return UpsertResult{}, err
	}
	now := time.Now().UTC()
	// Check for existing record (to set IsNew + WasCompleted)
	var existing *db.ProgressRecord
	if cur, err := r.GetByUserLesson(ctx, userID, lessonID); err == nil {
		existing = &cur
	} else if !errors.Is(err, ErrNotFound) {
		return UpsertResult{}, fmt.Errorf("progress.repo: check existing: %w", err)
	}
	var id string
	isNew := true
	wasCompleted := false
	if existing != nil {
		id = existing.ID
		isNew = false
		wasCompleted = existing.Status == db.ProgressRecordsStatusCompleted
	} else {
		id = uuid.NewString()
	}
	_, err = r.q.UpsertProgress(ctx, db.UpsertProgressParams{
		ID:           id,
		UserID:       userID,
		CourseID:     courseID,
		LessonID:     lessonID,
		Status:       status,
		CompletedAt:  completedAt,
		LastPosition: lastPosition,
		UpdatedAt:    now,
	})
	if err != nil {
		return UpsertResult{}, fmt.Errorf("progress.repo: upsert: %w", err)
	}
	rec, err := r.GetByUserLesson(ctx, userID, lessonID)
	if err != nil {
		return UpsertResult{}, fmt.Errorf("progress.repo: reload: %w", err)
	}
	return UpsertResult{Record: rec, IsNew: isNew, WasCompleted: wasCompleted}, nil
}

// CountCompletedLessons returns the number of completed lessons.
func (r *Repo) CountCompletedLessons(ctx context.Context, userID string) (int64, error) {
	return r.q.CountCompletedLessonsByUser(ctx, userID)
}

// ListCompletedCourseIDs returns the fully-completed course IDs.
func (r *Repo) ListCompletedCourseIDs(ctx context.Context, userID string) ([]string, error) {
	return r.q.ListCompletedCourseIDs(ctx, userID)
}

// ListCompletedDates returns distinct completion dates (streak data).
type DateRow struct {
	Date time.Time
}

func (r *Repo) ListCompletedDates(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.q.ListCompletedDatesByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("progress.repo: list dates: %w", err)
	}
	out := make([]string, 0, len(rows))
	for _, d := range rows {
		out = append(out, d.Format("2006-01-02"))
	}
	return out, nil
}

// GetChapterCourseIDs returns the course IDs of the chapters that
// contain the given lessons. Used by /progress/courses/:courseId to
// group records by chapter.
func (r *Repo) GetLessonCourseID(ctx context.Context, lessonID string) (string, error) {
	return r.GetCourseForLesson(ctx, lessonID)
}
