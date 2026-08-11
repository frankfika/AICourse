// Package notes — repo + service for the notes module. Mirrors
// apps/api/src/modules/notes/.
//
// Phase 2 T15-3. 5 endpoints:
//
//	GET  /lessons/:lessonId/notes   list my notes for a lesson
//	POST /lessons/:lessonId/notes   create note
//	PATCH /notes/:id                 update (owner only)
//	DELETE /notes/:id                delete (owner only)
package notes

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
var ErrNotFound = errors.New("notes: not found")

// ErrForbidden is returned when the user doesn't own the note.
var ErrForbidden = errors.New("notes: not owner")

// Repo is the notes data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUserLesson returns the user's notes for a lesson, oldest first.
func (r *Repo) ListByUserLesson(ctx context.Context, userID, lessonID string) ([]db.Note, error) {
	rows, err := r.q.ListNotesByUserLesson(ctx, db.ListNotesByUserLessonParams{
		UserID: userID, LessonID: lessonID,
	})
	if err != nil {
		return nil, fmt.Errorf("notes.repo: list: %w", err)
	}
	return rows, nil
}

// GetByID looks up a note by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Note, error) {
	n, err := r.q.GetNoteByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Note{}, ErrNotFound
		}
		return db.Note{}, fmt.Errorf("notes.repo: get: %w", err)
	}
	return n, nil
}

// Create inserts a new note.
func (r *Repo) Create(ctx context.Context, n db.Note) error {
	_, err := r.q.CreateNote(ctx, db.CreateNoteParams{
		ID:          n.ID,
		UserID:      n.UserID,
		LessonID:    n.LessonID,
		Content:     n.Content,
		PositionSec: n.PositionSec,
		CreatedAt:   n.CreatedAt,
		UpdatedAt:   n.UpdatedAt,
	})
	return err
}

// Update modifies an existing note (content + position_sec).
func (r *Repo) Update(ctx context.Context, id string, content string, positionSec sql.NullInt32) error {
	return r.q.UpdateNote(ctx, db.UpdateNoteParams{
		Content:     content,
		PositionSec: positionSec,
		UpdatedAt:   time.Now().UTC(),
		ID:          id,
	})
}

// Delete removes a note.
func (r *Repo) Delete(ctx context.Context, id string) error {
	return r.q.DeleteNote(ctx, id)
}

// NoteDTO is the public JSON shape of a note.
type NoteDTO struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	LessonID    string `json:"lessonId"`
	Content     string `json:"content"`
	PositionSec *int32 `json:"positionSec,omitempty"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

func toNoteDTO(n db.Note) NoteDTO {
	dto := NoteDTO{
		ID:        n.ID,
		UserID:    n.UserID,
		LessonID:  n.LessonID,
		Content:   n.Content,
		CreatedAt: n.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: n.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if n.PositionSec.Valid {
		v := n.PositionSec.Int32
		dto.PositionSec = &v
	}
	return dto
}

// Service is the notes business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// List returns the user's notes for a lesson.
func (s *Service) List(ctx context.Context, userID, lessonID string) ([]NoteDTO, error) {
	rows, err := s.repo.ListByUserLesson(ctx, userID, lessonID)
	if err != nil {
		return nil, errs.Internal("list notes", err)
	}
	out := make([]NoteDTO, 0, len(rows))
	for _, n := range rows {
		out = append(out, toNoteDTO(n))
	}
	return out, nil
}

// APIInput is the create/update payload.
type APIInput struct {
	Content     string
	PositionSec *int32
}

// Create inserts a new note. The lesson must exist (FK constraint
// will fail otherwise).
func (s *Service) Create(ctx context.Context, userID, lessonID string, in APIInput) (NoteDTO, error) {
	if in.Content == "" {
		return NoteDTO{}, errs.BadRequest("content required")
	}
	now := time.Now().UTC()
	n := db.Note{
		ID:        uuid.NewString(),
		UserID:    userID,
		LessonID:  lessonID,
		Content:   in.Content,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if in.PositionSec != nil {
		n.PositionSec = sql.NullInt32{Int32: *in.PositionSec, Valid: true}
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return NoteDTO{}, errs.Internal("create note", err)
	}
	created, err := s.repo.GetByID(ctx, n.ID)
	if err != nil {
		return NoteDTO{}, errs.Internal("reload note", err)
	}
	return toNoteDTO(created), nil
}

// Update modifies the note. Ownership check: only the creator can update.
func (s *Service) Update(ctx context.Context, userID, id string, in APIInput) (NoteDTO, error) {
	cur, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return NoteDTO{}, errs.NotFound("Note not found")
		}
		return NoteDTO{}, errs.Internal("get note", err)
	}
	if cur.UserID != userID {
		return NoteDTO{}, errs.Forbidden("Not your note")
	}
	var pos sql.NullInt32
	if in.PositionSec != nil {
		pos = sql.NullInt32{Int32: *in.PositionSec, Valid: true}
	} else {
		pos = cur.PositionSec // keep existing
	}
	if err := s.repo.Update(ctx, id, in.Content, pos); err != nil {
		return NoteDTO{}, errs.Internal("update note", err)
	}
	upd, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return NoteDTO{}, errs.Internal("reload note", err)
	}
	return toNoteDTO(upd), nil
}

// Delete removes the note. Ownership check: only the creator can delete.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	cur, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Note not found")
		}
		return errs.Internal("get note", err)
	}
	if cur.UserID != userID {
		return errs.Forbidden("Not your note")
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete note", err)
	}
	return nil
}
