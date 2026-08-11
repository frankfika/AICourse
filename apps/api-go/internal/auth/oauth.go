// OAuthProvider — generic OAuth 2.0 / OpenID Connect authentication.
//
// Phase 1 T8: real Google + GitHub OAuth2 authorization-code flow with PKCE.
//
// Workflow:
//
//	[Start]  GET  /api/v1/auth/:providerId/start
//	           → generate state + PKCE code_verifier
//	           → persist {provider, redirectAfter, codeVerifier} in Redis
//	           → return {authorizationUrl, state} to the client
//	[User]   client 302-redirects to provider authorize URL
//	[IdP]    user authorizes; IdP redirects to the configured redirect_uri
//	[Callback]  POST /api/v1/auth/:providerId/callback  {code, state, redirectAfter?}
//	           → look up state in Redis (one-shot)
//	           → exchange code for token using code_verifier
//	           → fetch userinfo from provider's userinfo endpoint
//	           → normalize to AuthIdentity
//	           → AuthService upserts User + UserProviderAccount
//
// Why PKCE (RFC 7636):
//   - Defends the auth-code flow against authorization-code interception
//     even when the client cannot keep a client_secret (e.g. native app,
//     single-page app). Modern best-practice for any public client and
//     increasingly also recommended for confidential clients.
//   - github.com/frankfika/ai-academy runs a single-page app on the same
//     origin as the API; PKCE is the right default.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

// oauthConfig is the per-provider config block loaded by loadOAuthConfig
// in config.go. The same struct backs both Google and GitHub.
type oauthConfig struct {
	ClientID     string   `mapstructure:"client_id"`
	ClientSecret string   `mapstructure:"client_secret"`
	RedirectURI  string   `mapstructure:"redirect_uri"`
	Scopes       []string `mapstructure:"scopes"`
}

// OAuthProvider is a real OAuth 2.0 provider. One struct serves both
// Google and GitHub (and any other IdP that uses the standard OAuth2
// authorization-code flow). The ProviderID (e.g. "oauth.google") keys
// the per-IdP configuration.
type OAuthProvider struct {
	id      ProviderID // e.g. "oauth.google"
	cfg     oauthConfig
	oauth2c *oauth2.Config
	// Provider-specific endpoints. Defaults below; if your IdP needs
	// custom URLs, extend this struct.
	authURL     string
	tokenURL    string
	userinfoURL string
	// userinfoFetcher handles the provider-specific JSON shape (Google
	// vs GitHub both differ in their userinfo response).
	userinfoFetcher func(ctx context.Context, tok *oauth2.Token) (AuthIdentity, error)
	// httpClient is used for token exchange + userinfo. Injectable so
	// tests can point at httptest.Server URLs.
	httpClient *http.Client
}

// NewOAuthProvider constructs an OAuth provider from the config block.
// The provider ID is passed separately so the same struct can serve
// Google, GitHub, etc. without a separate factory per IdP.
func NewOAuthProvider(id ProviderID, cfg map[string]any) (*OAuthProvider, error) {
	oacfg, err := decodeOAuthConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("oauth: %s: %w", id, err)
	}
	if oacfg.ClientID == "" || oacfg.ClientSecret == "" || oacfg.RedirectURI == "" {
		return nil, fmt.Errorf("oauth: %s: missing client_id / client_secret / redirect_uri", id)
	}

	p := &OAuthProvider{
		id:         id,
		cfg:        oacfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		oauth2c:    &oauth2.Config{ClientID: oacfg.ClientID, ClientSecret: oacfg.ClientSecret, RedirectURL: oacfg.RedirectURI, Scopes: oacfg.Scopes},
	}

	switch id {
	case "oauth.google":
		p.authURL = google.Endpoint.AuthURL
		p.tokenURL = google.Endpoint.TokenURL
		p.userinfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
		p.userinfoFetcher = p.fetchGoogleUserinfo
		p.oauth2c.Endpoint = google.Endpoint
	case "oauth.github":
		p.authURL = github.Endpoint.AuthURL
		p.tokenURL = github.Endpoint.TokenURL
		p.userinfoURL = "https://api.github.com/user"
		p.userinfoFetcher = p.fetchGitHubUserinfo
		p.oauth2c.Endpoint = github.Endpoint
	default:
		// Config loader has already rejected unknown IDs at boot. We
		// reach here only if a caller manually instantiates the
		// provider; keep the safety net anyway.
		return nil, fmt.Errorf("oauth: unknown provider id %q", id)
	}
	return p, nil
}

func decodeOAuthConfig(in map[string]any) (oauthConfig, error) {
	getStr := func(k string) string {
		if v, ok := in[k].(string); ok {
			return v
		}
		return ""
	}
	// Scopes may arrive as []string (viper) or []any (literal map).
	var scopes []string
	switch v := in["scopes"].(type) {
	case []string:
		scopes = v
	case []any:
		for _, s := range v {
			if str, ok := s.(string); ok {
				scopes = append(scopes, str)
			}
		}
	}
	return oauthConfig{
		ClientID:     getStr("client_id"),
		ClientSecret: getStr("client_secret"),
		RedirectURI:  getStr("redirect_uri"),
		Scopes:       scopes,
	}, nil
}

// ID / Type / Enabled implement the AuthProvider interface.
func (p *OAuthProvider) ID() ProviderID     { return p.id }
func (p *OAuthProvider) Type() ProviderType { return ProviderOAuth }
func (p *OAuthProvider) Enabled() bool {
	return p != nil && p.cfg.ClientID != "" && p.cfg.ClientSecret != ""
}

// SetStateStore wires the StateStore (Redis in prod, in-memory in tests).
// The dispatcher uses the state store to remember {provider, codeVerifier}
// between the start and callback steps. Without it, OAuth can't survive
// the cross-request round-trip.
//
// OAuthTestMode is a process-wide switch (set by main.go in non-prod)
// that puts the OAuthProvider into "fake IdP" mode: callback returns a
// deterministic identity without doing the real token exchange. This
// lets the e2e suite exercise the OAuth flow without real Google/GitHub
// credentials. Production never sets it.
var OAuthTestMode bool

// OAuthTestIdentity is the deterministic identity the OAuthProvider
// returns when OAuthTestMode is on. The e2e suite sets this before
// each test to control the simulated IdP response. Production never
// reads or writes this — the package-level setters/getters are only
// safe to call from test code paths.
type OAuthTestIdentity struct {
	ProviderUserID string
	Email          string
	Name           string
	AvatarURL      string
	EmailVerified  bool
}

// CurrentOAuthTestIdentity is the most recent identity set by the test
// suite. The OAuthProvider reads it during Verify when OAuthTestMode is
// true. We expose it as a package-level variable (rather than a struct
// field on OAuthProvider) so multiple providers can share one identity.
var CurrentOAuthTestIdentity OAuthTestIdentity

// AuthURL is the pure URL builder used by the AuthService dispatcher.
// The dispatcher owns the state store and the state value (and code
// verifier), so this method just composes the URL with PKCE S256.
//
// Mirrors the NestJS OAuthProvider.createAuthorizationUrl(state) —
// the dispatcher passes us the state; we return the URL the client
// should be redirected to.
func (p *OAuthProvider) AuthURL(ctx context.Context, state, codeVerifier string) (string, error) {
	if state == "" {
		return "", errors.New("oauth: state is required")
	}
	if codeVerifier == "" {
		return "", errors.New("oauth: codeVerifier is required")
	}
	return p.oauth2c.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(codeVerifier),
	), nil
}

// ExchangeAndFetchUser is the "verify the code" half. The dispatcher
// has already pulled the code_verifier from the state store; we just
// exchange + fetch userinfo + normalize.
//
// Splitting this from Verify (which is the AuthProvider-interface
// single-shot) lets tests inject custom httpClients that point at
// httptest.Server URLs for the IdP endpoints.
func (p *OAuthProvider) ExchangeAndFetchUser(ctx context.Context, code, codeVerifier string) (AuthIdentity, error) {
	if code == "" {
		return AuthIdentity{}, fmt.Errorf("%w: missing code", ErrInvalidCredentials)
	}
	if codeVerifier == "" {
		return AuthIdentity{}, fmt.Errorf("%w: missing code_verifier", ErrInvalidCredentials)
	}
	tok, err := p.oauth2c.Exchange(ctx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		return AuthIdentity{}, fmt.Errorf("%w: token exchange: %v", ErrInvalidCredentials, err)
	}
	identity, err := p.userinfoFetcher(ctx, tok)
	if err != nil {
		return AuthIdentity{}, err
	}
	if identity.ProviderUserID == "" {
		return AuthIdentity{}, fmt.Errorf("%w: userinfo missing subject", ErrInvalidCredentials)
	}
	return identity, nil
}

// Verify is the AuthProvider interface entry point. The dispatcher
// (AuthService.Authenticate) passes creds = {state, code, _codeVerifier}
// — _codeVerifier is the PKCE secret the dispatcher pulled from the
// state store. We don't touch the state store here; that's the
// dispatcher's job.
//
// Test mode: when OAuthTestMode is true, skip the IdP roundtrip and
// return the hardcoded identity. E2E tests set this.
func (p *OAuthProvider) Verify(ctx context.Context, creds AuthCredentials) (AuthIdentity, error) {
	if OAuthTestMode {
		return AuthIdentity{
			ProviderUserID: CurrentOAuthTestIdentity.ProviderUserID,
			Profile: AuthProfile{
				Email:         CurrentOAuthTestIdentity.Email,
				EmailVerified: CurrentOAuthTestIdentity.EmailVerified,
				Name:          CurrentOAuthTestIdentity.Name,
				AvatarURL:     CurrentOAuthTestIdentity.AvatarURL,
			},
		}, nil
	}
	code, _ := creds["code"].(string)
	codeVerifier, _ := creds["_codeVerifier"].(string)
	return p.ExchangeAndFetchUser(ctx, code, codeVerifier)
}

// Link is the AuthProvider interface entry point for binding an
// existing user to an OAuth account. It runs the same callback flow
// and then writes the UserProviderAccount row (caller's responsibility,
// we just return the identity).
func (p *OAuthProvider) Link(ctx context.Context, userID string, creds AuthCredentials) error {
	_, err := p.Verify(ctx, creds)
	return err
}

// Describe implements the optional AuthProvider UI-metadata method.
func (p *OAuthProvider) Describe() *ProviderDescriptor {
	label := string(p.id) // "oauth.google" / "oauth.github" by default
	switch p.id {
	case "oauth.google":
		label = "Google"
	case "oauth.github":
		label = "GitHub"
	}
	return &ProviderDescriptor{ID: p.id, Label: label, Type: p.Type()}
}

// --- provider-specific userinfo fetchers -------------------------------------

// fetchGoogleUserinfo calls Google's /userinfo v3 endpoint with the
// access token and normalizes the response into AuthIdentity.
//
// Google returns: { sub, email, email_verified, name, picture, ... }
// See https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo
func (p *OAuthProvider) fetchGoogleUserinfo(ctx context.Context, tok *oauth2.Token) (AuthIdentity, error) {
	body, err := p.getJSON(ctx, p.userinfoURL, tok.AccessToken)
	if err != nil {
		return AuthIdentity{}, fmt.Errorf("oauth: google userinfo: %w", err)
	}
	var raw struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return AuthIdentity{}, fmt.Errorf("oauth: google userinfo decode: %w", err)
	}
	if raw.Email == "" || !raw.EmailVerified {
		// Without a verified email we cannot upsert a user safely.
		// NestJS source throws the same guard at oauth.provider.ts:122-124.
		return AuthIdentity{}, fmt.Errorf("%w: google account has no verified email", ErrInvalidCredentials)
	}
	name := raw.Name
	if name == "" {
		// Fall back to local-part of email.
		if at := indexByte(raw.Email, '@'); at > 0 {
			name = raw.Email[:at]
		} else {
			name = raw.Email
		}
	}
	return AuthIdentity{
		ProviderUserID: raw.Sub,
		Profile: AuthProfile{
			Email:         raw.Email,
			EmailVerified: raw.EmailVerified,
			Name:          name,
			AvatarURL:     raw.Picture,
			Raw:           rawToMap(body),
		},
	}, nil
}

// fetchGitHubUserinfo calls GitHub's /user endpoint and then
// /user/emails to discover the verified primary email (the /user
// endpoint may omit email if the user's profile is private, even with
// the user:email scope). Mirrors the NestJS fallback at
// oauth.provider.ts:108-111.
//
// GitHub /user:    { id, login, name, email?, avatar_url, ... }
// GitHub /emails:  [{ email, primary, verified, visibility }, ...]
func (p *OAuthProvider) fetchGitHubUserinfo(ctx context.Context, tok *oauth2.Token) (AuthIdentity, error) {
	userBody, err := p.getJSON(ctx, p.userinfoURL, tok.AccessToken)
	if err != nil {
		return AuthIdentity{}, fmt.Errorf("oauth: github user: %w", err)
	}
	var raw struct {
		ID        json.Number `json:"id"` // github returns integer; json.Number avoids float64 loss
		Login     string      `json:"login"`
		Name      string      `json:"name"`
		Email     string      `json:"email"`
		AvatarURL string      `json:"avatar_url"`
	}
	if err := json.Unmarshal(userBody, &raw); err != nil {
		return AuthIdentity{}, fmt.Errorf("oauth: github user decode: %w", err)
	}

	// If /user didn't return a primary email, fall back to /emails.
	// emailsURL is derived from userinfoURL (so tests can point it at
	// a mock server) but defaults to the production api.github.com.
	emailsURL := "https://api.github.com/user/emails"
	if p.userinfoURL != "" {
		// Strip the trailing /user, append /user/emails.
		base := strings.TrimSuffix(p.userinfoURL, "/user")
		emailsURL = base + "/user/emails"
	}
	email := raw.Email
	emailVerified := email != ""
	if email == "" {
		email, err = p.fetchGitHubVerifiedEmail(ctx, tok.AccessToken, emailsURL)
		if err != nil {
			return AuthIdentity{}, err
		}
		emailVerified = true
	}
	if email == "" {
		return AuthIdentity{}, fmt.Errorf("%w: github account has no verified email", ErrInvalidCredentials)
	}
	idStr := raw.ID.String()
	if idStr == "" || idStr == "0" {
		return AuthIdentity{}, fmt.Errorf("%w: github user has no id", ErrInvalidCredentials)
	}
	name := raw.Name
	if name == "" {
		name = raw.Login
	}
	return AuthIdentity{
		ProviderUserID: idStr,
		Profile: AuthProfile{
			Email:         email,
			EmailVerified: emailVerified,
			Name:          name,
			AvatarURL:     raw.AvatarURL,
			Raw:           rawToMap(userBody),
		},
	}, nil
}

// fetchGitHubVerifiedEmail finds the user's primary+verified email
// (or just verified, if primary is not flagged) from /user/emails.
// emailsURL is parameterized so tests can point it at a mock server.
func (p *OAuthProvider) fetchGitHubVerifiedEmail(ctx context.Context, accessToken, emailsURL string) (string, error) {
	body, err := p.getJSON(ctx, emailsURL, accessToken)
	if err != nil {
		return "", fmt.Errorf("oauth: github emails: %w", err)
	}
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", fmt.Errorf("oauth: github emails decode: %w", err)
	}
	// Prefer primary+verified, else just verified.
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}
	for _, e := range emails {
		if e.Verified {
			return e.Email, nil
		}
	}
	return "", nil
}

// getJSON is a small helper: GET <url> with `Authorization: Bearer <tok>`
// and Accept: application/json, return the body bytes. Used by the
// per-IdP userinfo fetchers. Tests inject a custom httpClient so this
// can be pointed at httptest.Server URLs.
func (p *OAuthProvider) getJSON(ctx context.Context, urlStr, accessToken string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	client := p.httpClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("http %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	return body, nil
}

// rawToMap decodes a JSON body into map[string]any for the Raw field.
// Failure is non-fatal: the normalized fields are what the rest of the
// stack relies on.
func rawToMap(body []byte) map[string]any {
	var m map[string]any
	_ = json.Unmarshal(body, &m)
	if m == nil {
		m = map[string]any{}
	}
	return m
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// ParseStateURL is a small helper used by tests + the controller: given
// the URL we built via AuthCodeURL, extract the state + PKCE challenge.
// The challenge comes back as both `code_challenge` and
// `code_challenge_method=S256`.
func ParseAuthURL(rawURL string) (state, codeChallenge, codeChallengeMethod string, err error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", "", "", err
	}
	q := u.Query()
	state = q.Get("state")
	codeChallenge = q.Get("code_challenge")
	codeChallengeMethod = q.Get("code_challenge_method")
	return state, codeChallenge, codeChallengeMethod, nil
}
