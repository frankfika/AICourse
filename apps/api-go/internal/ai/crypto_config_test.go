package ai

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestValidateEncryptionConfigProductionFailClosed(t *testing.T) {
	for _, tc := range []struct {
		name string
		key  string
	}{
		{name: "missing"},
		{name: "too short raw", key: "short"},
		{name: "decoded base64 not 32 bytes", key: base64.StdEncoding.EncodeToString([]byte("short"))},
		{name: "hex not 32 bytes", key: strings.Repeat("ab", 31)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("AI_KEY_ENC_KEY", tc.key)
			require.Error(t, ValidateEncryptionConfig("production"))
		})
	}
}

func TestProductionEncryptionNeverUsesStub(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("AI_KEY_ENC_KEY", "invalid")
	ciphertext, err := encryptAPIKey("super-secret-provider-key")
	require.Error(t, err)
	assert.Empty(t, ciphertext)
	assert.False(t, strings.HasPrefix(ciphertext, stubPrefix))
}

func TestProductionEncryptionUsesAESGCMWithValid32ByteKey(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("AI_KEY_ENC_KEY", strings.Repeat("k", 32))
	require.NoError(t, ValidateEncryptionConfig("production"))
	ciphertext, err := encryptAPIKey("super-secret-provider-key")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(ciphertext, realPrefix))
	assert.False(t, strings.HasPrefix(ciphertext, stubPrefix))
}

func TestDevelopmentEncryptionKeepsExplicitStubCompatibility(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("AI_KEY_ENC_KEY", "")
	require.NoError(t, ValidateEncryptionConfig("development"))
	ciphertext, err := encryptAPIKey("development-only-key")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(ciphertext, stubPrefix))
}

func TestProductionUpsertsRejectBeforeRepositoryWithoutEncryptionKey(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("AI_KEY_ENC_KEY", "")
	svc := NewService(nil, zap.NewNop())

	assert.NotPanics(t, func() {
		_, err := svc.UpsertConfig(context.Background(), UpsertConfigInput{
			Provider: "openai", APIKey: "provider-secret", Model: "gpt-test",
		})
		require.Error(t, err)
	})
	assert.NotPanics(t, func() {
		_, err := svc.UpsertUserConfig(context.Background(), "user-1", UpsertUserConfigInput{
			Provider: "openai", APIKey: "provider-secret", Model: "gpt-test",
		})
		require.Error(t, err)
	})
}
