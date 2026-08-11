// Package auth implements the pluggable authentication layer for apps/api-go.
//
// The Go port preserves the abstraction introduced in the NestJS redesign
// (apps/api/src/modules/auth/providers/auth-provider.types.ts):
//
//   - AuthProvider is an interface; new providers just implement the 3
//     required methods.
//   - Provider list comes from config (AUTH_PROVIDERS env), not hardcode.
//   - One user can be bound to multiple provider accounts (UserProviderAccount
//     in the Prisma schema).
//   - AuthService is a thin dispatcher; bcrypt / SAML / OAuth mechanics live
//     in the individual providers, not in the dispatcher.
package auth

import (
	"context"
	"errors"
)

// ProviderType mirrors the TypeScript union:
//
//	apps/api/src/modules/auth/providers/auth-provider.types.ts:13
type ProviderType string

const (
	ProviderEmailPassword ProviderType = "email_password"
	ProviderOAuth         ProviderType = "oauth"
	ProviderSSO           ProviderType = "sso"
)

// ProviderID is the unique identifier of a provider instance. The same type
// can have multiple instances (e.g. "oauth.google" and "oauth.github").
//
// Mirrors AuthProviderId in the TS source.
type ProviderID string

// AuthIdentity is the normalized identity returned by a provider's Verify call.
//
//   - email_password → providerUserId is the user's email; profile.email/name
//     are copied from the User row; emailVerified is true (we just hashed+matched).
//   - oauth          → providerUserId is the IdP `sub` claim; profile.email/name
//     come from the IdP; emailVerified reflects whether the IdP verified ownership.
//   - sso            → providerUserId is the SAML NameID; profile.email/name/...
//     come from the SAML attributes (Phase 1 uses the T3 POC adapter for shape).
type AuthIdentity struct {
	ProviderUserID string
	Profile        AuthProfile
}

// AuthProfile is the normalized user profile that gets mapped to the User table.
//
// Mirrors the AuthIdentity.profile shape in the TS source.
type AuthProfile struct {
	Email         string
	EmailVerified bool
	Name          string
	AvatarURL     string
	Raw           map[string]any
}

// AuthResult is the outcome of a successful provider verify.
//
//   - "authenticated" → AuthService should upsert the user record and
//     issue a JWT session.
//   - "failed"        → AuthService should reject the request and return
//     a 401 envelope to the client.
type AuthResult struct {
	Kind          string // "authenticated" | "failed"
	UserID        string
	Identity      AuthIdentity
	IsNewUser     bool
	FailureReason string
}

// AuthCredentials is the opaque credential payload each provider interprets
// differently (email/password vs OAuth code vs SAML response).
//
// Mirrors AuthCredentials in the TS source (Record<string, unknown>).
type AuthCredentials map[string]any

// AuthProvider is the interface every provider must implement.
//
// Required methods (all providers):
//   - ID        → returns the unique provider identifier (e.g. "email_password")
//   - Type      → returns the provider type category
//   - Enabled   → false if the provider is in the config list but env vars are missing
//   - Verify    → validates credentials and returns an AuthIdentity
//   - Link      → binds the provider to an existing user (for "add password to google account")
//
// Optional methods:
//   - Describe  → returns display metadata (frontend "Sign in with X" buttons)
//   - AuthURL   → for OAuth, returns the browser authorization URL
//
// The interface intentionally mirrors the NestJS abstract class 1:1
// (apps/api/src/modules/auth/providers/auth-provider.types.ts:53).
type AuthProvider interface {
	ID() ProviderID
	Type() ProviderType
	Enabled() bool

	// Verify validates credentials and returns a normalized identity.
	// The provider MUST NOT mutate the User table; that is the AuthService's
	// responsibility. Throw an error (errs.Unauthorized or errs.BadRequest)
	// to reject the request.
	Verify(ctx context.Context, credentials AuthCredentials) (AuthIdentity, error)

	// Link binds this provider to an existing user. Used when a user signs
	// in with one provider and then wants to add another (e.g. "sign in with
	// Google, then set a password").
	Link(ctx context.Context, userID string, credentials AuthCredentials) error

	// Describe returns UI metadata for the provider. Optional.
	Describe() *ProviderDescriptor
}

// ProviderDescriptor is what frontend uses to render "Sign in with X" buttons.
type ProviderDescriptor struct {
	ID      ProviderID
	Label   string
	IconURL string
	Type    ProviderType
}

// Identity is the API-facing view of a UserProviderAccount row. Used by
// GET /api/v1/auth/identities (T8 deliverable). The fields here match
// the NestJS response shape (auth.service.ts:266-275) so the frontend
// doesn't need to change.
type Identity struct {
	ID             string `json:"id"`
	Provider       string `json:"provider"`
	ProviderUserID string `json:"providerUserId"`
	Email          string `json:"email,omitempty"`
	DisplayName    string `json:"displayName,omitempty"`
	LinkedAt       string `json:"linkedAt"`
	LastUsedAt     string `json:"lastUsedAt"`
	IsPrimary      bool   `json:"isPrimary"`
}

// Sentinel errors returned by providers. AuthService maps these to HTTP
// status codes via the errs package.
var (
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
	ErrEmailTaken         = errors.New("auth: email already registered")
	ErrUserNotFound       = errors.New("auth: user not found")
	ErrProviderDisabled   = errors.New("auth: provider disabled")
)
