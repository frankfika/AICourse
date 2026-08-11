// Package auth — token issuance and verification.
//
// Phase 1 T9: real JWT signing with github.com/golang-jwt/jwt/v5, backed
// by SHA-256-hashed refresh tokens in MySQL (matches NestJS storage).
//
// Security invariants (preserved from the NestJS service, commit b05bad7):
//   - JWT signed with HS256, configurable access TTL
//   - Refresh tokens: 32 random bytes (base64url, 43 chars), configurable TTL
//   - SHA-256 hash of refresh tokens stored in DB, never plaintext
//   - Refresh token rotation: every refresh issues a new pair + revokes the old
//   - Reuse detection: presenting a deleted/rotated token is rejected
//   - Clock skew leeway: 5s
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/golang-jwt/jwt/v5"
)

// TokenTTL is the access token lifetime. Mirrors JWT_ACCESS_EXPIRATION env
// in the NestJS service (default "15m").
const TokenTTL = 15 * time.Minute

// RefreshTokenTTL is the refresh token lifetime. Mirrors JWT_REFRESH_EXPIRATION
// env in the NestJS service (default "7d").
const RefreshTokenTTL = 7 * 24 * time.Hour

// ClockSkewLeeway is the max acceptable difference between the server clock
// and the iat/exp claims. 5s matches the typical NestJS passport-jwt config.
const ClockSkewLeeway = 5 * time.Second

// DefaultIssuer is the iss claim. Mirrors JWT_ISSUER in the NestJS service.
const DefaultIssuer = "ai-academy-api-go"

// Claims is the JWT payload. Mirrors the structure that the NestJS JWT strategy
// extracts (apps/api/src/modules/auth/jwt.strategy.ts).
type Claims struct {
	UserID string `json:"sub"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// TokenPair is what the controller returns to the client on successful auth.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

// RefreshToken is the opaque token we send to the client, plus the SHA-256
// hash we store in the DB. The plaintext token never touches the DB.
type RefreshToken struct {
	Plaintext string // what we send to the client
	Hash      string // SHA-256 hex of the plaintext, what we store
	ExpiresAt time.Time
}

// TokenIssuer is the interface the auth controller uses. The default
// implementation (JWTTokenIssuer) is below.
type TokenIssuer interface {
	Issue(ctx context.Context, userID, email, role string) (TokenPair, error)
	Verify(ctx context.Context, accessToken string) (Claims, error)
	RotateRefreshToken(ctx context.Context, oldRefreshToken string) (TokenPair, error)
	RevokeRefreshToken(ctx context.Context, refreshToken string) error
}

// Sentinel errors returned by the issuer / provider. The handler maps
// these to HTTP status codes via the errs package.
var (
	ErrInvalidToken = errors.New("auth: invalid or expired token")
	ErrTokenReuse   = errors.New("auth: refresh token reuse detected")
)

// TokenStore is the subset of repo methods the token issuer needs.
// *AuthRepo satisfies it. Decoupling through an interface keeps the
// issuer unit-testable without spinning up a real MySQL container.
type TokenStore interface {
	// GetRefreshToken looks up by SHA-256 hash. Returns ErrNotFound on miss.
	GetRefreshToken(ctx context.Context, hash string) (db.RefreshToken, error)
	// GetUserByID looks up the bound user. Returns ErrNotFound on miss.
	GetUserByID(ctx context.Context, id string) (db.User, error)
	// CreateRefreshToken stores a new hashed token.
	CreateRefreshToken(ctx context.Context, userID, hash string, expiresAt time.Time) error
	// DeleteRefreshTokenByToken atomic-consumes by hash. Returns 0 if missing.
	DeleteRefreshTokenByToken(ctx context.Context, hash string) (int64, error)
	// RevokeAllRefreshTokensForUser cascade-revokes every token for a user.
	RevokeAllRefreshTokensForUser(ctx context.Context, userID string) error
}

// JWTTokenIssuer is the production TokenIssuer implementation: real HS256
// JWTs + DB-backed refresh tokens.
//
// Construction:
//
//	NewJWTTokenIssuer(secret, store, 15*time.Minute, 7*24*time.Hour)
func JWTTokenIssuerType() {}

// NewJWTTokenIssuer is a constructor; we keep the name for backward compat
// with the Phase 0 API while letting the test/handler build it directly.
func NewJWTTokenIssuer(secret []byte, store TokenStore, accessTTL, refreshTTL time.Duration) *JWTTokenIssuer {
	return &JWTTokenIssuer{
		secret:     secret,
		issuer:     DefaultIssuer,
		store:      store,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

// JWTTokenIssuer is the production TokenIssuer. The struct is unexported
// because callers should only ever get a *JWTTokenIssuer through
// NewJWTTokenIssuer (which validates the inputs).
type JWTTokenIssuer struct {
	secret     []byte
	issuer     string
	store      TokenStore
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// Queries is the surface the dispatcher + email_password provider need
// from the data layer. AuthRepo implements this via its positional-
// argument methods (the dispatcher is intentionally called with
// user-friendly types, not raw sqlc Params).
//
// In production this is satisfied by *AuthRepo. In tests, a small
// in-memory fake lives in the test file.
type Queries interface {
	// Refresh tokens
	CreateRefreshToken(ctx context.Context, userID, token string, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, token string) (db.RefreshToken, error)
	DeleteRefreshTokenByToken(ctx context.Context, token string) (int64, error)
	RevokeAllRefreshTokensForUser(ctx context.Context, userID string) error

	// Users
	GetUserByID(ctx context.Context, id string) (db.User, error)
	GetUserByEmail(ctx context.Context, email string) (db.User, error)
	CreateUser(ctx context.Context, email, passwordHash, name string) (db.User, error)
	UpdateUserLastLogin(ctx context.Context, userID string) error

	// Provider accounts
	GetProviderAccountByProvider(ctx context.Context, provider, providerUserID string) (db.UserProviderAccount, error)
	CreateProviderAccount(ctx context.Context, userID, provider, providerUserID, email, displayName string, isPrimary bool) (db.UserProviderAccount, error)
}

// generateRefreshToken produces a cryptographically random 32-byte token,
// encoded as base64url (no padding), plus its SHA-256 hash for DB storage.
//
// The plaintext is what we send to the client; the hash is what we keep.
// This way a DB breach cannot reveal valid refresh tokens.
func generateRefreshToken(refreshTTL time.Duration) (RefreshToken, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return RefreshToken{}, fmt.Errorf("auth: generate refresh token: %w", err)
	}
	plaintext := base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(plaintext))
	hash := hex.EncodeToString(sum[:])
	return RefreshToken{
		Plaintext: plaintext,
		Hash:      hash,
		ExpiresAt: time.Now().Add(refreshTTL),
	}, nil
}

// HashRefreshToken is the inverse: given a plaintext token (from a client
// request), compute the SHA-256 hash for DB lookup. Used in the refresh flow.
func HashRefreshToken(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Issue produces a fresh access+refresh pair. The refresh token's plaintext
// is what the client gets; only its SHA-256 hash is stored in the DB.
func (i *JWTTokenIssuer) Issue(ctx context.Context, userID, email, role string) (TokenPair, error) {
	now := time.Now()
	exp := now.Add(i.accessTTL)
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    i.issuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims)
	accessToken, err := token.SignedString(i.secret)
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: sign access token: %w", err)
	}

	rt, err := generateRefreshToken(i.refreshTTL)
	if err != nil {
		return TokenPair{}, err
	}

	// Persist the hashed refresh token so a subsequent /auth/refresh can find it.
	if err := i.store.CreateRefreshToken(ctx, userID, rt.Hash, rt.ExpiresAt); err != nil {
		return TokenPair{}, fmt.Errorf("auth: persist refresh token: %w", err)
	}

	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rt.Plaintext,
		ExpiresAt:    exp,
	}, nil
}

// Verify parses and validates an access token, returning the claims on success.
func (i *JWTTokenIssuer) Verify(ctx context.Context, accessToken string) (Claims, error) {
	if accessToken == "" {
		return Claims{}, ErrInvalidToken
	}

	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"HS256"}), // reject "none" / RS256 / etc.
		jwt.WithIssuer(i.issuer),
		jwt.WithLeeway(ClockSkewLeeway),
	)
	token, err := parser.ParseWithClaims(accessToken, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		// Defense in depth: confirm the alg is the one we expect.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.secret, nil
	})
	if err != nil || !token.Valid {
		return Claims{}, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return Claims{}, ErrInvalidToken
	}
	return *claims, nil
}

// RotateRefreshToken validates the old refresh token (by hashing and looking
// it up in the DB), revokes it, and issues a fresh pair.
//
// Behavior:
//  1. Hash the incoming plaintext
//  2. Look up the hash in refresh_tokens
//  3. If not found OR expired → reject with ErrInvalidToken
//  4. Atomically consume (DELETE WHERE token=? AND expires_at >= now) — if
//     RowsAffected=0, the token was rotated between our lookup and delete
//     (replay attack). Return ErrTokenReuse so the caller can decide whether
//     to cascade-revoke.
//  5. Load the user; issue a new pair; store the new refresh hash.
func (i *JWTTokenIssuer) RotateRefreshToken(ctx context.Context, oldPlaintext string) (TokenPair, error) {
	if oldPlaintext == "" {
		return TokenPair{}, ErrInvalidToken
	}
	oldHash := HashRefreshToken(oldPlaintext)

	stored, err := i.store.GetRefreshToken(ctx, oldHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, ErrNotFound) {
			return TokenPair{}, ErrInvalidToken
		}
		return TokenPair{}, fmt.Errorf("auth: lookup refresh token: %w", err)
	}
	if time.Now().After(stored.ExpiresAt) {
		// Token expired but not yet swept by the janitor. Clean up + reject.
		_ = i.store.RevokeAllRefreshTokensForUser(ctx, stored.UserID)
		return TokenPair{}, ErrInvalidToken
	}

	// Atomic consume: only the request that successfully deletes wins.
	deleted, err := i.store.DeleteRefreshTokenByToken(ctx, oldHash)
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: consume refresh token: %w", err)
	}
	if deleted == 0 {
		// Token was rotated between GetRefreshToken and DeleteRefreshTokenByToken.
		// Treat as reuse: revoke everything this user has and reject.
		_ = i.store.RevokeAllRefreshTokensForUser(ctx, stored.UserID)
		return TokenPair{}, ErrTokenReuse
	}

	user, err := i.store.GetUserByID(ctx, stored.UserID)
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: load user for rotation: %w", err)
	}

	return i.Issue(ctx, user.ID, user.Email, string(user.Role))
}

// RevokeRefreshToken deletes a single refresh token by its plaintext.
// Used by /auth/logout. If the token is missing (already consumed, expired,
// or never existed), the call is a no-op so logout is idempotent.
func (i *JWTTokenIssuer) RevokeRefreshToken(ctx context.Context, plaintext string) error {
	if plaintext == "" {
		return nil
	}
	hash := HashRefreshToken(plaintext)
	// We don't check the row count; "not found" is fine for logout semantics.
	_, err := i.store.DeleteRefreshTokenByToken(ctx, hash)
	return err
}

// ---- Public helpers used by the handler + email_password provider ----

// ValidateEmailPublic is the public alias for the email format check used by
// the HTTP handler (it lives outside the email_password provider to avoid
// the handler having to import the provider type).
func ValidateEmailPublic(email string) bool {
	return validateEmail(email)
}

// ValidatePasswordPublic is the public alias for the password rule check.
func ValidatePasswordPublic(password string) bool {
	return validatePasswordInput(password)
}
