// Package ai — admin-global and per-user AI provider configuration.
//
// Mirrors apps/api/src/modules/ai/ai-config.service.ts and
// apps/api/src/modules/ai/ai-user-config.controller.ts.
//
// Phase 2 T21: 9 endpoints total. All 4 admin + 3 user config endpoints
// are fully wired (DB-backed, encrypted-at-rest, masked on read). Provider
// verification and the 2 generate endpoints explicitly return 503 until a
// real upstream integration is available.
//
// API-key crypto note: T21 uses a reversible stub encryption (base64 of
// plaintext prefixed with "enc:") so the DB can hold ciphertext while the
// e2e suite verifies the *masking* contract. T21.1 will replace this
// with the same AES-256-GCM scheme as the NestJS AiKeyCrypto, including
// the env-driven master key (AI_KEY_ENC_KEY).
package ai

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ============================================================
// Repo layer
// ============================================================

// Repo is the AI config data layer. It exposes one Repo per underlying
// sqlc.Queries instance (the queries file already covers both admin and
// user tables).
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo builds a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// ============================================================
// Service layer
// ============================================================

// Service is the AI config + generate business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ============================================================
// Public DTOs (mirrors AiConfigPublic / UserAiConfigPublic in NestJS)
// ============================================================

// ConfigPublic is the admin config shape returned to clients.
// The apiKeyEnc field is never returned in cleartext — clients see
// apiKeyMasked ("****last4" or "****" for short keys) and a keySet
// boolean (false ⇒ no key stored yet).
type ConfigPublic struct {
	ID           string  `json:"id"`
	Provider     string  `json:"provider"`
	Model        string  `json:"model"`
	BaseURL      *string `json:"baseUrl,omitempty"`
	IsActive     bool    `json:"isActive"`
	APIKeyMasked string  `json:"apiKeyMasked"`
	KeySet       bool    `json:"keySet"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

// UserConfigPublic is the per-user config shape returned to clients.
type UserConfigPublic struct {
	ID           string  `json:"id"`
	Provider     string  `json:"provider"`
	Model        string  `json:"model"`
	BaseURL      *string `json:"baseUrl,omitempty"`
	IsActive     bool    `json:"isActive"`
	APIKeyMasked string  `json:"apiKeyMasked"`
	KeySet       bool    `json:"keySet"`
}

// CourseDraft / DegreeDraft mirror the NestJS response shapes for the
// two generate endpoints.
type CourseDraft struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Outlines    string `json:"outlines"`
	Stub        bool   `json:"stub"`
	Note        string `json:"note,omitempty"`
}

type DegreeDraft struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Levels      string `json:"levels"`
	Stub        bool   `json:"stub"`
	Note        string `json:"note,omitempty"`
}

// UpsertConfigInput is the admin upsert payload.
type UpsertConfigInput struct {
	Provider string
	APIKey   string
	Model    string
	BaseURL  *string
	IsActive *bool
}

// UpsertUserConfigInput is the user upsert payload.
type UpsertUserConfigInput struct {
	Provider string
	APIKey   string
	Model    string
	BaseURL  *string
	IsActive *bool
}

// GenerateCourseInput mirrors GenerateCourseDto.
type GenerateCourseInput struct {
	Topic string
	Hint  string
}

// GenerateDegreeInput mirrors GenerateDegreeDto.
type GenerateDegreeInput struct {
	Topic string
	Hint  string
}

// ============================================================
// Validation constants
// ============================================================

// AdminProviders are the providers allowed in the admin-global table.
// Mirrors the regex in ai-config.service.ts:157:
//
//	`^(gemini|openai|claude)$`
var AdminProviders = map[string]bool{
	"gemini": true,
	"openai": true,
	"claude": true,
}

// UserProviders mirrors USER_AI_PROVIDERS in NestJS:
//
//	gemini, openai, claude, openai-compatible, ollama
var UserProviders = map[string]bool{
	"gemini":            true,
	"openai":            true,
	"claude":            true,
	"openai-compatible": true,
	"ollama":            true,
}

// minAPIKeyLen is the minimum plaintext length for an API key (ollama
// is exempt — see NestJS upsertForUser).
const minAPIKeyLen = 8

// ============================================================
// Admin endpoints
// ============================================================

// ListConfigs returns all admin-global AI configs (masked).
func (s *Service) ListConfigs(ctx context.Context) ([]ConfigPublic, error) {
	rows, err := s.repo.q.ListAiConfigs(ctx)
	if err != nil {
		return nil, errs.Internal("list ai configs", err)
	}
	out := make([]ConfigPublic, 0, len(rows))
	for _, r := range rows {
		out = append(out, toConfigPublic(r))
	}
	return out, nil
}

// UpsertConfig inserts or updates an admin AI config.
func (s *Service) UpsertConfig(ctx context.Context, in UpsertConfigInput) (ConfigPublic, error) {
	if !AdminProviders[in.Provider] {
		return ConfigPublic{}, errs.BadRequest(fmt.Sprintf("provider 必须是 gemini | openai | claude, 收到: %s", in.Provider))
	}
	plain := strings.TrimSpace(in.APIKey)
	if len(plain) < minAPIKeyLen {
		return ConfigPublic{}, errs.BadRequest("apiKey 长度至少 8 字符")
	}
	if strings.TrimSpace(in.Model) == "" {
		return ConfigPublic{}, errs.BadRequest("model 不能为空")
	}

	now := time.Now().UTC()
	enc, err := encryptAPIKey(plain)
	if err != nil {
		return ConfigPublic{}, errs.Internal("encrypt api key", err)
	}
	baseURL := sql.NullString{}
	if in.BaseURL != nil && strings.TrimSpace(*in.BaseURL) != "" {
		baseURL = sql.NullString{String: strings.TrimSpace(*in.BaseURL), Valid: true}
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	// Check existing row (so we can preserve id + created_at on update).
	existing, getErr := s.repo.q.GetAiConfigByProvider(ctx, in.Provider)
	if getErr != nil && !errors.Is(getErr, sql.ErrNoRows) {
		return ConfigPublic{}, errs.Internal("lookup ai config", getErr)
	}
	if errors.Is(getErr, sql.ErrNoRows) {
		// INSERT
		id := uuid.NewString()
		if _, err := s.repo.q.CreateAiConfig(ctx, db.CreateAiConfigParams{
			ID:        id,
			Provider:  in.Provider,
			ApiKeyEnc: enc,
			Model:     strings.TrimSpace(in.Model),
			BaseUrl:   baseURL,
			IsActive:  isActive,
			CreatedAt: now,
			UpdatedAt: now,
		}); err != nil {
			return ConfigPublic{}, errs.Internal("create ai config", err)
		}
		row, err := s.repo.q.GetAiConfigByProvider(ctx, in.Provider)
		if err != nil {
			return ConfigPublic{}, errs.Internal("read back ai config", err)
		}
		return toConfigPublic(row), nil
	}
	// UPDATE
	if err := s.repo.q.UpdateAiConfig(ctx, db.UpdateAiConfigParams{
		ApiKeyEnc: enc,
		Model:     strings.TrimSpace(in.Model),
		BaseUrl:   baseURL,
		IsActive:  isActive,
		UpdatedAt: now,
		Provider:  in.Provider,
	}); err != nil {
		return ConfigPublic{}, errs.Internal("update ai config", err)
	}
	updated := existing
	updated.ApiKeyEnc = enc
	updated.Model = strings.TrimSpace(in.Model)
	updated.BaseUrl = baseURL
	updated.IsActive = isActive
	updated.UpdatedAt = now
	return toConfigPublic(updated), nil
}

// DeleteConfig removes an admin AI config. Idempotent: returns ok=true
// even if the row didn't exist.
func (s *Service) DeleteConfig(ctx context.Context, provider string) (map[string]any, error) {
	if provider == "" {
		return nil, errs.BadRequest("provider 必填")
	}
	if _, err := s.repo.q.DeleteAiConfig(ctx, provider); err != nil {
		return nil, errs.Internal("delete ai config", err)
	}
	return map[string]any{"ok": true, "provider": provider}, nil
}

// TestConnection is unavailable until the Go API has a real provider
// round-trip. Returning a successful probe without contacting the provider
// would make an unverified configuration look production-ready.
func (s *Service) TestConnection(_ context.Context) (map[string]any, error) {
	return nil, errs.ServiceUnavailable("AI provider verification is not implemented in the experimental Go API")
}

// ============================================================
// User endpoints
// ============================================================

// ListUserConfigs returns the caller's AI provider configs.
func (s *Service) ListUserConfigs(ctx context.Context, userID string) ([]UserConfigPublic, error) {
	rows, err := s.repo.q.ListUserAiConfigs(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list user ai configs", err)
	}
	out := make([]UserConfigPublic, 0, len(rows))
	for _, r := range rows {
		out = append(out, toUserConfigPublic(r))
	}
	return out, nil
}

// UpsertUserConfig inserts or updates a per-user AI config.
func (s *Service) UpsertUserConfig(ctx context.Context, userID string, in UpsertUserConfigInput) (UserConfigPublic, error) {
	if !UserProviders[in.Provider] {
		return UserConfigPublic{}, errs.BadRequest(fmt.Sprintf("不支持的 AI 接入方式: %s", in.Provider))
	}
	// ollama is exempt from the 8-char minimum (NestJS parity).
	if in.Provider != "ollama" && strings.TrimSpace(in.APIKey) == "" {
		return UserConfigPublic{}, errs.BadRequest("API Key 至少需要 8 个字符")
	}
	if in.Provider != "ollama" && len(strings.TrimSpace(in.APIKey)) < minAPIKeyLen {
		return UserConfigPublic{}, errs.BadRequest("API Key 至少需要 8 个字符")
	}
	if strings.TrimSpace(in.Model) == "" {
		return UserConfigPublic{}, errs.BadRequest("模型名称不能为空")
	}

	plain := strings.TrimSpace(in.APIKey)
	var baseURL sql.NullString
	if in.BaseURL != nil {
		trimmed := strings.TrimSpace(*in.BaseURL)
		if trimmed != "" {
			normalized, err := assertSafeUserBaseURL(in.Provider, trimmed)
			if err != nil {
				return UserConfigPublic{}, err
			}
			baseURL = sql.NullString{String: normalized, Valid: true}
		}
	}

	now := time.Now().UTC()
	enc, err := encryptAPIKey(plain)
	if err != nil {
		return UserConfigPublic{}, errs.Internal("encrypt api key", err)
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	existing, getErr := s.repo.q.GetUserAiConfig(ctx, db.GetUserAiConfigParams{
		UserID:   userID,
		Provider: in.Provider,
	})
	if getErr != nil && !errors.Is(getErr, sql.ErrNoRows) {
		return UserConfigPublic{}, errs.Internal("lookup user ai config", getErr)
	}
	if errors.Is(getErr, sql.ErrNoRows) {
		id := uuid.NewString()
		if _, err := s.repo.q.CreateUserAiConfig(ctx, db.CreateUserAiConfigParams{
			ID:        id,
			UserID:    userID,
			Provider:  in.Provider,
			ApiKeyEnc: enc,
			Model:     strings.TrimSpace(in.Model),
			BaseUrl:   baseURL,
			IsActive:  isActive,
			CreatedAt: now,
			UpdatedAt: now,
		}); err != nil {
			return UserConfigPublic{}, errs.Internal("create user ai config", err)
		}
		row, err := s.repo.q.GetUserAiConfig(ctx, db.GetUserAiConfigParams{
			UserID: userID, Provider: in.Provider,
		})
		if err != nil {
			return UserConfigPublic{}, errs.Internal("read back user ai config", err)
		}
		return toUserConfigPublic(row), nil
	}
	if err := s.repo.q.UpdateUserAiConfig(ctx, db.UpdateUserAiConfigParams{
		ApiKeyEnc: enc,
		Model:     strings.TrimSpace(in.Model),
		BaseUrl:   baseURL,
		IsActive:  isActive,
		UpdatedAt: now,
		UserID:    userID,
		Provider:  in.Provider,
	}); err != nil {
		return UserConfigPublic{}, errs.Internal("update user ai config", err)
	}
	updated := existing
	updated.ApiKeyEnc = enc
	updated.Model = strings.TrimSpace(in.Model)
	updated.BaseUrl = baseURL
	updated.IsActive = isActive
	updated.UpdatedAt = now
	return toUserConfigPublic(updated), nil
}

// DeleteUserConfig removes a per-user AI config. Idempotent.
func (s *Service) DeleteUserConfig(ctx context.Context, userID, provider string) error {
	if provider == "" {
		return errs.BadRequest("provider 必填")
	}
	if _, err := s.repo.q.DeleteUserAiConfig(ctx, db.DeleteUserAiConfigParams{
		UserID:   userID,
		Provider: provider,
	}); err != nil {
		return errs.Internal("delete user ai config", err)
	}
	return nil
}

// ============================================================
// Generate endpoints (explicitly unavailable)
// ============================================================

// GenerateCourse validates the request but refuses to fabricate a draft until
// a real provider integration is available.
func (s *Service) GenerateCourse(_ context.Context, in GenerateCourseInput) (CourseDraft, error) {
	topic := strings.TrimSpace(in.Topic)
	if topic == "" {
		return CourseDraft{}, errs.BadRequest("topic 不能为空")
	}
	if utf8.RuneCountInString(topic) > 200 {
		return CourseDraft{}, errs.BadRequest("topic 长度不能超过 200")
	}
	return CourseDraft{}, errs.ServiceUnavailable("AI course generation is not implemented in the experimental Go API")
}

// GenerateDegree validates the request but refuses to fabricate a draft until
// a real provider integration is available.
func (s *Service) GenerateDegree(_ context.Context, in GenerateDegreeInput) (DegreeDraft, error) {
	topic := strings.TrimSpace(in.Topic)
	if topic == "" {
		return DegreeDraft{}, errs.BadRequest("topic 不能为空")
	}
	if utf8.RuneCountInString(topic) > 200 {
		return DegreeDraft{}, errs.BadRequest("topic 长度不能超过 200")
	}
	return DegreeDraft{}, errs.ServiceUnavailable("AI degree generation is not implemented in the experimental Go API")
}

// ============================================================
// Mapping helpers
// ============================================================

func toConfigPublic(r db.AiConfig) ConfigPublic {
	plain, _ := decryptAPIKey(r.ApiKeyEnc)
	return ConfigPublic{
		ID:           r.ID,
		Provider:     r.Provider,
		Model:        r.Model,
		BaseURL:      nullableStringPtr(r.BaseUrl),
		IsActive:     r.IsActive,
		APIKeyMasked: maskAPIKey(plain),
		KeySet:       len(plain) > 0,
		CreatedAt:    r.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:    r.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
}

func toUserConfigPublic(r db.UserAiProviderConfig) UserConfigPublic {
	plain, _ := decryptAPIKey(r.ApiKeyEnc)
	return UserConfigPublic{
		ID:           r.ID,
		Provider:     r.Provider,
		Model:        r.Model,
		BaseURL:      nullableStringPtr(r.BaseUrl),
		IsActive:     r.IsActive,
		APIKeyMasked: maskAPIKey(plain),
		KeySet:       len(plain) > 0,
	}
}

func nullableStringPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

// maskAPIKey returns "****last4" for keys longer than 4, else "****".
// Empty plaintext → "" (caller renders KeySet=false to clients).
func maskAPIKey(plain string) string {
	if plain == "" {
		return ""
	}
	if utf8.RuneCountInString(plain) <= 4 {
		return "****"
	}
	runes := []rune(plain)
	return "****" + string(runes[len(runes)-4:])
}

// ============================================================
// Encryption. Production requires AES-256-GCM with AI_KEY_ENC_KEY.
// Development/test retain the legacy base64 fallback for fixture and e2e
// compatibility only.
// ============================================================

const (
	// stubPrefix marks the ciphertext as a stub-encrypted value. T21.1
	// will introduce a real versioned prefix (e.g. "v1:gcm:<b64>") so
	// we can migrate data without downtime.
	stubPrefix = "stub-b64:"

	// realPrefix marks a value encrypted with the real AES-256-GCM
	// path. The Go service uses real crypto when AI_KEY_ENC_KEY is set
	// (32 bytes hex/base64). Otherwise it falls back to the stub form.
	realPrefix = "v1:gcm:"
)

// ValidateEncryptionConfig checks the boot-time crypto policy. Production
// must provide exactly 32 bytes encoded as raw, hex, or standard base64.
func ValidateEncryptionConfig(env string) error {
	if !strings.EqualFold(strings.TrimSpace(env), "production") {
		return nil
	}
	_, err := parseEncKey(os.Getenv("AI_KEY_ENC_KEY"))
	if err != nil {
		return fmt.Errorf("AI_KEY_ENC_KEY is required in production and must decode to exactly 32 bytes: %w", err)
	}
	return nil
}

// encryptAPIKey uses real AES-GCM whenever a valid key is available.
// The reversible stub is permitted only outside production.
func encryptAPIKey(plain string) (string, error) {
	key, keyErr := parseEncKey(os.Getenv("AI_KEY_ENC_KEY"))
	if keyErr == nil {
		return encryptAESGCM(key, plain)
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("NODE_ENV")), "production") {
		return "", fmt.Errorf("AI_KEY_ENC_KEY is unavailable or invalid in production: %w", keyErr)
	}
	return stubPrefix + base64.StdEncoding.EncodeToString([]byte(plain)), nil
}

// decryptAPIKey reverses encryptAPIKey.
func decryptAPIKey(ciphertext string) (string, error) {
	if strings.HasPrefix(ciphertext, realPrefix) {
		if key := loadEncKey(); key != nil {
			return decryptAESGCM(key, strings.TrimPrefix(ciphertext, realPrefix))
		}
		// Real-prefixed ciphertext but no key configured → we can't
		// recover. Return empty + log so callers mask as "".
		return "", nil
	}
	if strings.HasPrefix(ciphertext, stubPrefix) {
		raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(ciphertext, stubPrefix))
		if err != nil {
			return "", err
		}
		return string(raw), nil
	}
	// Legacy / unrecognized: assume plaintext (defensive — never panic).
	return ciphertext, nil
}

// loadEncKey reads AI_KEY_ENC_KEY (32 raw bytes, base64, or hex) and
// returns the byte slice. Returns nil if the env is missing or invalid.
func loadEncKey() []byte {
	key, err := parseEncKey(os.Getenv("AI_KEY_ENC_KEY"))
	if err != nil {
		return nil
	}
	return key
}

func parseEncKey(v string) ([]byte, error) {
	if v == "" {
		return nil, errors.New("key is missing")
	}
	// Try base64 first.
	if k, err := base64.StdEncoding.DecodeString(v); err == nil && len(k) == 32 {
		return k, nil
	}
	// Then hex.
	if k, err := decodeHex(v); err == nil && len(k) == 32 {
		return k, nil
	}
	// Then raw 32-byte string.
	if len(v) == 32 {
		return []byte(v), nil
	}
	return nil, fmt.Errorf("decoded key length is not 32 bytes")
}

func decodeHex(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, fmt.Errorf("odd hex length")
	}
	out := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		hi, err := unhex(s[i])
		if err != nil {
			return nil, err
		}
		lo, err := unhex(s[i+1])
		if err != nil {
			return nil, err
		}
		out[i/2] = byte(hi<<4 | lo)
	}
	return out, nil
}

func unhex(c byte) (int, error) {
	switch {
	case '0' <= c && c <= '9':
		return int(c - '0'), nil
	case 'a' <= c && c <= 'f':
		return int(c-'a') + 10, nil
	case 'A' <= c && c <= 'F':
		return int(c-'A') + 10, nil
	}
	return 0, fmt.Errorf("invalid hex byte: %c", c)
}

func encryptAESGCM(key []byte, plain string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plain), nil)
	blob := append(nonce, ct...)
	return realPrefix + base64.StdEncoding.EncodeToString(blob), nil
}

func decryptAESGCM(key []byte, b64 string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce := raw[:gcm.NonceSize()]
	ct := raw[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

// ============================================================
// URL safety check (mirrors assertSafeAiBaseUrl in NestJS).
// ============================================================

// assertSafeUserBaseURL mirrors assertSafeAiBaseUrl in NestJS:
//   - http(s) only, no embedded credentials
//   - cloud providers require https
//   - non-ollama URLs must not point at private/loopback IPs
//   - ollama is allowed to point at localhost
func assertSafeUserBaseURL(provider, rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", errs.BadRequest("Base URL 格式无效")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", errs.BadRequest("Base URL 只支持 HTTP(S) 协议")
	}
	if u.User != nil {
		return "", errs.BadRequest("Base URL 不允许内嵌账号密码")
	}
	localOllama := provider == "ollama" && isLocalHost(u.Hostname())
	if !localOllama && u.Scheme != "https" {
		return "", errs.BadRequest("云端 AI 服务的 Base URL 必须使用 HTTPS")
	}
	if !localOllama && isPrivateOrLoopback(u.Hostname()) {
		return "", errs.BadRequest("Base URL 不允许指向本机或内网地址")
	}
	return strings.TrimRight(u.String(), "/"), nil
}

func isLocalHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(strings.TrimPrefix(host, "["), "]"))
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func isPrivateOrLoopback(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(strings.TrimPrefix(host, "["), "]"))
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
	}
	return false
}
