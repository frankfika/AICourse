// AuthService — the dispatcher that ties providers to the User table.
//
// Phase 1 T7/T9: real upsert + token issuance wiring.
//
// Design (mirrors apps/api/src/modules/auth/auth.service.ts):
//   - Holds a map[ProviderID]AuthProvider
//   - For each request, the controller asks AuthService.Authenticate(providerID, creds)
//   - AuthService delegates Verify to the provider
//   - On success, AuthService looks up the user, links the provider account
//     if not already linked, and returns the AuthResult
//   - Token issuance (JWT + refresh) is owned by the TokenIssuer
package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// dispatchQueries is the sqlc-style query surface the dispatcher's
// upsert flow needs. *db.Queries (the sqlc-generated type) satisfies it.
// Kept local because the higher-level Queries interface in token.go uses
// positional args + returns model values directly (better for providers
// that don't need every column); the dispatcher needs struct-arg control
// for role/level/password-reset defaulting.
type dispatchQueries interface {
	GetProviderAccountByProvider(ctx context.Context, arg db.GetProviderAccountByProviderParams) (db.UserProviderAccount, error)
	GetUserByID(ctx context.Context, id string) (db.User, error)
	GetUserByEmail(ctx context.Context, email string) (db.User, error)
	CreateUser(ctx context.Context, arg db.CreateUserParams) (sql.Result, error)
	CreateProviderAccount(ctx context.Context, arg db.CreateProviderAccountParams) (sql.Result, error)
	UpdateUserLastLogin(ctx context.Context, arg db.UpdateUserLastLoginParams) error
}

// AuthService is the dispatcher.
type AuthService struct {
	mu            sync.RWMutex
	providers     map[ProviderID]AuthProvider
	q             dispatchQueries
	issuer        TokenIssuer
	log           *zap.Logger
	now           func() time.Time
	linkRepoRef   *AuthRepo
	stateStoreRef StateStore
}

// NewAuthService constructs an empty AuthService. Providers are added via
// Register (called from main.go when wiring up the app).
func NewAuthService() *AuthService {
	return &AuthService{
		providers: make(map[ProviderID]AuthProvider),
		log:       zap.NewNop(),
		now:       time.Now,
	}
}

// SetQueries wires the dispatcher's query surface (sqlc-style).
// Called from main.go after AuthService is built. BuildService
// does this automatically when given a non-nil *db.Queries.
func (s *AuthService) SetQueries(q dispatchQueries) { s.q = q }

// SetIssuer wires the TokenIssuer. Required before Authenticate or
// RefreshToken is called; BuildService calls it for you.
func (s *AuthService) SetIssuer(i TokenIssuer) { s.issuer = i }

// SetLog wires the structured logger.
func (s *AuthService) SetLog(l *zap.Logger) {
	if l != nil {
		s.log = l
	}
}

// Register adds a provider to the dispatcher. Duplicate IDs panic at startup;
// this is a configuration error and should fail-fast.
func (s *AuthService) Register(p AuthProvider) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.providers[p.ID()]; exists {
		panic(fmt.Sprintf("auth: provider %q registered twice", p.ID()))
	}
	s.providers[p.ID()] = p
}

// Get returns the provider by ID, or false if not registered.
func (s *AuthService) Get(id ProviderID) (AuthProvider, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.providers[id]
	return p, ok
}

// List returns the IDs of all enabled providers. Used by the
// GET /api/v1/auth/providers endpoint to tell the frontend which
// "Sign in with X" buttons to render.
func (s *AuthService) List() []ProviderDescriptor {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ProviderDescriptor, 0, len(s.providers))
	for _, p := range s.providers {
		if !p.Enabled() {
			continue
		}
		if d := p.Describe(); d != nil {
			out = append(out, *d)
		}
	}
	return out
}

// Authenticate is the main entry point used by the controller.
//
//  1. Look up the provider by ID. Fail with ErrProviderDisabled if missing.
//  2. Delegate to provider.Verify.
//  3. On success, upsert the user record + UserProviderAccount link.
//  4. Issue a TokenPair via the TokenIssuer.
//  5. Return AuthResult to the caller.
//
// The AuthResult carries the issued TokenPair; the controller turns that into
// the HTTP response (access token in body, refresh token in cookie).
func (s *AuthService) Authenticate(ctx context.Context, providerID ProviderID, creds AuthCredentials) (AuthResult, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return AuthResult{Kind: "failed", FailureReason: "provider not available"}, errs.Unauthorized("Provider not available")
	}
	// Browser OAuth/SAML must use AuthenticateCallback so state, flow, user
	// binding and PKCE are enforced. The direct fake-provider path exists only
	// for hermetic non-production e2e tests.
	if !OAuthTestMode {
		switch provider.(type) {
		case *OAuthProvider, *SsoProvider:
			return AuthResult{Kind: "failed", FailureReason: "stateful callback required"}, errs.BadRequest("Provider requires stateful callback")
		}
	}

	identity, err := provider.Verify(ctx, creds)
	if err != nil {
		// Provider already translated the failure to an errs envelope
		// (ErrInvalidCredentials → 401, ErrEmailTaken → 409, etc.). The
		// controller's error handler maps it to the JSON envelope.
		return AuthResult{Kind: "failed", FailureReason: err.Error()}, err
	}

	return s.completeExternalAuthentication(ctx, providerID, identity)
}

// AuthenticateCallback verifies a browser OAuth/SAML callback using the
// one-shot server-side state before upserting the user. Direct Authenticate
// remains available for non-stateful providers and test-mode fakes only.
func (s *AuthService) AuthenticateCallback(ctx context.Context, providerID ProviderID, creds AuthCredentials) (AuthResult, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return AuthResult{Kind: "failed", FailureReason: "provider not available"}, errs.Unauthorized("Provider not available")
	}

	var (
		identity AuthIdentity
		err      error
	)
	switch provider.(type) {
	case *OAuthProvider:
		identity, err = s.HandleOAuthCallback(ctx, providerID, credentialString(creds, "state"), credentialString(creds, "code"))
	case *SsoProvider:
		identity, err = s.HandleSAMLAcs(ctx, providerID, credentialString(creds, "SAMLResponse", "samlResponse"), credentialString(creds, "RelayState", "relayState", "state"))
	default:
		return AuthResult{Kind: "failed", FailureReason: "provider does not support callback"}, errs.BadRequest("Provider does not support callback")
	}
	if err != nil {
		return AuthResult{Kind: "failed", FailureReason: err.Error()}, err
	}
	return s.completeExternalAuthentication(ctx, providerID, identity)
}

func (s *AuthService) completeExternalAuthentication(ctx context.Context, providerID ProviderID, identity AuthIdentity) (AuthResult, error) {
	// Upsert user + provider account.
	user, isNew, err := s.upsertUser(ctx, providerID, identity)
	if err != nil {
		return AuthResult{Kind: "failed", FailureReason: err.Error()}, err
	}

	// 3. (Token issuance happens in the HTTP handler, not here. The
	//    handler needs the AuthResult + the user's role to mint the
	//    JWT; it can do that lookup directly via the AuthRepo.)
	s.log.Info("authenticate success",
		zap.String("user_id", user.ID),
		zap.String("provider", string(providerID)),
		zap.Bool("is_new_user", isNew),
	)

	return AuthResult{
		Kind:      "authenticated",
		UserID:    user.ID,
		Identity:  identity,
		IsNewUser: isNew,
	}, nil
}

func credentialString(creds AuthCredentials, keys ...string) string {
	for _, key := range keys {
		if value, ok := creds[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

// upsertUser is the central "map an identity to a User" routine. Mirrors
// auth.service.ts:89-161. Rules:
//
//  1. If a UserProviderAccount already exists for (provider, providerUserId),
//     return the bound user. Deleted accounts are treated as missing.
//  2. Else, find a User by email. If found and email-verified, link the new
//     provider account to that user.
//  3. Else, create a new User + provider account.
func (s *AuthService) upsertUser(ctx context.Context, providerID ProviderID, identity AuthIdentity) (*db.User, bool, error) {
	repo := s.linkRepo()

	// 1. Look up existing provider account
	if existing, err := repo.GetProviderAccountByProvider(ctx, string(providerID), identity.ProviderUserID); err == nil {
		// Found a binding; load the user.
		if existing.DeletedAt.Valid {
			return nil, false, errs.Unauthorized("Identity is not available")
		}
		user, err := repo.GetUserByID(ctx, existing.UserID)
		if err != nil {
			return nil, false, errs.Internal("load user for provider account", err)
		}
		if user.DeletedAt.Valid {
			return nil, false, errs.Unauthorized("Account is disabled")
		}
		return &user, false, nil
	} else if !errors.Is(err, ErrNotFound) {
		return nil, false, errs.Internal("lookup provider account", err)
	}

	// 2. Try to find an existing user by email (linking flow)
	if user, err := repo.GetUserByEmail(ctx, identity.Profile.Email); err == nil {
		if user.DeletedAt.Valid {
			return nil, false, errs.Unauthorized("Account is disabled")
		}
		// OAuth/SSO linking is only safe when the IdP attests the email is
		// verified; otherwise an attacker could squat on someone else's
		// account by creating a new provider with a known email.
		if providerID != ProviderID(ProviderEmailPassword) && !identity.Profile.EmailVerified {
			return nil, false, errs.Unauthorized("OAuth email is not verified")
		}
		if err := repo.LinkProviderAccount(ctx, user.ID, string(providerID), identity.ProviderUserID, identity.Profile); err != nil {
			return nil, false, errs.Internal("link provider account", err)
		}
		s.log.Info("linked new provider to existing user",
			zap.String("user_id", user.ID),
			zap.String("provider", string(providerID)),
		)
		return &user, false, nil
	} else if !errors.Is(err, ErrNotFound) {
		return nil, false, errs.Internal("lookup user by email", err)
	}

	// 3. Brand-new user. The provider's Verify should have already created
	//    the row (email_password does this in handleRegister). For OAuth/SSO
	//    that don't pre-create, we do it here.
	if providerID == ProviderID(ProviderEmailPassword) {
		// Re-read the user by email — the provider just created it.
		user, err := repo.GetUserByEmail(ctx, identity.Profile.Email)
		if err != nil {
			return nil, false, errs.Internal("read back registered user", err)
		}
		return &user, true, nil
	}

	// OAuth/SSO path: create a User with empty password_hash.
	now := s.now()
	user, err := repo.CreateUser(ctx, identity.Profile.Email, "", identity.Profile.Name)
	if err != nil {
		return nil, false, errs.Internal("create user", err)
	}
	if _, err := repo.CreateProviderAccount(ctx, user.ID, string(providerID), identity.ProviderUserID, identity.Profile.Email, identity.Profile.Name, true); err != nil {
		return nil, false, errs.Internal("bind provider account", err)
	}
	// Set the avatar (CreateUser doesn't accept it; the AuthRepo doesn't have
	// an UpdateUser query yet, so skip for now).
	_ = now

	got, err := repo.GetUserByID(ctx, user.ID)
	if err != nil {
		return nil, false, errs.Internal("read back new user", err)
	}
	s.log.Info("created new user from provider",
		zap.String("user_id", user.ID),
		zap.String("provider", string(providerID)),
	)
	return &got, true, nil
}

// LinkProvider binds a provider to an existing user. Used by the
// "add password to google account" flow.
func (s *AuthService) LinkProvider(ctx context.Context, userID string, providerID ProviderID, creds AuthCredentials) error {
	provider, ok := s.Get(providerID)
	if !ok {
		return errs.Unauthorized("Provider not available")
	}
	return provider.Link(ctx, userID, creds)
}

// RefreshToken rotates a refresh token via the issuer. Returns the new pair
// on success. Reuse detection is the issuer's job — if it returns
// ErrRefreshTokenReuse, the caller's session is dead.
func (s *AuthService) RefreshToken(ctx context.Context, plaintext string) (TokenPair, error) {
	return s.issuer.RotateRefreshToken(ctx, plaintext)
}

// Logout revokes a single refresh token. Idempotent: missing tokens are OK.
func (s *AuthService) Logout(ctx context.Context, plaintext string) error {
	return s.issuer.RevokeRefreshToken(ctx, plaintext)
}

// ============ T8: OAuth/SSO + identity management ============
//
// CreateAuthorization / CreateLinkAuthorization are the OAuth / SAML
// "start" endpoints. The state store (Redis in prod) is wired by
// main.go via SetStateStore; the dispatcher's job is to:
//   1. Generate state + PKCE code_verifier (OAuth) or relay state (SAML).
//   2. Persist {provider, requestId, codeVerifier} under the state key
//      so the callback can verify the request is the same browser.
//   3. Return the IdP URL the client should be redirected to.
// The OAuth provider's AuthURL is a pure URL builder — the dispatcher
// owns the state store. SAML's BuildAuthnRequest returns both the URL
// and the requestID we expect InResponseTo; the dispatcher persists
// both for ACS correlation.

// Authorization is the start-step response (URL + state).
type Authorization struct {
	URL   string `json:"url"`
	State string `json:"state"`
}

const (
	authorizationFlowLogin = "login"
	authorizationFlowLink  = "link"
)

// CreateAuthorization is the start step of the OAuth flow.
// Returns the IdP URL the client should redirect the user to.
func (s *AuthService) CreateAuthorization(ctx context.Context, providerID ProviderID) (Authorization, error) {
	return s.createAuthorization(ctx, providerID, authorizationFlowLogin, "")
}

func (s *AuthService) createAuthorization(ctx context.Context, providerID ProviderID, flow, userID string) (Authorization, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return Authorization{}, errs.Unauthorized("Provider not available")
	}
	oauth, ok := provider.(*OAuthProvider)
	if !ok {
		if _, isSAML := provider.(*SsoProvider); isSAML {
			return s.createSAMLAuthnRequest(ctx, providerID, flow, userID)
		}
		return Authorization{}, errs.BadRequest("Provider does not support /start")
	}
	state, err := GenerateRandomState()
	if err != nil {
		return Authorization{}, errs.Internal("generate state", err)
	}
	verifier, err := GenerateCodeVerifier()
	if err != nil {
		return Authorization{}, errs.Internal("generate verifier", err)
	}
	url, err := oauth.AuthURL(ctx, state, verifier)
	if err != nil {
		return Authorization{}, errs.Internal("auth URL", err)
	}
	stateStore, err := s.stateStore()
	if err != nil {
		return Authorization{}, err
	}
	if err := stateStore.SaveOAuth(ctx, state, OAuthState{
		Provider:     string(providerID),
		CodeVerifier: verifier,
		Flow:         flow,
		UserID:       userID,
	}, OAuthStateTTL); err != nil {
		return Authorization{}, errs.Internal("persist OAuth state", err)
	}
	return Authorization{URL: url, State: state}, nil
}

// CreateLinkAuthorization binds the one-shot state to both the link flow and
// the authenticated user. A login state, or a state created by another user,
// can therefore never be replayed at the link callback.
func (s *AuthService) CreateLinkAuthorization(ctx context.Context, userID string, providerID ProviderID) (Authorization, error) {
	if userID == "" {
		return Authorization{}, errs.Unauthorized("missing link user")
	}
	return s.createAuthorization(ctx, providerID, authorizationFlowLink, userID)
}

// LinkIdentity records the (user, provider, providerUserId) tuple
// in user_provider_accounts. Called by /:providerId/link/callback
// after the provider has verified the credentials.
func (s *AuthService) LinkIdentity(ctx context.Context, userID string, providerID ProviderID, creds AuthCredentials) error {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return errs.Unauthorized("Provider not available")
	}
	var identity AuthIdentity
	var err error
	switch provider.(type) {
	case *OAuthProvider:
		identity, err = s.handleOAuthCallback(ctx, providerID, credentialString(creds, "state"), credentialString(creds, "code"), authorizationFlowLink, userID)
	case *SsoProvider:
		identity, err = s.handleSAMLAcs(ctx, providerID, credentialString(creds, "SAMLResponse", "samlResponse"), credentialString(creds, "RelayState", "relayState", "state"), authorizationFlowLink, userID)
	default:
		identity, err = provider.Verify(ctx, creds)
	}
	if err != nil {
		return err
	}
	return s.linkRepo().LinkProviderAccount(ctx, userID, string(providerID), identity.ProviderUserID, identity.Profile)
}

// ListIdentities returns the (provider, providerUserId) tuples
// bound to a user. Used by GET /auth/identities.
func (s *AuthService) ListIdentities(ctx context.Context, userID string) ([]Identity, error) {
	return s.linkRepo().ListProviderAccountsByUser(ctx, userID)
}

// UnlinkIdentity removes a (user, provider) binding. Idempotent:
// re-unlinking an already-deleted row returns ErrNotFound.
func (s *AuthService) UnlinkIdentity(ctx context.Context, userID, identityID string) error {
	err := s.linkRepo().UnlinkProviderAccount(ctx, userID, identityID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return errs.NotFound("identity not found")
		}
		return errs.Internal("unlink", err)
	}
	return nil
}

// CreateSAMLAuthnRequest is the SAML start step.
// Returns the IdP SSO URL + the RelayState the controller must echo
// back in the form-POST to the ACS. Persists {provider, requestID} in
// the state store so the ACS callback can verify InResponseTo.
func (s *AuthService) CreateSAMLAuthnRequest(ctx context.Context, providerID ProviderID) (Authorization, error) {
	return s.createSAMLAuthnRequest(ctx, providerID, authorizationFlowLogin, "")
}

func (s *AuthService) createSAMLAuthnRequest(ctx context.Context, providerID ProviderID, flow, userID string) (Authorization, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return Authorization{}, errs.Unauthorized("Provider not available")
	}
	sso, ok := provider.(*SsoProvider)
	if !ok {
		return Authorization{}, errs.Unauthorized("Provider does not support SAML start")
	}
	stateStore, err := s.stateStore()
	if err != nil {
		return Authorization{}, err
	}
	res, err := sso.BuildAuthnRequest(ctx, "")
	if err != nil {
		return Authorization{}, errs.Internal("build authn request", err)
	}
	if err := stateStore.SaveSAML(ctx, res.RelayState, SAMLState{
		Provider:  string(providerID),
		RequestID: res.RequestID,
		Flow:      flow,
		UserID:    userID,
	}, SAMLStateTTL); err != nil {
		return Authorization{}, errs.Internal("persist relay state", err)
	}
	return Authorization{URL: res.URL, State: res.RelayState}, nil
}

// HandleSAMLAcs is the SAML ACS callback. Verifies the RelayState
// was issued by us, then calls sso.ProcessResponse to verify the
// signature + extract NameID + flatten attributes. Returns the
// AuthIdentity so the caller can complete the upsert + token flow.
func (s *AuthService) HandleSAMLAcs(ctx context.Context, providerID ProviderID, samlResponse, relayState string) (AuthIdentity, error) {
	return s.handleSAMLAcs(ctx, providerID, samlResponse, relayState, authorizationFlowLogin, "")
}

func (s *AuthService) handleSAMLAcs(ctx context.Context, providerID ProviderID, samlResponse, relayState, expectedFlow, expectedUserID string) (AuthIdentity, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return AuthIdentity{}, errs.Unauthorized("Provider not available")
	}
	sso, ok := provider.(*SsoProvider)
	if !ok {
		return AuthIdentity{}, errs.Unauthorized("Provider does not support SAML ACS")
	}
	stateStore, err := s.stateStore()
	if err != nil {
		return AuthIdentity{}, err
	}
	payload, err := sso.ParseRelayState(ctx, stateStore, relayState)
	if err != nil {
		return AuthIdentity{}, err
	}
	if payload.Flow != expectedFlow || payload.UserID != expectedUserID {
		return AuthIdentity{}, errs.Unauthorized("SAML state flow or user mismatch")
	}
	return sso.ProcessResponse(ctx, samlResponse, relayState, payload.RequestID)
}

// HandleOAuthCallback is the OAuth callback. Pulls the code_verifier
// from the state store, then asks the provider to exchange + fetch
// userinfo. Returns the AuthIdentity for the dispatcher's upsert.
func (s *AuthService) HandleOAuthCallback(ctx context.Context, providerID ProviderID, state, code string) (AuthIdentity, error) {
	return s.handleOAuthCallback(ctx, providerID, state, code, authorizationFlowLogin, "")
}

func (s *AuthService) handleOAuthCallback(ctx context.Context, providerID ProviderID, state, code, expectedFlow, expectedUserID string) (AuthIdentity, error) {
	provider, ok := s.Get(providerID)
	if !ok || !provider.Enabled() {
		return AuthIdentity{}, errs.Unauthorized("Provider not available")
	}
	oauth, ok := provider.(*OAuthProvider)
	if !ok {
		return AuthIdentity{}, errs.Unauthorized("Provider does not support OAuth callback")
	}
	stateStore, err := s.stateStore()
	if err != nil {
		return AuthIdentity{}, err
	}
	payload, err := stateStore.ConsumeOAuth(ctx, state)
	if err != nil {
		if errors.Is(err, ErrStateNotFound) {
			return AuthIdentity{}, errs.Unauthorized("OAuth state invalid or expired")
		}
		return AuthIdentity{}, errs.Internal("consume state", err)
	}
	if payload.Provider != string(providerID) {
		return AuthIdentity{}, errs.Unauthorized("OAuth state provider mismatch")
	}
	if payload.Flow != expectedFlow || payload.UserID != expectedUserID {
		return AuthIdentity{}, errs.Unauthorized("OAuth state flow or user mismatch")
	}
	if OAuthTestMode {
		return oauth.Verify(ctx, AuthCredentials{"code": code, "_codeVerifier": payload.CodeVerifier})
	}
	return oauth.ExchangeAndFetchUser(ctx, code, payload.CodeVerifier)
}

// stateStore returns the wired state store. Missing wiring is reported as a
// safe service-unavailable error: a deployment mistake must not panic the
// request process or consume a callback without replay protection.
func (s *AuthService) stateStore() (StateStore, error) {
	if s.stateStoreRef == nil {
		return nil, errs.ServiceUnavailable("Authentication state storage is unavailable")
	}
	return s.stateStoreRef, nil
}

// SetStateStore wires the StateStore for OAuth/SAML state persistence.
// Called from main.go after both AuthService and the StateStore are built.
func (s *AuthService) SetStateStore(store StateStore) { s.stateStoreRef = store }

// linkRepo is the auth repo for identity management. The dispatcher
// doesn't store it directly; it's injected via SetLinkRepo by main.go.
// Returns the repo or panics if not wired.
func (s *AuthService) linkRepo() *AuthRepo {
	if s.linkRepoRef == nil {
		panic("auth: linkRepo not wired (call SetLinkRepo in main.go)")
	}
	return s.linkRepoRef
}

// SetLinkRepo wires the AuthRepo for identity management methods.
// Called from main.go after both AuthService and AuthRepo are built.
func (s *AuthService) SetLinkRepo(r *AuthRepo) { s.linkRepoRef = r }

// SetRepo is an alias for SetLinkRepo, kept for callers that already
// use the shorter name (e.g. cmd/server/main.go).
func (s *AuthService) SetRepo(r *AuthRepo) { s.linkRepoRef = r }
