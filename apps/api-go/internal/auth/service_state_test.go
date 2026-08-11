package auth

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingStateStore struct {
	*MemoryStateStore
	savedOAuthKey string
	savedOAuth    OAuthState
	savedTTL      time.Duration
	savedSAMLKey  string
	savedSAML     SAMLState
	savedSAMLTTL  time.Duration
}

type failingStateStore struct{ err error }

func (s failingStateStore) SaveOAuth(context.Context, string, OAuthState, time.Duration) error {
	return s.err
}
func (s failingStateStore) ConsumeOAuth(context.Context, string) (OAuthState, error) {
	return OAuthState{}, s.err
}
func (s failingStateStore) SaveSAML(context.Context, string, SAMLState, time.Duration) error {
	return s.err
}
func (s failingStateStore) ConsumeSAML(context.Context, string) (SAMLState, error) {
	return SAMLState{}, s.err
}

func (s *recordingStateStore) SaveSAML(ctx context.Context, key string, payload SAMLState, ttl time.Duration) error {
	s.savedSAMLKey = key
	s.savedSAML = payload
	s.savedSAMLTTL = ttl
	return s.MemoryStateStore.SaveSAML(ctx, key, payload, ttl)
}

func (s *recordingStateStore) SaveOAuth(ctx context.Context, key string, payload OAuthState, ttl time.Duration) error {
	s.savedOAuthKey = key
	s.savedOAuth = payload
	s.savedTTL = ttl
	return s.MemoryStateStore.SaveOAuth(ctx, key, payload, ttl)
}

func TestAuthServiceOAuthStartCallbackConsumesState(t *testing.T) {
	t.Parallel()
	p, _ := oauthTestSetup(t, "oauth.google", &googleMockHandler{
		accessToken: "token",
		email:       "state-flow@example.test",
		sub:         "state-flow-subject",
		name:        "State Flow",
	})
	store := &recordingStateStore{MemoryStateStore: NewMemoryStateStore()}
	svc := NewAuthService()
	svc.Register(p)
	svc.SetStateStore(store)

	authz, err := svc.CreateAuthorization(context.Background(), "oauth.google")
	require.NoError(t, err)
	require.NotEmpty(t, authz.State)
	assert.Equal(t, authz.State, store.savedOAuthKey)
	assert.Equal(t, "oauth.google", store.savedOAuth.Provider)
	assert.Equal(t, authorizationFlowLogin, store.savedOAuth.Flow)
	assert.Empty(t, store.savedOAuth.UserID)
	assert.NotEmpty(t, store.savedOAuth.CodeVerifier)
	assert.Equal(t, OAuthStateTTL, store.savedTTL)
	parsed, err := url.Parse(authz.URL)
	require.NoError(t, err)
	assert.Equal(t, authz.State, parsed.Query().Get("state"))

	identity, err := svc.HandleOAuthCallback(context.Background(), "oauth.google", authz.State, "valid-code")
	require.NoError(t, err)
	assert.Equal(t, "state-flow-subject", identity.ProviderUserID)

	_, err = svc.HandleOAuthCallback(context.Background(), "oauth.google", authz.State, "replayed-code")
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
}

func TestAuthServiceOAuthDirectAuthenticateRejectedOutsideTestMode(t *testing.T) {
	p, _ := oauthTestSetup(t, "oauth.google", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("direct OAuth must not reach the IdP without state")
	}))
	svc := NewAuthService()
	svc.Register(p)

	_, err := svc.Authenticate(context.Background(), "oauth.google", AuthCredentials{
		"code":          "code",
		"_codeVerifier": "client-controlled-verifier",
	})
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
}

func TestAuthServiceOAuthStateStoreNotInjectedReturnsSafeError(t *testing.T) {
	t.Parallel()
	p, _ := oauthTestSetup(t, "oauth.google", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	svc := NewAuthService()
	svc.Register(p)

	assert.NotPanics(t, func() {
		_, err := svc.CreateAuthorization(context.Background(), "oauth.google")
		var appErr *errs.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
	})

	assert.NotPanics(t, func() {
		_, err := svc.HandleOAuthCallback(context.Background(), "oauth.google", "state", "code")
		var appErr *errs.AppError
		require.True(t, errors.As(err, &appErr))
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
	})
}

func TestAuthServiceStateStoreRuntimeFailureFailsClosed(t *testing.T) {
	p, _ := oauthTestSetup(t, "oauth.google", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("IdP must not be contacted when state storage is unavailable")
	}))
	svc := NewAuthService()
	svc.Register(p)
	svc.SetStateStore(failingStateStore{err: errors.New("redis unavailable")})

	_, err := svc.CreateAuthorization(context.Background(), "oauth.google")
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)

	_, err = svc.HandleOAuthCallback(context.Background(), "oauth.google", "opaque-state", "code")
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
}

func TestAuthServiceSAMLStartPersistsOneShotRelayState(t *testing.T) {
	t.Parallel()
	p := newTestSsoProvider(t, newTestIdP(t))
	store := &recordingStateStore{MemoryStateStore: NewMemoryStateStore()}
	svc := NewAuthService()
	svc.Register(p)
	svc.SetStateStore(store)

	authz, err := svc.CreateAuthorization(context.Background(), "sso.saml")
	require.NoError(t, err)
	assert.Equal(t, authz.State, store.savedSAMLKey)
	assert.Equal(t, "sso.saml", store.savedSAML.Provider)
	assert.Equal(t, authorizationFlowLogin, store.savedSAML.Flow)
	assert.Empty(t, store.savedSAML.UserID)
	assert.NotEmpty(t, store.savedSAML.RequestID)
	assert.Equal(t, SAMLStateTTL, store.savedSAMLTTL)

	payload, err := store.ConsumeSAML(context.Background(), authz.State)
	require.NoError(t, err)
	assert.Equal(t, store.savedSAML.RequestID, payload.RequestID)
	_, err = store.ConsumeSAML(context.Background(), authz.State)
	assert.ErrorIs(t, err, ErrStateNotFound)
}

func TestAuthServiceOAuthLinkStateIsBoundToFlowAndUser(t *testing.T) {
	p, _ := oauthTestSetup(t, "oauth.google", &googleMockHandler{
		accessToken: "token", email: "link@example.test", sub: "link-subject", name: "Link",
	})
	store := &recordingStateStore{MemoryStateStore: NewMemoryStateStore()}
	svc := NewAuthService()
	svc.Register(p)
	svc.SetStateStore(store)

	authz, err := svc.CreateLinkAuthorization(context.Background(), "victim-user", "oauth.google")
	require.NoError(t, err)
	assert.Equal(t, authorizationFlowLink, store.savedOAuth.Flow)
	assert.Equal(t, "victim-user", store.savedOAuth.UserID)

	err = svc.LinkIdentity(context.Background(), "attacker-user", "oauth.google", AuthCredentials{
		"state": authz.State,
		"code":  "attacker-code",
	})
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)

	login, err := svc.CreateAuthorization(context.Background(), "oauth.google")
	require.NoError(t, err)
	err = svc.LinkIdentity(context.Background(), "victim-user", "oauth.google", AuthCredentials{
		"state": login.State,
		"code":  "attacker-code",
	})
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
}

func TestAuthServiceSAMLLinkStateIsBoundToFlowAndUser(t *testing.T) {
	p := newTestSsoProvider(t, newTestIdP(t))
	store := &recordingStateStore{MemoryStateStore: NewMemoryStateStore()}
	svc := NewAuthService()
	svc.Register(p)
	svc.SetStateStore(store)

	authz, err := svc.CreateLinkAuthorization(context.Background(), "victim-user", "sso.saml")
	require.NoError(t, err)
	assert.Equal(t, authorizationFlowLink, store.savedSAML.Flow)
	assert.Equal(t, "victim-user", store.savedSAML.UserID)

	err = svc.LinkIdentity(context.Background(), "attacker-user", "sso.saml", AuthCredentials{
		"RelayState":   authz.State,
		"SAMLResponse": "not-needed-before-user-check",
	})
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
}

func TestAuthServiceSAMLStateStoreNotInjectedReturnsSafeError(t *testing.T) {
	t.Parallel()
	p := newTestSsoProvider(t, newTestIdP(t))
	svc := NewAuthService()
	svc.Register(p)

	assert.NotPanics(t, func() {
		_, err := svc.CreateAuthorization(context.Background(), "sso.saml")
		var appErr *errs.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
	})
}
