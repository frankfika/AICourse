// Package enterprise — repo + service for B2B inquiry form + admin inbox.
//
// Phase 2 T22: ports the 4 endpoints of
// apps/api/src/modules/enterprise/.
//
// Phase 2 T22.1: wires the audit_log writes (3 actions:
// enterprise_inquiry_created / status_update / deleted) and the
// cross-module Resend notification hook. The notifier is a
// package-level function pointer that main.go overrides with a
// real Resend client; tests can swap it freely. Same pattern as
// orders.SetRefundNotifier.
//
// Routes:
//
//	POST   /api/v1/enterprise/inquiries        public, rate-limited
//	GET    /api/v1/enterprise/inquiries        admin
//	PATCH  /api/v1/enterprise/inquiries/:id/status   admin
//	DELETE /api/v1/enterprise/inquiries/:id    admin
package enterprise

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
var ErrNotFound = errors.New("enterprise: inquiry not found")

// Audit action constants — kept in sync with the
// apps/api/src/modules/enterprise/enterprise.service.ts actions
// (lowercased to match the order.refund etc. patterns in this repo).
const (
	AuditActionCreated   = "enterprise_inquiry_created"
	AuditActionStatusUpd = "enterprise_inquiry_status_update"
	AuditActionDeleted   = "enterprise_inquiry_deleted"

	AuditEntity = "enterprise_inquiry"
)

// Valid status values — must match the MySQL ENUM in 0001_init.sql.
const (
	StatusPending   = "pending"
	StatusContacted = "contacted"
	StatusQualified = "qualified"
	StatusClosed    = "closed"
	StatusArchived  = "archived"
)

func validStatus(s string) bool {
	switch db.EnterpriseInquiriesStatus(s) {
	case db.EnterpriseInquiriesStatusPending,
		db.EnterpriseInquiriesStatusContacted,
		db.EnterpriseInquiriesStatusQualified,
		db.EnterpriseInquiriesStatusClosed,
		db.EnterpriseInquiriesStatusArchived:
		return true
	}
	return false
}

// Valid team_size values — must match the IsIn() set in
// apps/api/src/modules/enterprise/enterprise.dto.ts.
const (
	TeamSize1to10     = "1-10"
	TeamSize11to50    = "11-50"
	TeamSize51to200   = "51-200"
	TeamSize201to1000 = "201-1000"
	TeamSize1000plus  = "1000+"
)

func validTeamSize(s string) bool {
	switch s {
	case TeamSize1to10, TeamSize11to50, TeamSize51to200,
		TeamSize201to1000, TeamSize1000plus:
		return true
	}
	return false
}

// ============ Resend notifier (cross-module hook) ============

// ResendNotifier is the package-level function pointer that fires a
// "your inquiry has been updated" email. Defaults to a no-op so the
// enterprise module works without a Resend client; main.go (or a
// test) overrides it with a real impl via SetResendNotifier.
//
// Signature: (inquiryID, recipientEmail, subject, body). The
// recipientEmail is included so the Resend client doesn't need to
// re-query the inquiry row.
var ResendNotifier = func(_ context.Context, _ string, _ string, _ string, _ string) {}

// ResendNotifierCall captures the arguments of the last call. Tests
// reset this to nil at the start of each assertion. The real
// production impl (set in main.go) doesn't touch this var.
var ResendNotifierCall *NotifierCall

// NotifierCall is the recorded argument set for an assertion.
type NotifierCall struct {
	InquiryID string
	Email     string
	Subject   string
	Body      string
}

// SetResendNotifier wires a real notifier. Resets the recorded
// NotifierCall to nil. Pass nil to restore the no-op default.
func SetResendNotifier(fn func(ctx context.Context, inquiryID, email, subject, body string)) {
	if fn == nil {
		ResendNotifier = func(_ context.Context, _ string, _ string, _ string, _ string) {}
		ResendNotifierCall = nil
		return
	}
	ResendNotifier = fn
	ResendNotifierCall = nil
}

// fireNotifier is the internal wrapper that records the call before
// delegating. Production code (when ResendNotifier has been swapped
// to a real impl) does not see this recording overhead because the
// recording is a single struct assignment.
func fireNotifier(ctx context.Context, inquiryID, email, subject, body string) {
	ResendNotifierCall = &NotifierCall{InquiryID: inquiryID, Email: email, Subject: subject, Body: body}
	ResendNotifier(ctx, inquiryID, email, subject, body)
}

// ============ Repo ============

// Repo is the enterprise-inquiry data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// GetByID looks up a single inquiry.
func (r *Repo) GetByID(ctx context.Context, id string) (db.EnterpriseInquiry, error) {
	row, err := r.q.GetEnterpriseInquiryByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.EnterpriseInquiry{}, ErrNotFound
		}
		return db.EnterpriseInquiry{}, fmt.Errorf("enterprise.repo: get: %w", err)
	}
	return row, nil
}

// List returns all non-deleted inquiries, newest first.
func (r *Repo) List(ctx context.Context) ([]db.EnterpriseInquiry, error) {
	rows, err := r.q.ListEnterpriseInquiries(ctx)
	if err != nil {
		return nil, fmt.Errorf("enterprise.repo: list: %w", err)
	}
	return rows, nil
}

// Create inserts a new inquiry.
func (r *Repo) Create(ctx context.Context, in db.EnterpriseInquiry) error {
	_, err := r.q.CreateEnterpriseInquiry(ctx, db.CreateEnterpriseInquiryParams{
		ID:          in.ID,
		Name:        in.Name,
		Email:       in.Email,
		Company:     in.Company,
		TeamSize:    in.TeamSize,
		Phone:       in.Phone,
		Topic:       in.Topic,
		Description: in.Description,
		Status:      in.Status,
		CreatedAt:   in.CreatedAt,
		UpdatedAt:   in.UpdatedAt,
	})
	return err
}

// UpdateStatus overwrites the status column.
func (r *Repo) UpdateStatus(ctx context.Context, id string, status db.EnterpriseInquiriesStatus, now time.Time) error {
	return r.q.UpdateEnterpriseInquiryStatus(ctx, db.UpdateEnterpriseInquiryStatusParams{
		Status:    status,
		UpdatedAt: now,
		ID:        id,
	})
}

// Delete hard-deletes a single inquiry row.
func (r *Repo) Delete(ctx context.Context, id string) error {
	return r.q.DeleteEnterpriseInquiry(ctx, id)
}

// InquiryDTO is the public JSON shape of an inquiry.
type InquiryDTO struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Email       string  `json:"email"`
	Company     string  `json:"company"`
	TeamSize    string  `json:"teamSize"`
	Phone       *string `json:"phone,omitempty"`
	Topic       string  `json:"topic"`
	Description *string `json:"description,omitempty"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

func toInquiryDTO(in db.EnterpriseInquiry) InquiryDTO {
	dto := InquiryDTO{
		ID:        in.ID,
		Name:      in.Name,
		Email:     in.Email,
		Company:   in.Company,
		TeamSize:  in.TeamSize,
		Topic:     in.Topic,
		Status:    string(in.Status),
		CreatedAt: in.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: in.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if in.Phone.Valid {
		s := in.Phone.String
		dto.Phone = &s
	}
	if in.Description.Valid {
		s := in.Description.String
		dto.Description = &s
	}
	return dto
}

// Service is the enterprise business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// CreateInput is the validated payload for a new inquiry.
type CreateInput struct {
	Name        string
	Email       string
	Company     string
	TeamSize    string
	Phone       string
	Topic       string
	Description string
}

// Create inserts a new inquiry. Validation mirrors the NestJS DTO:
// required fields non-empty, teamSize in allowlist, email format
// is the handler's responsibility (caller runs IsEmail() before
// hitting this method). T22.1: also writes an audit_log row.
func (s *Service) Create(ctx context.Context, in CreateInput) (InquiryDTO, error) {
	if in.Name == "" || in.Email == "" || in.Company == "" || in.Topic == "" {
		return InquiryDTO{}, errs.BadRequest("name, email, company, topic are required")
	}
	if !validTeamSize(in.TeamSize) {
		return InquiryDTO{}, errs.BadRequest("teamSize must be one of 1-10, 11-50, 51-200, 201-1000, 1000+")
	}
	now := time.Now().UTC()
	row := db.EnterpriseInquiry{
		ID:        uuid.NewString(),
		Name:      in.Name,
		Email:     in.Email,
		Company:   in.Company,
		TeamSize:  in.TeamSize,
		Topic:     in.Topic,
		Status:    db.EnterpriseInquiriesStatus(StatusPending),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if in.Phone != "" {
		row.Phone = sql.NullString{String: in.Phone, Valid: true}
	}
	if in.Description != "" {
		row.Description = sql.NullString{String: in.Description, Valid: true}
	}
	if err := s.repo.Create(ctx, row); err != nil {
		return InquiryDTO{}, errs.Internal("create inquiry", err)
	}
	// Reload to get DB-computed timestamps and enum-typed status.
	created, err := s.repo.GetByID(ctx, row.ID)
	if err != nil {
		return InquiryDTO{}, errs.Internal("reload inquiry", err)
	}
	// T22.1: audit_log row. Best-effort; logged but not propagated
	// (matches the orders.Service.writeAudit pattern).
	s.writeAudit(ctx, AuditActionCreated, created.ID, map[string]any{
		"name":        created.Name,
		"company":     created.Company,
		"email":       created.Email,
		"teamSize":    created.TeamSize,
		"topic":       created.Topic,
		"description": nullableString(created.Description),
	})
	return toInquiryDTO(created), nil
}

// List returns all non-deleted inquiries.
func (s *Service) List(ctx context.Context) ([]InquiryDTO, error) {
	rows, err := s.repo.List(ctx)
	if err != nil {
		return nil, errs.Internal("list inquiries", err)
	}
	out := make([]InquiryDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toInquiryDTO(r))
	}
	return out, nil
}

// UpdateStatus overwrites the status column. Refuses unknown status
// values with 400. Returns 404 when the inquiry doesn't exist.
// T22.1: writes an audit_log row with from/to status, and fires
// the Resend notifier for the admin-facing transition to
// 'contacted' or 'qualified' (matches the NestJS service flow).
func (s *Service) UpdateStatus(ctx context.Context, id, status string) (InquiryDTO, error) {
	if !validStatus(status) {
		return InquiryDTO{}, errs.BadRequest(
			"status must be pending, contacted, qualified, closed, or archived")
	}
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return InquiryDTO{}, errs.NotFound("Inquiry not found")
		}
		return InquiryDTO{}, errs.Internal("get inquiry", err)
	}
	if err := s.repo.UpdateStatus(ctx, id, db.EnterpriseInquiriesStatus(status), time.Now().UTC()); err != nil {
		return InquiryDTO{}, errs.Internal("update status", err)
	}
	upd, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return InquiryDTO{}, errs.Internal("reload inquiry", err)
	}
	// T22.1: audit_log row with from/to status.
	s.writeAudit(ctx, AuditActionStatusUpd, id, map[string]any{
		"from":  string(existing.Status),
		"to":    string(upd.Status),
		"email": upd.Email,
	})
	// T22.1: Resend notification on the user-visible transitions.
	// The NestJS service.sendEnterpriseInquiryNotification only fires
	// once on create; we fire again on admin status changes so the
	// inquirer gets a "we've looked at your request" email.
	if shouldNotifyOnStatus(string(existing.Status), string(upd.Status)) {
		fireNotifier(ctx, id, upd.Email,
			"Your inquiry has been updated",
			fmt.Sprintf("Hello %s,\n\nYour enterprise inquiry (topic: %s) has been moved to status '%s'. We'll be in touch shortly.\n\n— AI Academy team",
				upd.Name, upd.Topic, upd.Status))
	}
	return toInquiryDTO(upd), nil
}

// shouldNotifyOnStatus returns true when the (from, to) status pair
// represents an admin acknowledging the inquiry. Only the two
// 'forward-progress' transitions (pending → contacted, pending →
// qualified, contacted → qualified) get a user email — the rest are
// internal-only and would just spam the inquirer.
func shouldNotifyOnStatus(from, to string) bool {
	switch to {
	case StatusContacted:
		return from == StatusPending
	case StatusQualified:
		return from == StatusPending || from == StatusContacted
	}
	return false
}

// Delete hard-deletes an inquiry. Returns 404 when not found.
// T22.1: writes an audit_log row before the row vanishes.
func (s *Service) Delete(ctx context.Context, id string) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("Inquiry not found")
		}
		return errs.Internal("get inquiry", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errs.Internal("delete inquiry", err)
	}
	s.writeAudit(ctx, AuditActionDeleted, id, map[string]any{
		"email":   existing.Email,
		"company": existing.Company,
	})
	return nil
}

// writeAudit appends a best-effort audit_log row. Mirrors the
// orders.Service.writeAudit pattern (raw ExecContext with JSON_OBJECT).
func (s *Service) writeAudit(ctx context.Context, action, entityID string, details map[string]any) {
	if details == nil {
		details = map[string]any{}
	}
	raw, err := json.Marshal(details)
	if err != nil {
		s.log.Warn("enterprise audit marshal failed",
			zap.String("action", action), zap.Error(err))
		return
	}
	if _, err := s.repo.q.WriteAuditLog(ctx, db.WriteAuditLogParams{
		ID:        uuid.NewString(),
		UserID:    sql.NullString{},
		Action:    action,
		Entity:    AuditEntity,
		EntityID:  sql.NullString{String: entityID, Valid: true},
		Details:   sql.NullString{String: string(raw), Valid: true},
		IpAddress: sql.NullString{},
		UserAgent: sql.NullString{},
		CreatedAt: time.Now().UTC(),
	}); err != nil {
		s.log.Warn("enterprise audit write failed",
			zap.String("action", action), zap.String("entityId", entityID), zap.Error(err))
	}
}

// nullableString returns nil for an invalid NullString so the JSON
// marshals as null (not the empty string).
func nullableString(ns sql.NullString) any {
	if !ns.Valid {
		return nil
	}
	return ns.String
}
