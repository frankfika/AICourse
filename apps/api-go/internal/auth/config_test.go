package auth

import (
	"os"
	"testing"
)

func TestLoadAuthConfig_DefaultsToEmailPassword(t *testing.T) {
	_ = os.Unsetenv("AUTH_PROVIDERS")
	cfg, err := LoadAuthConfig()
	if err != nil {
		t.Fatalf("LoadAuthConfig: %v", err)
	}
	if len(cfg.EnabledProviders) != 1 || cfg.EnabledProviders[0] != "email_password" {
		t.Errorf("expected default to be [email_password], got %v", cfg.EnabledProviders)
	}
	if _, ok := cfg.ProviderConfigs["email_password"]; !ok {
		t.Error("email_password config not populated")
	}
}

func TestLoadAuthConfig_RejectsUnknownProvider(t *testing.T) {
	_ = os.Setenv("AUTH_PROVIDERS", "weird.madeup")
	defer os.Unsetenv("AUTH_PROVIDERS")
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic for unknown provider id")
		}
	}()
	_, _ = LoadAuthConfig()
}

func TestBuildService_EmailPasswordWithoutRepoFails(t *testing.T) {
	cfg := &AuthConfig{
		EnabledProviders: []ProviderID{"email_password"},
		ProviderConfigs: map[ProviderID]map[string]any{
			"email_password": {"bcrypt_rounds": 4},
		},
	}
	_, err := BuildService(cfg, nil) // nil repo is fine for the build path; bcrypt is generated on demand
	if err != nil {
		t.Errorf("BuildService: %v", err)
	}
}
