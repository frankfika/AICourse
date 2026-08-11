// Package audit — admin read-only access to the audit log. Mirrors
// apps/api/src/modules/audit/audit-log.controller.ts 1:1.
//
// Phase 2 T24: 1 endpoint (admin list with filters). The NestJS
// module also has a `log()` helper used by the other services; the
// Go side already has direct-SQL writes scattered across the other
// service files (see internal/instructors/instructors.go::writeAudit,
// internal/enterprise/enterprise.go TODO markers, etc.) so we don't
// re-expose it here. The T24 scope is just the admin GET.
//
// Route:
//
//	GET /api/v1/audit-logs   admin
//
// Filters: userId, entity, action, relatedUserId, page, limit.
// The `relatedUserId` filter is OR-combined against `userId` and the
// `entity='user' + entityId=<relatedUserId>` pair (see NestJS
// audit-log.service.ts:86-91).
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
)

// ListParams mirrors the audit-log controller query-string inputs.
type ListParams struct {
	UserID        string
	Entity        string
	Action        string
	RelatedUserID string
	Page          int
	Limit         int
}

// ListResult is the paginated list response. The NestJS source wraps
// rows as `{ data, total, page, limit }`; we mirror that envelope.
type ListResult struct {
	Data  []AuditLogView `json:"data"`
	Total int64          `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}

// AuditLogView is the admin-facing JSON shape of an audit row.
// Mirrors NestJS's `AuditLog` Prisma model field-for-field (camelCase
// keys; nullable fields use pointers).
type AuditLogView struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"userId,omitempty"`
	Action    string    `json:"action"`
	Entity    string    `json:"entity"`
	EntityID  *string   `json:"entityId,omitempty"`
	Details   any       `json:"details"` // parsed JSON (null when raw is null)
	IPAddress *string   `json:"ipAddress,omitempty"`
	UserAgent *string   `json:"userAgent,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Service is the audit-read business logic.
type Service struct {
	q    *db.Queries
	conn *sql.DB
}

// NewService builds a Service.
func NewService(conn *sql.DB) *Service {
	return &Service{q: db.New(conn), conn: conn}
}

// List returns paginated audit logs. The WHERE is composed
// dynamically because the filter combinations are open-ended. The
// instructor query (instructors.go::List) uses the same pattern —
// raw `conn.QueryContext` for the list + count pair.
func (s *Service) List(ctx context.Context, p ListParams) (ListResult, error) {
	// Clamp inputs to match NestJS validation (page>=1, 1<=limit<=100).
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := p.Limit
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	conds := []string{}
	args := []any{}
	if p.UserID != "" {
		conds = append(conds, "user_id = ?")
		args = append(args, p.UserID)
	}
	if p.Entity != "" {
		conds = append(conds, "entity = ?")
		args = append(args, p.Entity)
	}
	if p.Action != "" {
		conds = append(conds, "action = ?")
		args = append(args, p.Action)
	}
	if p.RelatedUserID != "" {
		// OR-combined: user_id matches OR (entity='user' AND entity_id matches).
		conds = append(conds, "(user_id = ? OR (entity = 'user' AND entity_id = ?))")
		args = append(args, p.RelatedUserID, p.RelatedUserID)
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	// Count.
	var total int64
	if err := s.conn.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM audit_logs "+where, args...,
	).Scan(&total); err != nil {
		return ListResult{}, errs.Internal("count audit logs", err)
	}

	// Page.
	rows, err := s.conn.QueryContext(ctx, fmt.Sprintf(`
		SELECT id, user_id, action, entity, entity_id, details, ip_address, user_agent, created_at
		FROM audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, where), append(append([]any{}, args...), limit, offset)...)
	if err != nil {
		return ListResult{}, errs.Internal("list audit logs", err)
	}
	defer rows.Close()

	out := make([]AuditLogView, 0, limit)
	for rows.Next() {
		var (
			v         AuditLogView
			userID    sql.NullString
			entityID  sql.NullString
			detailsNS sql.NullString
			ipNS      sql.NullString
			uaNS      sql.NullString
		)
		if err := rows.Scan(
			&v.ID, &userID, &v.Action, &v.Entity, &entityID, &detailsNS, &ipNS, &uaNS, &v.CreatedAt,
		); err != nil {
			return ListResult{}, errs.Internal("scan audit log", err)
		}
		if userID.Valid {
			s := userID.String
			v.UserID = &s
		}
		if entityID.Valid {
			s := entityID.String
			v.EntityID = &s
		}
		if ipNS.Valid {
			s := ipNS.String
			v.IPAddress = &s
		}
		if uaNS.Valid {
			s := uaNS.String
			v.UserAgent = &s
		}
		// NestJS stores details as a JSON string and parses it
		// before returning. We do the same so the response shape
		// matches.
		if detailsNS.Valid && detailsNS.String != "" {
			var parsed any
			if err := json.Unmarshal([]byte(detailsNS.String), &parsed); err == nil {
				v.Details = parsed
			} else {
				// Fall back to the raw string if it isn't valid
				// JSON — better to surface the bytes than null.
				v.Details = detailsNS.String
			}
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, errs.Internal("iterate audit logs", err)
	}

	return ListResult{
		Data:  out,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// Write is the audit-log append helper. The NestJS service exposes
// this to every other module; the Go side has it on each writer
// (see internal/instructors/instructors.go::writeAudit) to keep the
// call sites simple. We re-export it here for callers that prefer
// the package as the single entry point. The id is supplied by the
// caller (uuid).
func (s *Service) Write(ctx context.Context, p WriteParams) error {
	if p.ID == "" || p.Action == "" || p.Entity == "" {
		return errors.New("audit.Write: id, action, entity are required")
	}
	details := sql.NullString{}
	if p.Details != nil {
		raw, err := json.Marshal(p.Details)
		if err != nil {
			return fmt.Errorf("audit.Write: marshal details: %w", err)
		}
		details = sql.NullString{String: string(raw), Valid: true}
	}
	userID := sql.NullString{}
	if p.UserID != "" {
		userID = sql.NullString{String: p.UserID, Valid: true}
	}
	entityID := sql.NullString{}
	if p.EntityID != "" {
		entityID = sql.NullString{String: p.EntityID, Valid: true}
	}
	ip := sql.NullString{}
	if p.IPAddress != "" {
		ip = sql.NullString{String: p.IPAddress, Valid: true}
	}
	ua := sql.NullString{}
	if p.UserAgent != "" {
		ua = sql.NullString{String: p.UserAgent, Valid: true}
	}
	now := time.Now().UTC()
	if p.CreatedAt != nil {
		now = *p.CreatedAt
	}
	_, err := s.q.WriteAuditLog(ctx, db.WriteAuditLogParams{
		ID:        p.ID,
		UserID:    userID,
		Action:    p.Action,
		Entity:    p.Entity,
		EntityID:  entityID,
		Details:   details,
		IpAddress: ip,
		UserAgent: ua,
		CreatedAt: now,
	})
	return err
}

// WriteParams is the input to Service.Write. Mirrors
// audit-log.service.ts::log().
type WriteParams struct {
	ID        string
	UserID    string
	Action    string
	Entity    string
	EntityID  string
	Details   any
	IPAddress string
	UserAgent string
	CreatedAt *time.Time
}
