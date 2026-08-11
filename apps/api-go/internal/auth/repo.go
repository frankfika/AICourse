// Package auth — repo layer.
//
// Phase 1 T7: thin wrapper around internal/repo/db (sqlc-generated) that
// gives the auth provider a single interface to call, so the rest of the
// package doesn't have to know about sqlc types or transaction plumbing.
//
// All queries are 1:1 with apps/api-go/db/queries/{users,auth}.sql; we don't
// embed business logic here, only the parameter shaping + UUID generation
// that NestJS used to do in services.ts.
package auth

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
// Auth callers translate this into errs.NotFound / 401 as appropriate.
var ErrNotFound = errors.New("auth: not found")

// AuthRepo is the auth-facing data layer. It owns the db.Queries reference
// and is safe to share across goroutines (sqlc's Queries is a thin wrapper
// over DBTX, and *sql.DB is goroutine-safe).
type AuthRepo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewAuthRepo constructs an AuthRepo from an open *sql.DB. The caller owns
// the DB lifecycle; AuthRepo holds a *db.Queries built on top.
func NewAuthRepo(conn *sql.DB) *AuthRepo {
	return &AuthRepo{q: db.New(conn), conn: conn}
}

// GetUserByEmail looks up a user by email. Returns ErrNotFound if missing.
func (r *AuthRepo) GetUserByEmail(ctx context.Context, email string) (db.User, error) {
	u, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.User{}, ErrNotFound
		}
		return db.User{}, fmt.Errorf("auth.repo: get user by email: %w", err)
	}
	return u, nil
}

// GetUserByID looks up a user by primary key.
func (r *AuthRepo) GetUserByID(ctx context.Context, id string) (db.User, error) {
	u, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.User{}, ErrNotFound
		}
		return db.User{}, fmt.Errorf("auth.repo: get user by id: %w", err)
	}
	return u, nil
}

// CreateUser inserts a new user. The user ID and timestamps are generated
// here because Prisma's @default(uuid()) and @default(now()) are
// application-side, not database-side (see Phase 0 T4 finding).
func (r *AuthRepo) CreateUser(ctx context.Context, email, passwordHash, name string) (db.User, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := r.q.CreateUser(ctx, db.CreateUserParams{
		ID:                    id,
		Email:                 email,
		PasswordHash:          passwordHash,
		Name:                  name,
		Role:                  db.UsersRoleStudent,
		AvatarUrl:             sql.NullString{},
		PasswordResetRequired: false,
		Points:                0,
		Level:                 0,
		CreatedAt:             now,
		UpdatedAt:             now,
	}); err != nil {
		return db.User{}, fmt.Errorf("auth.repo: create user: %w", err)
	}
	return db.User{
		ID:                    id,
		Email:                 email,
		PasswordHash:          passwordHash,
		Name:                  name,
		Role:                  db.UsersRoleStudent,
		PasswordResetRequired: false,
		CreatedAt:             now,
		UpdatedAt:             now,
	}, nil
}

// CreateProviderAccount binds a (provider, providerUserID) tuple to a user.
// Mirrors CreateProviderAccount in auth.sql. The caller decides whether
// this is the user's first provider (IsPrimary=true) or an additional one.
func (r *AuthRepo) CreateProviderAccount(ctx context.Context, userID, provider, providerUserID, email, displayName string, isPrimary bool) (db.UserProviderAccount, error) {
	now := time.Now().UTC()
	if _, err := r.q.CreateProviderAccount(ctx, db.CreateProviderAccountParams{
		ID:             uuid.NewString(),
		UserID:         userID,
		Provider:       provider,
		ProviderUserID: providerUserID,
		Email:          sql.NullString{String: email, Valid: email != ""},
		DisplayName:    sql.NullString{String: displayName, Valid: displayName != ""},
		IsPrimary:      isPrimary,
		LinkedAt:       now,
		LastUsedAt:     now,
		DeletedAt:      sql.NullTime{},
		Profile:        []byte(`{}`),
		CreatedAt:      now,
		UpdatedAt:      now,
	}); err != nil {
		return db.UserProviderAccount{}, fmt.Errorf("auth.repo: create provider account: %w", err)
	}
	return db.UserProviderAccount{
		ID:             uuid.NewString(), // we don't re-read; ogen handlers don't need the generated ID
		UserID:         userID,
		Provider:       provider,
		ProviderUserID: providerUserID,
		Email:          sql.NullString{String: email, Valid: email != ""},
		DisplayName:    sql.NullString{String: displayName, Valid: displayName != ""},
		IsPrimary:      isPrimary,
		LinkedAt:       now,
		LastUsedAt:     now,
		Profile:        []byte(`{}`),
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

// GetProviderAccountByProvider looks up a (provider, providerUserID) link.
func (r *AuthRepo) GetProviderAccountByProvider(ctx context.Context, provider, providerUserID string) (db.UserProviderAccount, error) {
	pa, err := r.q.GetProviderAccountByProvider(ctx, db.GetProviderAccountByProviderParams{
		Provider:       provider,
		ProviderUserID: providerUserID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.UserProviderAccount{}, ErrNotFound
		}
		return db.UserProviderAccount{}, fmt.Errorf("auth.repo: get provider account: %w", err)
	}
	return pa, nil
}

// CreateRefreshToken stores a new refresh token. The token string is what
// we send to the client; nothing about it is hashed here (NestJS storage
// uses the plaintext directly — see password-reset.service.ts:34 and
// auth.service.ts:286 in the source tree).
func (r *AuthRepo) CreateRefreshToken(ctx context.Context, userID, token string, expiresAt time.Time) error {
	if _, err := r.q.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		ID:        uuid.NewString(),
		Token:     token,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}); err != nil {
		return fmt.Errorf("auth.repo: create refresh token: %w", err)
	}
	return nil
}

// GetRefreshToken looks up a refresh token by its plaintext value.
func (r *AuthRepo) GetRefreshToken(ctx context.Context, token string) (db.RefreshToken, error) {
	rt, err := r.q.GetRefreshToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.RefreshToken{}, ErrNotFound
		}
		return db.RefreshToken{}, fmt.Errorf("auth.repo: get refresh token: %w", err)
	}
	return rt, nil
}

// DeleteRefreshToken removes a refresh token by primary key.
func (r *AuthRepo) DeleteRefreshToken(ctx context.Context, id string) error {
	if err := r.q.DeleteRefreshToken(ctx, id); err != nil {
		return fmt.Errorf("auth.repo: delete refresh token: %w", err)
	}
	return nil
}

// DeleteRefreshTokenByToken removes a refresh token by its plaintext value.
// Returns the number of rows affected (0 = token not present).
func (r *AuthRepo) DeleteRefreshTokenByToken(ctx context.Context, token string) (int64, error) {
	n, err := r.q.DeleteRefreshTokenByToken(ctx, db.DeleteRefreshTokenByTokenParams{
		Token:     token,
		ExpiresAt: time.Now().UTC(), // also clears any expired token with same value (defensive)
	})
	if err != nil {
		return 0, fmt.Errorf("auth.repo: delete refresh token by token: %w", err)
	}
	return n, nil
}

// RevokeAllRefreshTokensForUser nukes all refresh tokens belonging to a user.
// Called when reuse-detection fires (a presented refresh token has already
// been rotated, so we assume the user's been compromised).
func (r *AuthRepo) RevokeAllRefreshTokensForUser(ctx context.Context, userID string) error {
	if err := r.q.RevokeAllRefreshTokensForUser(ctx, userID); err != nil {
		return fmt.Errorf("auth.repo: revoke all refresh tokens: %w", err)
	}
	return nil
}

// DropUserFromToken revokes a single refresh token by its plaintext value.
// Used by /auth/logout. The plaintext is hashed before lookup (matches the
// SHA-256 storage invariant). Missing tokens are not an error — logout
// is idempotent.
func (r *AuthRepo) DropUserFromToken(ctx context.Context, plaintext string) error {
	if plaintext == "" {
		return nil
	}
	hash := HashRefreshToken(plaintext)
	if _, err := r.q.DeleteRefreshTokenByToken(ctx, db.DeleteRefreshTokenByTokenParams{
		Token:     hash,
		ExpiresAt: time.Now().UTC(), // also clears any expired token with same hash (defensive)
	}); err != nil {
		return fmt.Errorf("auth.repo: drop user from token: %w", err)
	}
	return nil
}

// UpdateUserLastLogin bumps last_login_at on successful authentication.
func (r *AuthRepo) UpdateUserLastLogin(ctx context.Context, userID string) error {
	now := time.Now().UTC()
	if err := r.q.UpdateUserLastLogin(ctx, db.UpdateUserLastLoginParams{
		LastLoginAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt:   now,
		ID:          userID,
	}); err != nil {
		return fmt.Errorf("auth.repo: update last login: %w", err)
	}
	return nil
}

// ListProviderAccountsByUser returns all (provider, providerUserID)
// bindings for a user. T8 endpoint: GET /auth/identities.
func (r *AuthRepo) ListProviderAccountsByUser(ctx context.Context, userID string) ([]Identity, error) {
	rows, err := r.q.ListProviderAccountsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("auth.repo: list provider accounts: %w", err)
	}
	out := make([]Identity, 0, len(rows))
	for _, row := range rows {
		out = append(out, rowToIdentity(row))
	}
	return out, nil
}

// rowToIdentity maps a sqlc row to the public Identity DTO. Centralized
// so list and any future read paths produce a single shape.
func rowToIdentity(row db.UserProviderAccount) Identity {
	id := Identity{
		ID:             row.ID,
		Provider:       row.Provider,
		ProviderUserID: row.ProviderUserID,
		IsPrimary:      row.IsPrimary,
		LinkedAt:       row.LinkedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		LastUsedAt:     row.LastUsedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if row.Email.Valid {
		id.Email = row.Email.String
	}
	if row.DisplayName.Valid {
		id.DisplayName = row.DisplayName.String
	}
	return id
}

// UnlinkProviderAccount soft-deletes a (user, provider) binding. T8
// endpoint: DELETE /auth/identities/:id. Returns false if the row
// was already soft-deleted (idempotent).
func (r *AuthRepo) UnlinkProviderAccount(ctx context.Context, userID, identityID string) error {
	now := time.Now().UTC()
	n, err := r.q.UnlinkProviderAccount(ctx, db.UnlinkProviderAccountParams{
		DeletedAt: sql.NullTime{Time: now, Valid: true},
		ID:        identityID,
		UserID:    userID,
	})
	if err != nil {
		return fmt.Errorf("auth.repo: unlink: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// CountPrimaryProviders returns the number of non-deleted primary
// providers for a user. Used to refuse unlinking the last primary.
func (r *AuthRepo) CountPrimaryProviders(ctx context.Context, userID string) (int64, error) {
	return r.q.CountUserProviderAccounts(ctx, userID)
}

// LinkProviderAccount inserts a new provider binding. Phase 2 T8.
func (r *AuthRepo) LinkProviderAccount(ctx context.Context, userID, provider, providerUserID string, profile AuthProfile) error {
	now := time.Now().UTC()
	_, err := r.q.CreateProviderAccount(ctx, db.CreateProviderAccountParams{
		ID:             uuid.NewString(),
		UserID:         userID,
		Provider:       provider,
		ProviderUserID: providerUserID,
		Email:          sql.NullString{String: profile.Email, Valid: profile.Email != ""},
		DisplayName:    sql.NullString{String: profile.Name, Valid: profile.Name != ""},
		IsPrimary:      false, // linking is always secondary
		LinkedAt:       now,
		LastUsedAt:     now,
		DeletedAt:      sql.NullTime{},
		Profile:        []byte(`{}`),
		CreatedAt:      now,
		UpdatedAt:      now,
	})
	if err != nil {
		return fmt.Errorf("auth.repo: link provider: %w", err)
	}
	return nil
}
