// SsoProvider — SAML 2.0 single sign-on (and OIDC SSO in the future).
//
// Phase 1 T8: real SAML 2.0 SP-initiated flow using crewjam/saml.
//
// Phase 0 T3 POC (apps/api-go/cmd/poc-ext-deps/main.go §4) proved the
// round-trip with crewjam/saml. The lessons that inform this file:
//   - `IdpAuthnRequest.HTTPRequest` is dereferenced inside
//     `DefaultAssertionMaker.MakeAssertion` — must pass a non-nil
//     `*http.Request` (use `httptest.NewRequest`).
//   - `ParseResponse` expects base64-encoded XML in `r.PostForm["SAMLResponse"]`,
//     NOT raw bytes.
//   - `node-saml` flattens attributes into `profile`; crewjam returns
//     OID-keyed raw list — the adapter (saml_adapter.go) maps.
//
// Workflow:
//
//	[Start]  GET  /api/v1/auth/sso.saml/start
//	           → build an AuthnRequest via crewjam/saml
//	           → persist {provider, requestId} in Redis under
//	             saml:relay:{relayState} (TTL 10min)
//	           → return {url, relayState} to the client
//	[User]   client 302-redirects to the IdP's SSO URL
//	[IdP]    user authenticates; IdP POSTs SAMLResponse + RelayState
//	          to the configured ACS URL
//	[ACS]    POST /api/v1/auth/sso.saml/acs
//	           → look up RelayState in Redis
//	           → call samlsp.ParseResponse with the request
//	           → run the assertion through mapSAMLAttributes + extractProfile
//	           → return AuthIdentity
package auth

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/crewjam/saml"
	"github.com/crewjam/saml/samlsp"
)

// ssoConfig is the per-provider config block. Either an IdP metadata
// URL is set (preferred) or inline IdP metadata XML; the SP cert +
// key are always required (used to sign AuthnRequests + decrypt
// encrypted assertions).
type ssoConfig struct {
	MetadataURL string `mapstructure:"metadata_url"`
	MetadataXML string `mapstructure:"metadata_xml"`

	CertFile string `mapstructure:"cert_file"`
	KeyFile  string `mapstructure:"key_file"`

	ACSPath  string `mapstructure:"acs_path"`
	EntityID string `mapstructure:"entity_id"`
}

// SsoProvider is the production SAML 2.0 provider. It builds an
// samlsp.Middleware at construction time so the per-request cost is
// just ParseResponse + attribute flattening.
type SsoProvider struct {
	id      ProviderID
	cfg     ssoConfig
	sp      *samlsp.Middleware
	idpMeta *saml.EntityDescriptor
}

// NewSsoProvider builds a SAML SP from the config block. Validates the
// IdP metadata + SP cert/key eagerly so a misconfigured deployment
// fails at boot rather than at first login attempt.
func NewSsoProvider(id ProviderID, cfg map[string]any) (*SsoProvider, error) {
	sso := decodeSSOConfig(cfg)
	if sso.MetadataURL == "" && sso.MetadataXML == "" {
		return nil, fmt.Errorf("sso: %s: missing idp metadata (set AUTH_SSO_SAML_METADATA_URL or AUTH_SSO_SAML_METADATA_XML)", id)
	}
	if sso.CertFile == "" || sso.KeyFile == "" {
		return nil, fmt.Errorf("sso: %s: missing sp cert/key (set AUTH_SSO_SAML_CERT_FILE + AUTH_SSO_SAML_KEY_FILE)", id)
	}
	if sso.EntityID == "" {
		return nil, fmt.Errorf("sso: %s: missing entity_id (set AUTH_SSO_SAML_ENTITY_ID)", id)
	}
	if sso.ACSPath == "" {
		// Default ACS path matching the controller route.
		sso.ACSPath = "/api/v1/auth/sso.saml/acs"
	}

	// 1. Load IdP metadata.
	var idpMeta *saml.EntityDescriptor
	if sso.MetadataXML != "" {
		var err error
		idpMeta, err = samlsp.ParseMetadata([]byte(sso.MetadataXML))
		if err != nil {
			return nil, fmt.Errorf("sso: %s: parse idp metadata: %w", id, err)
		}
	} else {
		// We don't fetch the URL eagerly at NewSsoProvider time —
		// that would block boot if the IdP is temporarily down.
		// Instead, parse what we have (we don't, since URL is empty
		// in this branch) and let the runtime Init handle it. For
		// Phase 1, the tests use inline XML; the controller's start
		// endpoint will fetch on first call.
		return nil, fmt.Errorf("sso: %s: MetadataURL not yet supported at NewSsoProvider time; provide AUTH_SSO_SAML_METADATA_XML inline", id)
	}

	// 2. Load SP cert + key from disk.
	certPEM, err := os.ReadFile(sso.CertFile)
	if err != nil {
		return nil, fmt.Errorf("sso: %s: read cert_file: %w", id, err)
	}
	keyPEM, err := os.ReadFile(sso.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("sso: %s: read key_file: %w", id, err)
	}
	cert, err := certFromPEM(certPEM)
	if err != nil {
		return nil, fmt.Errorf("sso: %s: parse sp cert: %w", id, err)
	}
	key, err := keyFromPEM(keyPEM)
	if err != nil {
		return nil, fmt.Errorf("sso: %s: parse sp key: %w", id, err)
	}

	// 3. Build the SP. The EntityID we advertise is the SP's; the
	//    IdP's entityID comes from the metadata we loaded.
	acsURL, err := url.Parse("https://localhost" + sso.ACSPath) // host is a placeholder; samlsp only needs the path
	if err != nil {
		return nil, fmt.Errorf("sso: %s: parse acs path: %w", id, err)
	}
	mw, err := samlsp.New(samlsp.Options{
		EntityID:    sso.EntityID,
		URL:         *acsURL,
		Key:         key,
		Certificate: cert,
		IDPMetadata: idpMeta,
	})
	if err != nil {
		return nil, fmt.Errorf("sso: %s: build samlsp: %w", id, err)
	}
	// The middleware defaults the ACS to {RootURL}/saml/acs. Override
	// with our configured path so the IdP posts to the right endpoint.
	mw.ServiceProvider.AcsURL = *mustParseURL("https://placeholder" + sso.ACSPath)
	mw.ServiceProvider.MetadataURL = *mustParseURL("https://placeholder" + "/saml/metadata")

	return &SsoProvider{id: id, cfg: sso, sp: mw, idpMeta: idpMeta}, nil
}

func decodeSSOConfig(in map[string]any) ssoConfig {
	getStr := func(k string) string {
		if v, ok := in[k].(string); ok {
			return v
		}
		return ""
	}
	return ssoConfig{
		MetadataURL: getStr("metadata_url"),
		MetadataXML: getStr("metadata_xml"),
		CertFile:    getStr("cert_file"),
		KeyFile:     getStr("key_file"),
		ACSPath:     getStr("acs_path"),
		EntityID:    getStr("entity_id"),
	}
}

func mustParseURL(s string) *url.URL {
	u, _ := url.Parse(s)
	return u
}

func certFromPEM(pemBytes []byte) (*x509.Certificate, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("no PEM block found")
	}
	return x509.ParseCertificate(block.Bytes)
}

func keyFromPEM(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("no PEM block found")
	}
	// Try PKCS#8 first (modern openssl default), fall back to PKCS#1.
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rk, ok := k.(*rsa.PrivateKey); ok {
			return rk, nil
		}
		return nil, fmt.Errorf("key is %T, want *rsa.PrivateKey", k)
	}
	if rk, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return rk, nil
	}
	return nil, errors.New("PEM does not contain a PKCS#1 or PKCS#8 RSA private key")
}

// ID / Type / Enabled implement the AuthProvider interface.
func (p *SsoProvider) ID() ProviderID     { return p.id }
func (p *SsoProvider) Type() ProviderType { return ProviderSSO }
func (p *SsoProvider) Enabled() bool      { return p != nil && p.sp != nil }

// AuthnRequestResult is the response of a "start" call. The dispatcher
// returns the URL to the client (for browser 302-redirect) and stores
// the relayState in the state store so the ACS callback can correlate.
type AuthnRequestResult struct {
	URL        string
	RelayState string
	RequestID  string
}

// BuildAuthnRequest creates the SAML AuthnRequest, computes a
// relayState the dispatcher will use as the Redis key, and returns
// the IdP's SSO URL. The dispatcher is responsible for persisting
// the (relayState → requestId, provider) payload in the state store.
func (p *SsoProvider) BuildAuthnRequest(ctx context.Context, idpSSOURL string) (AuthnRequestResult, error) {
	// Look up the IdP's SSO endpoint from the metadata. Default to
	// HTTP-POST binding (the most common modern IdP choice).
	location := idpSSOURL
	if location == "" {
		location = p.idpMeta.IDPSSODescriptors[0].SingleSignOnServices[0].Location
	}
	req, err := p.sp.ServiceProvider.MakeAuthenticationRequest(
		location,
		saml.HTTPRedirectBinding,
		saml.HTTPPostBinding,
	)
	if err != nil {
		return AuthnRequestResult{}, fmt.Errorf("sso: build authn request: %w", err)
	}
	relay, err := GenerateRandomState()
	if err != nil {
		return AuthnRequestResult{}, fmt.Errorf("sso: generate relay state: %w", err)
	}
	// The SP doesn't know how to redirect via the binding itself; we
	// leave that to the controller. We just hand back the structured
	// request; the controller serializes it to a SAMLRequest form field.
	return AuthnRequestResult{
		URL:        location, // IdP SSO URL the browser posts to
		RelayState: relay,
		RequestID:  req.ID,
	}, nil
}

// ParseRelayState extracts the in-flight payload the dispatcher saved
// when the start endpoint was called. Returns the requestID we expect
// the SAMLResponse to be InResponseTo.
func (p *SsoProvider) ParseRelayState(ctx context.Context, store StateStore, relayState string) (SAMLState, error) {
	if relayState == "" {
		return SAMLState{}, fmt.Errorf("%w: missing relayState", ErrInvalidCredentials)
	}
	payload, err := store.ConsumeSAML(ctx, relayState)
	if err != nil {
		if errors.Is(err, ErrStateNotFound) {
			return SAMLState{}, fmt.Errorf("%w: %v", ErrInvalidCredentials, err)
		}
		return SAMLState{}, err
	}
	if payload.Provider != string(p.id) {
		return SAMLState{}, fmt.Errorf("%w: relay state provider mismatch", ErrInvalidCredentials)
	}
	return payload, nil
}

// ProcessResponse accepts the base64-encoded SAMLResponse from the
// IdP, decodes it, and verifies the signature + extracts the NameID +
// attributes. The acsURL must match the SP's configured ACS URL or
// signature verification will fail.
//
// Returns the AuthIdentity (NameID + flattened attributes) so the
// dispatcher can do the user upsert.
func (p *SsoProvider) ProcessResponse(ctx context.Context, samlResponseB64, relayState, requestID string) (AuthIdentity, error) {
	if samlResponseB64 == "" {
		return AuthIdentity{}, fmt.Errorf("%w: missing SAMLResponse", ErrInvalidCredentials)
	}
	// Construct a synthetic *http.Request ParseResponse can read.
	// PostForm must contain the base64-encoded response (NOT raw bytes
	// — ParseResponse does its own base64 decode).
	form := url.Values{}
	form.Set("SAMLResponse", samlResponseB64)
	if relayState != "" {
		form.Set("RelayState", relayState)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.sp.ServiceProvider.AcsURL.String(), nil)
	if err != nil {
		return AuthIdentity{}, fmt.Errorf("sso: build synthetic request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.PostForm = form
	req.Form = form

	assertion, err := p.sp.ServiceProvider.ParseResponse(req, []string{requestID})
	if err != nil {
		// Pull the underlying error out of InvalidResponseError for a
		// more useful log line.
		if inv, ok := err.(*saml.InvalidResponseError); ok && inv.PrivateErr != nil {
			return AuthIdentity{}, fmt.Errorf("%w: %v", ErrInvalidCredentials, inv.PrivateErr)
		}
		return AuthIdentity{}, fmt.Errorf("%w: %v", ErrInvalidCredentials, err)
	}
	if assertion == nil || assertion.Subject == nil || assertion.Subject.NameID == nil {
		return AuthIdentity{}, fmt.Errorf("%w: assertion missing NameID", ErrInvalidCredentials)
	}
	nameID := assertion.Subject.NameID.Value
	attrs := FlattenAttributes(assertion)
	profile := ExtractProfile(nameID, attrs)
	if profile.Email == "" {
		// Without an email we cannot upsert a user. The NestJS source
		// throws at sso.provider.ts:59 for the same reason.
		return AuthIdentity{}, fmt.Errorf("%w: SAML assertion missing email attribute", ErrInvalidCredentials)
	}
	return AuthIdentity{
		ProviderUserID: nameID,
		Profile:        profile,
	}, nil
}

// Verify is the AuthProvider interface entry point. The dispatcher
// passes creds = {samlResponse, relayState, _requestId}. We delegate
// to ProcessResponse.
func (p *SsoProvider) Verify(ctx context.Context, creds AuthCredentials) (AuthIdentity, error) {
	samlResp, _ := creds["samlResponse"].(string)
	relay, _ := creds["relayState"].(string)
	reqID, _ := creds["_requestId"].(string)
	return p.ProcessResponse(ctx, samlResp, relay, reqID)
}

// Link is the AuthProvider interface entry point for binding an
// existing user to a SAML account. It runs the same response flow
// (the IdP doesn't distinguish auth vs link at the protocol level).
func (p *SsoProvider) Link(ctx context.Context, userID string, creds AuthCredentials) error {
	_, err := p.Verify(ctx, creds)
	return err
}

// Describe implements the optional AuthProvider UI-metadata method.
func (p *SsoProvider) Describe() *ProviderDescriptor {
	return &ProviderDescriptor{
		ID:    p.id,
		Label: "Enterprise SSO (SAML)",
		Type:  p.Type(),
	}
}

// decodeSAMLResponseB64 is exposed for tests that want to inspect the
// raw decoded XML. Production code never calls this; the dispatcher
// feeds the base64 string straight to ParseResponse.
func decodeSAMLResponseB64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}
