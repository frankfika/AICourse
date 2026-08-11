// Auth config loader — config-driven provider registration.
//
// Phase 1 T6 port of apps/api/src/modules/auth/config/auth.config.ts.
//
// env contract (mirrors the .env.example):
//
//	AUTH_PROVIDERS=email_password,oauth.google,oauth.github,sso.saml
//	AUTH_BCRYPT_ROUNDS=12
//	AUTH_OAUTH_GOOGLE_CLIENT_ID=...
//	AUTH_OAUTH_GOOGLE_CLIENT_SECRET=...
//	AUTH_OAUTH_GOOGLE_REDIRECT_URI=...
//	AUTH_OAUTH_GITHUB_CLIENT_ID=...
//	AUTH_OAUTH_GITHUB_CLIENT_SECRET=...
//	AUTH_OAUTH_GITHUB_REDIRECT_URI=...
//	AUTH_SSO_SAML_METADATA_URL=...    # preferred over inline cert
//	AUTH_SSO_SAML_CERT_FILE=...       # SP cert PEM
//	AUTH_SSO_SAML_KEY_FILE=...        # SP key PEM
//	AUTH_SSO_SAML_ACS_PATH=...        # e.g. /api/v1/auth/sso/acs
//	AUTH_SSO_SAML_ENTITY_ID=...       # SP entity id
//
// Fail-fast: if a provider is enabled but its required env is missing,
// boot must refuse to start (mirrors the TS source behavior).
package auth

import (
	"fmt"
	"os"
	"strings"
)

// AuthConfig is the loaded config block for the auth subsystem.
type AuthConfig struct {
	EnabledProviders []ProviderID
	ProviderConfigs  map[ProviderID]map[string]any
}

// LoadAuthConfig reads AUTH_PROVIDERS and per-provider env vars.
// Returns an error if any enabled provider is missing required env.
func LoadAuthConfig() (*AuthConfig, error) {
	enabledRaw := os.Getenv("AUTH_PROVIDERS")
	if enabledRaw == "" {
		enabledRaw = "email_password" // safe default, matches the TS source
	}
	enabled := make([]ProviderID, 0)
	for _, p := range strings.Split(enabledRaw, ",") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		enabled = append(enabled, ProviderID(p))
	}

	providers := make(map[ProviderID]map[string]any)
	var missing []string

	for _, id := range enabled {
		cfg, ok := loadProviderConfig(id)
		if !ok {
			missing = append(missing, string(id))
			continue
		}
		providers[id] = cfg
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf(
			"[auth.config] providers enabled but missing required env: %s. "+
				"Check the env vars listed in apps/api-go/internal/auth/config.go",
			strings.Join(missing, ", "),
		)
	}

	return &AuthConfig{EnabledProviders: enabled, ProviderConfigs: providers}, nil
}

// loadProviderConfig dispatches to per-provider loaders.
// Returns (cfg, true) on success, (nil, false) if a required env var is missing.
func loadProviderConfig(id ProviderID) (map[string]any, bool) {
	switch id {
	case "email_password":
		return loadEmailPasswordConfig(), true
	case "oauth.google":
		return loadOAuthConfig("GOOGLE")
	case "oauth.github":
		return loadOAuthConfig("GITHUB")
	case "sso.saml":
		return loadSAMLConfig()
	default:
		// Unknown provider id — fail-fast at boot.
		panic(fmt.Sprintf(
			"[auth.config] unknown provider id %q. Add it to loadProviderConfig first.",
			id,
		))
	}
}

func loadEmailPasswordConfig() map[string]any {
	rounds := 12
	if v := os.Getenv("AUTH_BCRYPT_ROUNDS"); v != "" {
		var n int
		fmt.Sscanf(v, "%d", &n)
		if n >= 4 && n <= 16 {
			rounds = n
		}
	}
	return map[string]any{"bcrypt_rounds": rounds}
}

func loadOAuthConfig(prefix string) (map[string]any, bool) {
	id := os.Getenv("AUTH_OAUTH_" + prefix + "_CLIENT_ID")
	secret := os.Getenv("AUTH_OAUTH_" + prefix + "_CLIENT_SECRET")
	redirect := os.Getenv("AUTH_OAUTH_" + prefix + "_REDIRECT_URI")
	if id == "" || secret == "" || redirect == "" {
		return nil, false
	}
	scopes := defaultScopesFor(prefix)
	return map[string]any{
		"client_id":     id,
		"client_secret": secret,
		"redirect_uri":  redirect,
		"scopes":        scopes,
	}, true
}

func defaultScopesFor(prefix string) []string {
	switch prefix {
	case "GOOGLE":
		return []string{"openid", "email", "profile"}
	case "GITHUB":
		return []string{"read:user", "user:email"}
	default:
		return []string{"openid", "email", "profile"}
	}
}

func loadSAMLConfig() (map[string]any, bool) {
	metadataURL := os.Getenv("AUTH_SSO_SAML_METADATA_URL")
	metadataXML := os.Getenv("AUTH_SSO_SAML_METADATA_XML")
	certFile := os.Getenv("AUTH_SSO_SAML_CERT_FILE")
	keyFile := os.Getenv("AUTH_SSO_SAML_KEY_FILE")
	acsPath := os.Getenv("AUTH_SSO_SAML_ACS_PATH")
	entityID := os.Getenv("AUTH_SSO_SAML_ENTITY_ID")
	if metadataURL == "" && metadataXML == "" {
		return nil, false
	}
	if certFile == "" || keyFile == "" {
		return nil, false
	}
	return map[string]any{
		"metadata_url": metadataURL,
		"metadata_xml": metadataXML,
		"cert_file":    certFile,
		"key_file":     keyFile,
		"acs_path":     acsPath,
		"entity_id":    entityID,
	}, true
}

// BuildService constructs an AuthService and registers all enabled providers.
// `repo` is the AuthRepo used by the email_password provider for user /
// provider-account CRUD, and by the dispatcher's identity-management methods.
//
// The token issuer is built separately (cmd/server/main.go calls
// NewJWTTokenIssuer) and handed to the handler directly — BuildService
// only deals with the provider factory.
//
// This is the main wiring function called from cmd/server/main.go.
func BuildService(cfg *AuthConfig, repo *AuthRepo) (*AuthService, error) {
	svc := NewAuthService()
	if repo != nil {
		svc.SetLinkRepo(repo)
	}
	for id, pcfg := range cfg.ProviderConfigs {
		var p AuthProvider
		var err error
		switch id {
		case "email_password":
			p, err = NewEmailPasswordProvider(pcfg, repo, nil)
		case "oauth.google", "oauth.github":
			p, err = NewOAuthProvider(id, pcfg)
		case "sso.saml":
			p, err = NewSsoProvider(id, pcfg)
		default:
			return nil, fmt.Errorf("auth: unknown provider id %q", id)
		}
		if err != nil {
			return nil, fmt.Errorf("auth: build %s: %w", id, err)
		}
		svc.Register(p)
	}
	return svc, nil
}
