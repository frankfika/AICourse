// Package config loads runtime configuration from environment variables.
// Compatible with the existing .env contract used by apps/api (NestJS).
//
// Resolution order: explicit env > .env file > defaults.
package config

import (
	"fmt"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config holds all runtime settings.
type Config struct {
	Env                 string
	Host                string
	Port                int
	MetricsPort         int
	Version             string
	CORSOrigin          string
	DatabaseURL         string
	RedisURL            string
	S3Endpoint          string
	S3Bucket            string
	S3AccessKey         string
	S3SecretKey         string
	JWTSecret           string
	JWTRefreshSecret    string
	StripeSecret        string
	StripeWebhookSecret string
	SAMLEntityID        string
	SAMLCert            string
	SAMLKey             string
	ResendAPIKey        string
	MailFrom            string
	PublicURL           string
	LocalUploadDir      string
	UploadPublicBaseURL string
}

// Load reads configuration from env / .env.
func Load() (*Config, error) {
	// .env is optional — production may set env vars directly.
	_ = godotenv.Load()                  // .env
	_ = godotenv.Load(".env.production") // optional override

	v := viper.New()
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Defaults mirror apps/api/.env.example so the Go API is drop-in compatible.
	v.SetDefault("NODE_ENV", "development")
	v.SetDefault("API_HOST", "0.0.0.0")
	v.SetDefault("API_PORT", 8080)
	v.SetDefault("METRICS_PORT", 9090)
	v.SetDefault("APP_VERSION", "0.1.0-phase0")
	v.SetDefault("CORS_ORIGIN", "http://localhost:3000")
	v.SetDefault("DATABASE_URL", "mysql://ai_academy:ai_academy_pass@127.0.0.1:3307/ai_academy")
	// Development gets the docker-compose Redis by default. Production must
	// provide REDIS_URL explicitly so OAuth/SAML state is never silently sent
	// to localhost.
	if v.GetString("NODE_ENV") != "production" {
		v.SetDefault("REDIS_URL", "redis://127.0.0.1:6380")
	}
	v.SetDefault("S3_ENDPOINT", "http://127.0.0.1:9010")
	v.SetDefault("S3_BUCKET", "ai-academy")
	v.SetDefault("S3_ACCESS_KEY", "minioadmin")
	v.SetDefault("S3_SECRET_KEY", "minioadmin")
	v.SetDefault("STRIPE_SECRET", "")
	v.SetDefault("STRIPE_WEBHOOK_SECRET", "")
	v.SetDefault("SAML_ENTITY_ID", "")
	v.SetDefault("SAML_CERT", "")
	v.SetDefault("SAML_KEY", "")
	v.SetDefault("UPLOAD_LOCAL_DIR", "./var/uploads")
	v.SetDefault("UPLOAD_PUBLIC_BASE_URL", "")

	cfg := &Config{
		Env:                 v.GetString("NODE_ENV"),
		Host:                v.GetString("API_HOST"),
		Port:                v.GetInt("API_PORT"),
		MetricsPort:         v.GetInt("METRICS_PORT"),
		Version:             v.GetString("APP_VERSION"),
		CORSOrigin:          v.GetString("CORS_ORIGIN"),
		DatabaseURL:         v.GetString("DATABASE_URL"),
		RedisURL:            v.GetString("REDIS_URL"),
		S3Endpoint:          v.GetString("S3_ENDPOINT"),
		S3Bucket:            v.GetString("S3_BUCKET"),
		S3AccessKey:         v.GetString("S3_ACCESS_KEY"),
		S3SecretKey:         v.GetString("S3_SECRET_KEY"),
		JWTSecret:           v.GetString("JWT_SECRET"),
		JWTRefreshSecret:    v.GetString("JWT_REFRESH_SECRET"),
		StripeSecret:        v.GetString("STRIPE_SECRET"),
		StripeWebhookSecret: v.GetString("STRIPE_WEBHOOK_SECRET"),
		SAMLEntityID:        v.GetString("SAML_ENTITY_ID"),
		SAMLCert:            v.GetString("SAML_CERT"),
		SAMLKey:             v.GetString("SAML_KEY"),
		ResendAPIKey:        v.GetString("RESEND_API_KEY"),
		MailFrom:            v.GetString("MAIL_FROM"),
		PublicURL:           v.GetString("PUBLIC_URL"),
		LocalUploadDir:      v.GetString("UPLOAD_LOCAL_DIR"),
		UploadPublicBaseURL: v.GetString("UPLOAD_PUBLIC_BASE_URL"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// validate mirrors the assertion logic from apps/api/src/main.ts
// (refuse to boot with weak/placeholder secrets).
func (c *Config) validate() error {
	if c.JWTSecret != "" {
		if len(c.JWTSecret) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters long (got %d)", len(c.JWTSecret))
		}
		placeholders := []string{"change-this", "changeme", "placeholder", "your-secret", "example", "test-secret"}
		low := strings.ToLower(c.JWTSecret)
		for _, p := range placeholders {
			if strings.Contains(low, p) {
				return fmt.Errorf("JWT_SECRET looks like a placeholder (%q)", p)
			}
		}
	}
	return nil
}
