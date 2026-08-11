// Package learningevents — repo + service for the learning_events
// module. Mirrors apps/api/src/modules/learning-events/.
//
// Phase 2 T15-2. 4 endpoints:
//
//	POST /learning-events         create one
//	POST /learning-events/batch   create many
//	GET  /learning-events/me      list mine
//	GET  /learning-events/lesson/:lessonId  admin list
package learningevents

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("learning_events: not found")

// Repo is the learning_events data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUser returns the user's events, newest first.
func (r *Repo) ListByUser(ctx context.Context, userID string, limit int32) ([]db.LearningEvent, error) {
	rows, err := r.q.ListLearningEventsByUser(ctx, db.ListLearningEventsByUserParams{
		UserID: userID,
		Limit:  limit,
	})
	if err != nil {
		return nil, fmt.Errorf("learningevents.repo: list by user: %w", err)
	}
	out := make([]db.LearningEvent, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToLearningEvent(r.ID, r.UserID, r.LessonID, r.EventType, r.PositionSec, r.DurationMs, r.Metadata, r.CreatedAt))
	}
	return out, nil
}

// ListByLesson returns all events for a lesson, newest first.
func (r *Repo) ListByLesson(ctx context.Context, lessonID string, limit int32) ([]db.LearningEvent, error) {
	rows, err := r.q.ListLearningEventsByLesson(ctx, db.ListLearningEventsByLessonParams{
		LessonID: sql.NullString{String: lessonID, Valid: true},
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("learningevents.repo: list by lesson: %w", err)
	}
	out := make([]db.LearningEvent, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToLearningEvent(r.ID, r.UserID, r.LessonID, r.EventType, r.PositionSec, r.DurationMs, r.Metadata, r.CreatedAt))
	}
	return out, nil
}

// rowToLearningEvent converts a generated Row type (with IFNULL'd
// metadata as interface{}) to db.LearningEvent (with metadata as
// json.RawMessage). Same pattern as badges.
func rowToLearningEvent(
	id, userID string,
	lessonID sql.NullString,
	eventType db.LearningEventsEventType,
	positionSec, durationMs sql.NullInt32,
	metadata interface{},
	createdAt time.Time,
) db.LearningEvent {
	var meta json.RawMessage
	switch v := metadata.(type) {
	case nil:
		meta = nil
	case []byte:
		meta = v
	case string:
		meta = json.RawMessage(v)
	default:
		b, _ := json.Marshal(v)
		meta = b
	}
	return db.LearningEvent{
		ID:          id,
		UserID:      userID,
		LessonID:    lessonID,
		EventType:   eventType,
		PositionSec: positionSec,
		DurationMs:  durationMs,
		Metadata:    meta,
		CreatedAt:   createdAt,
	}
}

// Create inserts a new event.
func (r *Repo) Create(ctx context.Context, e db.LearningEvent) error {
	_, err := r.q.CreateLearningEvent(ctx, db.CreateLearningEventParams{
		ID:          e.ID,
		UserID:      e.UserID,
		LessonID:    e.LessonID,
		EventType:   e.EventType,
		PositionSec: e.PositionSec,
		DurationMs:  e.DurationMs,
		Metadata:    e.Metadata,
	})
	return err
}

// EventDTO is the public JSON shape of a learning event.
type EventDTO struct {
	ID          string  `json:"id"`
	UserID      string  `json:"userId"`
	LessonID    *string `json:"lessonId,omitempty"`
	EventType   string  `json:"eventType"`
	PositionSec *int32  `json:"positionSec,omitempty"`
	DurationMs  *int32  `json:"durationMs,omitempty"`
	Metadata    any     `json:"metadata,omitempty"`
	CreatedAt   string  `json:"createdAt"`
}

func toEventDTO(e db.LearningEvent) EventDTO {
	dto := EventDTO{
		ID:        e.ID,
		UserID:    e.UserID,
		EventType: string(e.EventType),
		CreatedAt: e.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if e.LessonID.Valid {
		s := e.LessonID.String
		dto.LessonID = &s
	}
	if e.PositionSec.Valid {
		v := e.PositionSec.Int32
		dto.PositionSec = &v
	}
	if e.DurationMs.Valid {
		v := e.DurationMs.Int32
		dto.DurationMs = &v
	}
	if len(e.Metadata) > 0 {
		var v any
		if err := json.Unmarshal(e.Metadata, &v); err == nil {
			dto.Metadata = v
		}
	}
	return dto
}

// Service is the learning_events business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// APIInput is the create-event payload.
type APIInput struct {
	LessonID    string
	EventType   string
	PositionSec *int32
	DurationMs  *int32
	Metadata    json.RawMessage
}

// CreateOne inserts a single event. The NestJS service has throttle
// (5/s, 60/min); the Go port leaves throttling to the reverse proxy.
func (s *Service) CreateOne(ctx context.Context, userID string, in APIInput) (EventDTO, error) {
	if !validEventType(in.EventType) {
		return EventDTO{}, errs.BadRequest("invalid eventType")
	}
	e := newEvent(userID, in)
	if err := s.repo.Create(ctx, e); err != nil {
		return EventDTO{}, errs.Internal("create event", err)
	}
	return toEventDTO(e), nil
}

// CreateBatch inserts multiple events. Returns the count of inserted
// rows. Throttled at the controller (NestJS: 10/s, 120/min).
func (s *Service) CreateBatch(ctx context.Context, userID string, inputs []APIInput) (int, error) {
	if len(inputs) == 0 {
		return 0, nil
	}
	if len(inputs) > 200 {
		return 0, errs.BadRequest("batch max 200")
	}
	count := 0
	for _, in := range inputs {
		if !validEventType(in.EventType) {
			return count, errs.BadRequest("invalid eventType: " + in.EventType)
		}
		e := newEvent(userID, in)
		if err := s.repo.Create(ctx, e); err != nil {
			return count, errs.Internal("create batch", err)
		}
		count++
	}
	return count, nil
}

// ListMine returns the user's most recent events, capped at limit.
func (s *Service) ListMine(ctx context.Context, userID string, limit int) ([]EventDTO, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.repo.ListByUser(ctx, userID, int32(limit))
	if err != nil {
		return nil, errs.Internal("list mine", err)
	}
	out := make([]EventDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toEventDTO(r))
	}
	return out, nil
}

// ListByLesson returns events for a lesson, capped at limit.
// Admin / instructor only.
func (s *Service) ListByLesson(ctx context.Context, lessonID string, limit int) ([]EventDTO, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.repo.ListByLesson(ctx, lessonID, int32(limit))
	if err != nil {
		return nil, errs.Internal("list by lesson", err)
	}
	out := make([]EventDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toEventDTO(r))
	}
	return out, nil
}

// ============ helpers ============

func newEvent(userID string, in APIInput) db.LearningEvent {
	e := db.LearningEvent{
		ID:        uuid.NewString(),
		UserID:    userID,
		EventType: db.LearningEventsEventType(in.EventType),
	}
	if in.LessonID != "" {
		e.LessonID = sql.NullString{String: in.LessonID, Valid: true}
	}
	if in.PositionSec != nil {
		e.PositionSec = sql.NullInt32{Int32: *in.PositionSec, Valid: true}
	}
	if in.DurationMs != nil {
		e.DurationMs = sql.NullInt32{Int32: *in.DurationMs, Valid: true}
	}
	e.Metadata = in.Metadata
	return e
}

func validEventType(s string) bool {
	switch db.LearningEventsEventType(s) {
	case db.LearningEventsEventTypePlay,
		db.LearningEventsEventTypePause,
		db.LearningEventsEventTypeSeek,
		db.LearningEventsEventTypeComplete,
		db.LearningEventsEventTypeReplay,
		db.LearningEventsEventTypeSkip,
		db.LearningEventsEventTypeNote:
		return true
	}
	return false
}
