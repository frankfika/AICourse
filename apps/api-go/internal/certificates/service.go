// Package certificates — service layer.
//
// Phase 2 T14-3: business logic for /api/v1/certificates/*.
// Mirrors apps/api/src/modules/certificates/certificates.service.ts 1:1.
//
// Cross-module dependencies:
//   - orders.IssueCertificateOnPaid: this service provides the real
//     implementation; main.go wires it at boot.
package certificates

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service is the certificates business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// CertDTO is the public JSON shape of a certificate. Flattens
// sql.NullString/NullTime/json.RawMessage to plain string (or nil)
// and uses camelCase keys.
type CertDTO struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	Type         string  `json:"type"`
	RefID        string  `json:"refId"`
	Title        string  `json:"title"`
	Description  *string `json:"description,omitempty"`
	SerialNumber string  `json:"serialNumber"`
	IssuedAt     string  `json:"issuedAt"`
	CompletedAt  string  `json:"completedAt"`
	ImageURL     *string `json:"imageUrl,omitempty"`
	VerifyURL    *string `json:"verifyUrl,omitempty"`
	Metadata     any     `json:"metadata,omitempty"`
	RevokedAt    *string `json:"revokedAt,omitempty"`
	HolderName   *string `json:"holderName,omitempty"`
	Valid        *bool   `json:"valid,omitempty"` // for verify-by-id
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

func toCertDTO(c db.Certificate, holderName *string, valid *bool) CertDTO {
	dto := CertDTO{
		ID:           c.ID,
		UserID:       c.UserID,
		Type:         string(c.Type),
		RefID:        c.RefID,
		Title:        c.Title,
		SerialNumber: c.SerialNumber,
		IssuedAt:     c.IssuedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		CompletedAt:  c.CompletedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		CreatedAt:    c.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:    c.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		HolderName:   holderName,
		Valid:        valid,
	}
	if c.Description.Valid {
		s := c.Description.String
		dto.Description = &s
	}
	if c.ImageUrl.Valid {
		s := c.ImageUrl.String
		dto.ImageURL = &s
	}
	if c.VerifyUrl.Valid {
		s := c.VerifyUrl.String
		dto.VerifyURL = &s
	}
	if c.RevokedAt.Valid {
		s := c.RevokedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.RevokedAt = &s
	}
	if len(c.Metadata) > 0 {
		var v any
		if err := json.Unmarshal(c.Metadata, &v); err == nil {
			dto.Metadata = v
		}
	}
	return dto
}

// FindMyCertificates returns the user's certificates, newest first.
// type="" means "all types".
func (s *Service) FindMyCertificates(ctx context.Context, userID, typ string) ([]CertDTO, error) {
	rows, err := s.repo.ListByUser(ctx, userID, typ)
	if err != nil {
		return nil, errs.Internal("list certificates", err)
	}
	// Hydrate holderName in one query
	nameMap, err := s.bulkGetHolderNames(ctx, userID)
	if err != nil {
		return nil, errs.Internal("get holder names", err)
	}
	out := make([]CertDTO, 0, len(rows))
	for _, c := range rows {
		name := nameMap[c.UserID]
		var namePtr *string
		if name != "" {
			namePtr = &name
		}
		out = append(out, toCertDTO(c, namePtr, nil))
	}
	return out, nil
}

// bulkGetHolderNames is a small optimization: 1 user here, but the
// shape supports batched callers.
func (s *Service) bulkGetHolderNames(ctx context.Context, userID string) (map[string]string, error) {
	name, err := s.repo.GetUserName(ctx, userID)
	if err != nil {
		return nil, err
	}
	return map[string]string{userID: name}, nil
}

// FindCertificateByID returns the certificate with holderName + valid flag.
// Public — no auth required. Excludes email for privacy.
func (s *Service) FindCertificateByID(ctx context.Context, id string) (CertDTO, error) {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return CertDTO{}, errs.NotFound("Certificate not found")
		}
		return CertDTO{}, errs.Internal("get certificate", err)
	}
	holder, err := s.repo.GetUserName(ctx, c.UserID)
	if err != nil {
		return CertDTO{}, errs.Internal("get holder", err)
	}
	var namePtr, valid *bool
	valid = boolPtr(c.RevokedAt.Valid == false) // valid = !revoked
	if holder != "" {
		n := holder
		namePtrCopy := &n
		_ = namePtr
		holder = *namePtrCopy
	}
	holderName := holder
	dto := toCertDTO(c, &holderName, valid)
	return dto, nil
}

func boolPtr(b bool) *bool { return &b }

// VerifyResult is the response shape for /verify/:serial.
type VerifyResult struct {
	Valid       bool     `json:"valid"`
	Reason      string   `json:"reason,omitempty"`
	Certificate *CertDTO `json:"certificate,omitempty"`
}

// VerifyCertificate is the public verify endpoint. Anonymous.
// Returns { valid: true, certificate: {...} } or { valid: false, reason: 'revoked' | 'not_found' }.
func (s *Service) VerifyCertificate(ctx context.Context, serial string) (VerifyResult, error) {
	c, err := s.repo.GetBySerial(ctx, serial)
	if err != nil {
		if err == ErrNotFound {
			return VerifyResult{Valid: false, Reason: "not_found"}, nil
		}
		return VerifyResult{}, errs.Internal("get by serial", err)
	}
	if c.RevokedAt.Valid {
		// Return partial cert for transparency (serial + revokedAt)
		var revokedAt *string
		s2 := c.RevokedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		revokedAt = &s2
		partial := CertDTO{
			SerialNumber: c.SerialNumber,
			RevokedAt:    revokedAt,
		}
		return VerifyResult{Valid: false, Reason: "revoked", Certificate: &partial}, nil
	}
	// Not revoked — return the full cert + holderName
	holder, _ := s.repo.GetUserName(ctx, c.UserID)
	if holder == "" {
		holder = "Anonymous"
	}
	dto := toCertDTO(c, &holder, nil)
	return VerifyResult{Valid: true, Certificate: &dto}, nil
}

// IssueInput is the input to issue a certificate.
type IssueInput struct {
	UserID      string
	Type        string // "course" | "degree" | "hackathon"
	RefID       string
	Title       string
	Description string
	CompletedAt *time.Time
	Metadata    json.RawMessage
}

// IssueCertificate inserts a new certificate. Idempotent: if the
// (user, type, ref) triple already has a certificate, returns the
// existing one. Called by the orders service via the
// IssueCertificateOnPaid hook.
func (s *Service) IssueCertificate(ctx context.Context, in IssueInput) (CertDTO, error) {
	if in.UserID == "" || in.Type == "" || in.RefID == "" {
		return CertDTO{}, errs.BadRequest("userId, type, refId required")
	}
	if !validCertType(in.Type) {
		return CertDTO{}, errs.BadRequest("type must be course, degree, or hackathon")
	}
	// Idempotency check
	if existing, err := s.repo.FindByUserTypeRef(ctx, in.UserID, db.CertificatesType(in.Type), in.RefID); err == nil {
		s.log.Info("certificate already issued",
			zap.String("userId", in.UserID),
			zap.String("type", in.Type),
			zap.String("refId", in.RefID))
		return toCertDTO(existing, nil, nil), nil
	} else if err != ErrNotFound {
		return CertDTO{}, errs.Internal("check existing cert", err)
	}

	serial, err := s.generateSerialNumber(ctx, in.Type)
	if err != nil {
		return CertDTO{}, errs.Internal("generate serial", err)
	}
	completedAt := time.Now().UTC()
	if in.CompletedAt != nil {
		completedAt = *in.CompletedAt
	}
	c := db.Certificate{
		ID:           uuid.NewString(),
		UserID:       in.UserID,
		Type:         db.CertificatesType(in.Type),
		RefID:        in.RefID,
		Title:        in.Title,
		SerialNumber: serial,
		IssuedAt:     time.Now().UTC(),
		CompletedAt:  completedAt,
		VerifyUrl:    sql.NullString{String: "/verify/" + serial, Valid: true},
		Metadata:     in.Metadata,
		UpdatedAt:    time.Now().UTC(),
	}
	if in.Description != "" {
		c.Description = sql.NullString{String: in.Description, Valid: true}
	}
	if err := s.repo.Create(ctx, c); err != nil {
		return CertDTO{}, errs.Internal("create certificate", err)
	}
	// Audit log
	_ = s.repo.WriteAudit(ctx, in.UserID, "certificate.issue", "Certificate", c.ID,
		fmt.Sprintf(`{"type":"%s","refId":"%s","serialNumber":"%s"}`, in.Type, in.RefID, serial))
	return toCertDTO(c, nil, nil), nil
}

// generateSerialNumber returns OCSG-{year}-{TYPE}-{0001..N} based on
// the highest existing seq for the (year, type) prefix.
func (s *Service) generateSerialNumber(ctx context.Context, typ string) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("OCSG-%d-%s-", year, upper(typ))
	rows, err := s.repo.conn.QueryContext(ctx,
		`SELECT serial_number FROM certificates WHERE serial_number LIKE ? ORDER BY serial_number DESC LIMIT 1`,
		prefix+"%")
	if err != nil {
		return "", err
	}
	defer rows.Close()
	next := 1
	if rows.Next() {
		var last string
		if err := rows.Scan(&last); err != nil {
			return "", err
		}
		if len(last) > len(prefix) {
			if n, err := strconv.Atoi(last[len(prefix):]); err == nil {
				next = n + 1
			}
		}
	}
	return fmt.Sprintf("%s%04d", prefix, next), nil
}

// RevokeCertificate marks a certificate as revoked. Admin only.
func (s *Service) RevokeCertificate(ctx context.Context, id, adminUserID string) (CertDTO, error) {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return CertDTO{}, errs.NotFound("Certificate not found")
		}
		return CertDTO{}, errs.Internal("get certificate", err)
	}
	if c.RevokedAt.Valid {
		return CertDTO{}, errs.Conflict("Certificate already revoked")
	}
	if _, err := s.repo.Revoke(ctx, id); err != nil {
		if err == ErrNotFound {
			return CertDTO{}, errs.NotFound("Certificate not found")
		}
		return CertDTO{}, errs.Internal("revoke", err)
	}
	// Reload
	updated, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return CertDTO{}, errs.Internal("reload", err)
	}
	_ = s.repo.WriteAudit(ctx, adminUserID, "certificate.revoke", "Certificate", id,
		fmt.Sprintf(`{"serialNumber":"%s"}`, updated.SerialNumber))
	return toCertDTO(updated, nil, nil), nil
}

// ============ helpers ============

func upper(s string) string {
	out := []byte(s)
	for i, b := range out {
		if b >= 'a' && b <= 'z' {
			out[i] = b - 32
		}
	}
	return string(out)
}

func validCertType(s string) bool {
	switch db.CertificatesType(s) {
	case db.CertificatesTypeCourse,
		db.CertificatesTypeDegree,
		db.CertificatesTypeHackathon:
		return true
	}
	return false
}
