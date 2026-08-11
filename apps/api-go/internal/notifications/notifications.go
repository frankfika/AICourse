// Package notifications — repo + service for the notifications
// module. Mirrors apps/api/src/modules/notification/.
//
// Phase 2 T16-1. 6 endpoints:
//
//	GET    /notifications                list + unread count
//	GET    /notifications/unread-count    just the count
//	POST   /notifications/:id/read        mark one read
//	POST   /notifications/read-all        mark all read
//	DELETE /notifications/:id             soft-delete one
//	POST   /notifications/clear-read      soft-delete all read
package notifications

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
var ErrNotFound = errors.New("notifications: not found")

// Repo is the notifications data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUser returns the user's notifications, newest first.
func (r *Repo) ListByUser(ctx context.Context, userID string, limit int32) ([]db.Notification, error) {
	rows, err := r.q.ListNotificationsByUser(ctx, db.ListNotificationsByUserParams{
		UserID: userID, Limit: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("notifications.repo: list: %w", err)
	}
	return rows, nil
}

// CountUnread returns the user's unread count.
func (r *Repo) CountUnread(ctx context.Context, userID string) (int64, error) {
	return r.q.CountUnreadNotifications(ctx, userID)
}

// MarkRead sets is_read=1 + read_at=now for a single notification.
func (r *Repo) MarkRead(ctx context.Context, userID, id string) error {
	return r.q.MarkNotificationRead(ctx, db.MarkNotificationReadParams{
		ReadAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		ID:     id, UserID: userID,
	})
}

// MarkAllRead sets is_read=1 for all the user's unread notifications.
func (r *Repo) MarkAllRead(ctx context.Context, userID string) error {
	return r.q.MarkAllNotificationsRead(ctx, db.MarkAllNotificationsReadParams{
		ReadAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		UserID: userID,
	})
}

// SoftDelete marks a single notification as deleted.
func (r *Repo) SoftDelete(ctx context.Context, userID, id string) error {
	return r.q.SoftDeleteNotification(ctx, db.SoftDeleteNotificationParams{
		DeletedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		ID:        id, UserID: userID,
	})
}

// ClearRead soft-deletes all the user's read notifications.
func (r *Repo) ClearRead(ctx context.Context, userID string) error {
	return r.q.ClearReadNotifications(ctx, db.ClearReadNotificationsParams{
		DeletedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		UserID:    userID,
	})
}

// Create inserts a new notification. Used by the cross-module hook
// (NotifyOrderCreated, etc.).
func (r *Repo) Create(ctx context.Context, n db.Notification) error {
	_, err := r.q.CreateNotification(ctx, db.CreateNotificationParams{
		ID:        n.ID,
		UserID:    n.UserID,
		Type:      n.Type,
		Title:     n.Title,
		Body:      n.Body,
		LinkUrl:   n.LinkUrl,
		CreatedAt: n.CreatedAt,
	})
	return err
}

// NotificationDTO is the public JSON shape.
type NotificationDTO struct {
	ID        string  `json:"id"`
	UserID    string  `json:"userId"`
	Type      string  `json:"type"`
	Title     string  `json:"title"`
	Body      string  `json:"body"`
	LinkURL   *string `json:"linkUrl,omitempty"`
	IsRead    bool    `json:"isRead"`
	ReadAt    *string `json:"readAt,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

func toNotificationDTO(n db.Notification) NotificationDTO {
	dto := NotificationDTO{
		ID:        n.ID,
		UserID:    n.UserID,
		Type:      string(n.Type),
		Title:     n.Title,
		Body:      n.Body,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if n.LinkUrl.Valid {
		s := n.LinkUrl.String
		dto.LinkURL = &s
	}
	if n.ReadAt.Valid {
		s := n.ReadAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.ReadAt = &s
	}
	return dto
}

// Service is the notifications business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ListResult bundles the user's notifications + unread count.
type ListResult struct {
	Items       []NotificationDTO `json:"items"`
	UnreadCount int64             `json:"unreadCount"`
}

// List returns the user's notifications + the unread count.
func (s *Service) List(ctx context.Context, userID string) (ListResult, error) {
	rows, err := s.repo.ListByUser(ctx, userID, 100)
	if err != nil {
		return ListResult{}, errs.Internal("list notifications", err)
	}
	unread, err := s.repo.CountUnread(ctx, userID)
	if err != nil {
		return ListResult{}, errs.Internal("count unread", err)
	}
	items := make([]NotificationDTO, 0, len(rows))
	for _, n := range rows {
		items = append(items, toNotificationDTO(n))
	}
	return ListResult{Items: items, UnreadCount: unread}, nil
}

// UnreadCount returns just the unread count.
func (s *Service) UnreadCount(ctx context.Context, userID string) (int64, error) {
	return s.repo.CountUnread(ctx, userID)
}

// MarkRead marks a single notification read.
func (s *Service) MarkRead(ctx context.Context, userID, id string) error {
	if err := s.repo.MarkRead(ctx, userID, id); err != nil {
		return errs.Internal("mark read", err)
	}
	return nil
}

// MarkAllRead marks all the user's unread notifications read.
func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	if err := s.repo.MarkAllRead(ctx, userID); err != nil {
		return errs.Internal("mark all read", err)
	}
	return nil
}

// Delete soft-deletes a single notification.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	if err := s.repo.SoftDelete(ctx, userID, id); err != nil {
		return errs.Internal("delete", err)
	}
	return nil
}

// ClearRead soft-deletes all the user's read notifications.
func (s *Service) ClearRead(ctx context.Context, userID string) error {
	if err := s.repo.ClearRead(ctx, userID); err != nil {
		return errs.Internal("clear read", err)
	}
	return nil
}

// CreateNotificationInput is used by the cross-module hook.
type CreateNotificationInput struct {
	UserID  string
	Type    string // "announcement" | "comment" | "hackathon" | "order"
	Title   string
	Body    string
	LinkURL string
}

// CreateNotification inserts a new notification. Used by hooks like
// orders.NotifyOrderCreated.
func (s *Service) CreateNotification(ctx context.Context, in CreateNotificationInput) error {
	if in.UserID == "" || in.Type == "" {
		return errs.BadRequest("userId + type required")
	}
	if !validType(in.Type) {
		return errs.BadRequest("invalid type")
	}
	n := db.Notification{
		ID:        uuid.NewString(),
		UserID:    in.UserID,
		Type:      db.NotificationsType(in.Type),
		Title:     in.Title,
		Body:      in.Body,
		CreatedAt: time.Now().UTC(),
	}
	if in.LinkURL != "" {
		n.LinkUrl = sql.NullString{String: in.LinkURL, Valid: true}
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return errs.Internal("create notification", err)
	}
	return nil
}

func validType(s string) bool {
	switch db.NotificationsType(s) {
	case db.NotificationsTypeAnnouncement,
		db.NotificationsTypeComment,
		db.NotificationsTypeHackathon,
		db.NotificationsTypeOrder:
		return true
	}
	return false
}

// touch json import to keep it for future use
var _ = json.Marshal
