// Package certificates — repo layer.
//
// Phase 2 T14-3: thin wrapper around internal/repo/db for the
// certificates module. Mirrors apps/api/src/modules/certificates/certificates.service.ts.
package certificates

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("certificates: not found")

// Repo is the certificates data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ListByUser returns the user's certificates (excludes revoked).
// type="" means "no filter".
func (r *Repo) ListByUser(ctx context.Context, userID, typ string) ([]db.Certificate, error) {
	// sqlc infers the second `?` (in `(? = '' OR type = ?)`) as
	// interface{} because of the type mismatch with the first `?`
	// (which is compared to ''). Pass a string-converted value.
	var typArg any = typ
	if typ == "" {
		typArg = ""
	}
	rows, err := r.q.ListMyCertificates(ctx, db.ListMyCertificatesParams{
		UserID:  userID,
		Column2: typArg,
		Type:    db.CertificatesType(typ),
	})
	if err != nil {
		return nil, fmt.Errorf("certificates.repo: list: %w", err)
	}
	out := make([]db.Certificate, 0, len(rows))
	for _, x := range rows {
		out = append(out, toCertificate(x.ID, x.UserID, x.Type, x.RefID, x.Title, x.Description, x.SerialNumber, x.IssuedAt, x.CompletedAt, x.ImageUrl, x.VerifyUrl, x.Metadata, x.RevokedAt, x.CreatedAt, x.UpdatedAt))
	}
	return out, nil
}

// GetByID looks up a certificate by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (db.Certificate, error) {
	c, err := r.q.GetCertificateByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Certificate{}, ErrNotFound
		}
		return db.Certificate{}, fmt.Errorf("certificates.repo: get: %w", err)
	}
	return toCertificate(c.ID, c.UserID, c.Type, c.RefID, c.Title, c.Description, c.SerialNumber, c.IssuedAt, c.CompletedAt, c.ImageUrl, c.VerifyUrl, c.Metadata, c.RevokedAt, c.CreatedAt, c.UpdatedAt), nil
}

// GetBySerial looks up a certificate by its serial number.
func (r *Repo) GetBySerial(ctx context.Context, serial string) (db.Certificate, error) {
	c, err := r.q.GetCertificateBySerial(ctx, serial)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Certificate{}, ErrNotFound
		}
		return db.Certificate{}, fmt.Errorf("certificates.repo: get by serial: %w", err)
	}
	return toCertificate(c.ID, c.UserID, c.Type, c.RefID, c.Title, c.Description, c.SerialNumber, c.IssuedAt, c.CompletedAt, c.ImageUrl, c.VerifyUrl, c.Metadata, c.RevokedAt, c.CreatedAt, c.UpdatedAt), nil
}

// FindByUserTypeRef returns the existing certificate for the
// (user, type, ref) triple, if any. Used for idempotency.
func (r *Repo) FindByUserTypeRef(ctx context.Context, userID string, typ db.CertificatesType, refID string) (db.Certificate, error) {
	c, err := r.q.GetCertificateByUserTypeRef(ctx, db.GetCertificateByUserTypeRefParams{
		UserID: userID, Type: typ, RefID: refID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Certificate{}, ErrNotFound
		}
		return db.Certificate{}, fmt.Errorf("certificates.repo: find: %w", err)
	}
	return toCertificate(c.ID, c.UserID, c.Type, c.RefID, c.Title, c.Description, c.SerialNumber, c.IssuedAt, c.CompletedAt, c.ImageUrl, c.VerifyUrl, c.Metadata, c.RevokedAt, c.CreatedAt, c.UpdatedAt), nil
}

// Create inserts a new certificate.
func (r *Repo) Create(ctx context.Context, c db.Certificate) error {
	_, err := r.q.CreateCertificate(ctx, db.CreateCertificateParams{
		ID:           c.ID,
		UserID:       c.UserID,
		Type:         c.Type,
		RefID:        c.RefID,
		Title:        c.Title,
		Description:  c.Description,
		SerialNumber: c.SerialNumber,
		IssuedAt:     c.IssuedAt,
		CompletedAt:  c.CompletedAt,
		ImageUrl:     c.ImageUrl,
		VerifyUrl:    c.VerifyUrl,
		Metadata:     c.Metadata,
		UpdatedAt:    c.UpdatedAt,
	})
	return err
}

// Revoke sets revokedAt = now() iff not already revoked.
// Returns ErrNotFound if the row doesn't exist or is already revoked.
func (r *Repo) Revoke(ctx context.Context, id string) (int64, error) {
	now := time.Now().UTC()
	res, err := r.conn.ExecContext(ctx, `
		UPDATE certificates SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL
	`, now, now, id)
	if err != nil {
		return 0, fmt.Errorf("certificates.repo: revoke: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if n == 0 {
		// Check if it exists
		_, err := r.GetByID(ctx, id)
		if err == ErrNotFound {
			return 0, ErrNotFound
		}
		return 0, fmt.Errorf("certificate already revoked")
	}
	return n, nil
}

// CountSerialByPrefix returns the number of certificates with the
// given serial prefix (used by the serial generator to find the next
// available sequence number).
func (r *Repo) CountSerialByPrefix(ctx context.Context, prefix string) (int64, error) {
	return r.q.CountSerialByPrefix(ctx, prefix+"%")
}

// GetUserName returns the user's display name for the holderName field.
func (r *Repo) GetUserName(ctx context.Context, userID string) (string, error) {
	var name sql.NullString
	err := r.conn.QueryRowContext(ctx, `SELECT name FROM users WHERE id = ?`, userID).Scan(&name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("certificates.repo: get user name: %w", err)
	}
	if !name.Valid {
		return "", nil
	}
	return name.String, nil
}

// WriteAudit appends an audit log entry for certificate operations.
// Best-effort: errors are returned but callers may log and continue.
func (r *Repo) WriteAudit(ctx context.Context, userID, action, entity, entityID, detailsJSON string) error {
	now := time.Now().UTC()
	_, err := r.conn.ExecContext(ctx, `
		INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details, created_at)
		VALUES (UUID(), ?, ?, ?, ?, ?, ?)
	`, userID, action, entity, entityID, detailsJSON, now)
	if err != nil {
		return fmt.Errorf("certificates.repo: write audit: %w", err)
	}
	return nil
}

// toCertificate converts the sqlc-generated row fields (with
// IFNULL'd metadata as interface{}) to db.Certificate (with
// metadata as json.RawMessage).
func toCertificate(
	id, userID string,
	typ db.CertificatesType,
	refID, title string,
	description sql.NullString,
	serialNumber string,
	issuedAt, completedAt time.Time,
	imageUrl, verifyUrl sql.NullString,
	metadata interface{},
	revokedAt sql.NullTime,
	createdAt, updatedAt time.Time,
) db.Certificate {
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
	return db.Certificate{
		ID:           id,
		UserID:       userID,
		Type:         typ,
		RefID:        refID,
		Title:        title,
		Description:  description,
		SerialNumber: serialNumber,
		IssuedAt:     issuedAt,
		CompletedAt:  completedAt,
		ImageUrl:     imageUrl,
		VerifyUrl:    verifyUrl,
		Metadata:     meta,
		RevokedAt:    revokedAt,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}
}
