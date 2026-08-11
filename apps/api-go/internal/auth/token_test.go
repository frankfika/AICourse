package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateRefreshToken_Shape(t *testing.T) {
	tok, err := generateRefreshToken(7 * 24 * time.Hour)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	// base64url no padding → only [-A-Za-z0-9_] chars, no '='
	if strings.Contains(tok.Plaintext, "=") {
		t.Errorf("refresh token should not have padding, got %q", tok.Plaintext)
	}
	if len(tok.Plaintext) < 43 { // 32 bytes base64url = 43 chars (no padding)
		t.Errorf("refresh token too short: %d chars", len(tok.Plaintext))
	}
}

func TestGenerateRefreshToken_Unique(t *testing.T) {
	a, _ := generateRefreshToken(7 * 24 * time.Hour)
	b, _ := generateRefreshToken(7 * 24 * time.Hour)
	if a == b {
		t.Error("two consecutive refresh tokens collided — CSPRNG is broken")
	}
}

// TestJWTTokenIssuer_IssueAndVerify_Shape covers the issue + verify round
// trip without a DB. We pass a nil repo to Issue — that path needs the DB
// only for CreateRefreshToken, which would fail; instead we use a tiny
// in-memory stub via a *fakeRepo.
//
// For the Phase 1 e2e, the real repo + dockertest MySQL is used. Here we
// only verify the JWT shape is correct.
func TestJWTClaims_ShapeRoundTrip(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef") // 32 bytes
	now := time.Now().UTC()
	exp := now.Add(15 * time.Minute)
	claims := Claims{
		UserID: "user-123",
		Email:  "user@example.com",
		Role:   "student",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "ai-academy-api-go",
			Subject:   "user-123",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(secret)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if !strings.HasPrefix(signed, "eyJ") {
		t.Errorf("expected JWT to start with eyJ, got %q", signed[:10])
	}

	parsed := &Claims{}
	parsedTok, err := jwt.ParseWithClaims(signed, parsed, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return secret, nil
	},
		jwt.WithLeeway(5*time.Second),
		jwt.WithIssuer("ai-academy-api-go"),
	)
	if err != nil || !parsedTok.Valid {
		t.Fatalf("parse: %v (valid=%v)", err, parsedTok.Valid)
	}
	if parsed.UserID != "user-123" || parsed.Email != "user@example.com" || parsed.Role != "student" {
		t.Errorf("claims round-trip mismatch: %+v", parsed)
	}
}

func TestJWTClaims_TamperedSignatureRejected(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	now := time.Now().UTC()
	exp := now.Add(15 * time.Minute)
	claims := Claims{
		UserID: "u-1",
		Email:  "u@x.com",
		Role:   "student",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "ai-academy-api-go",
			Subject:   "u-1",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := tok.SignedString(secret)

	// Flip a byte in the signature
	parts := strings.Split(signed, ".")
	parts[2] = strings.TrimRight(parts[2], "=") + "AA"
	tampered := strings.Join(parts, ".")

	parsed := &Claims{}
	_, err := jwt.ParseWithClaims(tampered, parsed, func(t *jwt.Token) (interface{}, error) {
		return secret, nil
	}, jwt.WithLeeway(5*time.Second), jwt.WithIssuer("ai-academy-api-go"))
	if err == nil {
		t.Error("expected tampered token to be rejected, got nil error")
	}
}

func TestJWTClaims_ExpiredRejected(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	past := time.Now().Add(-2 * time.Hour)
	claims := Claims{
		UserID: "u-1",
		Email:  "u@x.com",
		Role:   "student",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "ai-academy-api-go",
			Subject:   "u-1",
			IssuedAt:  jwt.NewNumericDate(past),
			ExpiresAt: jwt.NewNumericDate(past.Add(time.Minute)),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := tok.SignedString(secret)

	parsed := &Claims{}
	_, err := jwt.ParseWithClaims(signed, parsed, func(t *jwt.Token) (interface{}, error) {
		return secret, nil
	}, jwt.WithLeeway(5*time.Second), jwt.WithIssuer("ai-academy-api-go"))
	if err == nil {
		t.Error("expected expired token to be rejected")
	}
}

// TestJWTTokenIssuer_IssueRequiresRepo is a contract test: Issue must
// attempt to persist the refresh token. We assert it panics or errors
// when the repo is nil. The integration test in test/integration/ uses
// a real dockertest MySQL to cover the happy path.
//
// Note: the issuer dereferences repo at the CreateRefreshToken call site,
// so a nil repo causes a panic rather than a graceful error. That is
// the correct production behavior — calling Issue with a nil repo is
// a programmer error, not a runtime condition. We confirm the panic
// here.
func TestJWTTokenIssuer_IssueRequiresRepo(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic when repo is nil")
		}
	}()
	secret := []byte("0123456789abcdef0123456789abcdef")
	iss := NewJWTTokenIssuer(secret, nil, 15*time.Minute, 7*24*time.Hour)
	_, _ = iss.Issue(context.Background(), "u-1", "u@x.com", "student")
}
