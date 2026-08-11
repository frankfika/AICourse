package config

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidate_RejectsShortSecret(t *testing.T) {
	t.Parallel()
	c := &Config{JWTSecret: "short"}
	err := c.validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at least 32 characters")
}

func TestValidate_RejectsPlaceholderSecret(t *testing.T) {
	t.Parallel()
	cases := []string{
		"change-this-secret-with-enough-length-32chars",
		"this-is-a-CHANGEME-token-with-32-chars",
		"placeholder-secret-32-chars-padding-x",
		"your-secret-32-chars-padding-here-okay",
		"example-secret-32-chars-padding-here-ok",
		"test-secret-32-chars-padding-here-okay",
	}
	for _, secret := range cases {
		secret := secret
		t.Run(secret, func(t *testing.T) {
			t.Parallel()
			c := &Config{JWTSecret: secret}
			err := c.validate()
			require.Error(t, err, "secret should be rejected: %q", secret)
		})
	}
}

func TestValidate_AcceptsStrongSecret(t *testing.T) {
	t.Parallel()
	c := &Config{JWTSecret: "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"}
	assert.NoError(t, c.validate())
}

func TestValidate_AllowsEmptySecret(t *testing.T) {
	t.Parallel()
	// Phase 0: no auth endpoints yet, so an empty JWT_SECRET is allowed.
	// Phase 1 will require a non-empty value.
	c := &Config{}
	assert.NoError(t, c.validate())
}

func TestLoad_ReadsEnvOverrides(t *testing.T) {
	// Cannot use t.Setenv() with t.Parallel() in Go 1.22+.
	// Use os.Setenv and clean up in defer.
	prev, had := os.LookupEnv("API_PORT")
	defer func() {
		if had {
			_ = os.Setenv("API_PORT", prev)
		} else {
			_ = os.Unsetenv("API_PORT")
		}
	}()

	require.NoError(t, os.Setenv("API_PORT", "9090"))
	require.NoError(t, os.Setenv("NODE_ENV", "production"))

	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, 9090, cfg.Port)
	assert.Equal(t, "production", cfg.Env)
}

func TestLoad_DefaultValues(t *testing.T) {
	// Explicitly clear env to avoid cross-test pollution. Cannot use
	// t.Setenv() with t.Parallel() (Go 1.22+), so this test is serial.
	for _, k := range []string{"API_PORT", "NODE_ENV", "JWT_SECRET"} {
		prev, had := os.LookupEnv(k)
		if had {
			defer func(k, p string) { _ = os.Setenv(k, p) }(k, prev)
		} else {
			defer func(k string) { _ = os.Unsetenv(k) }(k)
		}
		_ = os.Unsetenv(k)
	}

	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, 8080, cfg.Port)
	assert.Equal(t, "development", cfg.Env)
}

func TestLoad_DefaultsAreNotPlaceholder(t *testing.T) {
	cfg, err := Load()
	require.NoError(t, err)
	// These should not match any placeholder; sanity check the
	// configuration surface isn't accidentally brittle.
	assert.NotContains(t, strings.ToLower(cfg.JWTSecret), "change-this")
}
