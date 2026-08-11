// State / RelayState storage for OAuth2 PKCE and SAML SP-initiated flows.
//
// Both flows are 2-step: the start step generates a random opaque value
// (OAuth "state" / SAML "RelayState"), stores the in-flight context
// server-side, redirects the user to the IdP, and the callback step
// looks the value up. This file is the storage abstraction so the
// provider code stays decoupled from the backing store.
//
// The Redis-backed implementation is the production path; the
// in-memory implementation is for unit tests. They implement the same
// StateStore interface and the provider constructors take any
// implementation.
//
// Storage shape:
//
//	OAuth:   key "oauth:state:{state}"  → {provider, redirectAfter, codeVerifier}
//	SAML:    key "saml:relay:{state}"   → {provider, redirectAfter}
//
// Both expire after 10 minutes (the typical max user dwell time before
// the IdP redirects back). The Consume call is "one-shot" — successful
// lookup deletes the key so a replayed state / RelayState cannot
// succeed twice.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// OAuthStateTTL is the lifetime of an OAuth "state" / "code_verifier"
// pair in the state store. 10 minutes is well above the IdP round-trip
// latency observed in production and matches the TS source.
const OAuthStateTTL = 10 * time.Minute

// SAMLStateTTL is the lifetime of a SAML RelayState. Same rationale as
// OAuth: the user has 10 min to complete the IdP login + IdP-initiated
// back-channel push to the ACS endpoint.
const SAMLStateTTL = 10 * time.Minute

// ErrStateNotFound is returned by Consume when the state is missing or
// has already been consumed. The provider maps this to a 401.
var ErrStateNotFound = errors.New("auth: state not found or expired")

// OAuthState is the payload stored under the OAuth "state" key.
// The codeVerifier is the PKCE secret; redirectAfter is the post-login
// URL the client wants to land on.
type OAuthState struct {
	Provider      string `json:"provider"`
	RedirectAfter string `json:"redirectAfter"`
	CodeVerifier  string `json:"codeVerifier"`
	Nonce         string `json:"nonce,omitempty"`
	Flow          string `json:"flow"`
	UserID        string `json:"userId,omitempty"`
}

// SAMLState is the payload stored under the SAML "RelayState" key.
// Unlike OAuth there is no verifier (SAML doesn't do PKCE — the
// AuthnRequest is signed by the SP instead).
type SAMLState struct {
	Provider      string `json:"provider"`
	RedirectAfter string `json:"redirectAfter"`
	RequestID     string `json:"requestId,omitempty"`
	Flow          string `json:"flow"`
	UserID        string `json:"userId,omitempty"`
}

// StateStore is the abstract storage interface the providers use.
// One method per write/read pattern. Implementations must be safe for
// concurrent use.
type StateStore interface {
	// SaveOAuth persists the OAuth state for ttl.
	SaveOAuth(ctx context.Context, state string, payload OAuthState, ttl time.Duration) error
	// ConsumeOAuth atomically reads and deletes the OAuth state. The
	// delete-on-read is the CSRF defense: a state value can be used
	// exactly once.
	ConsumeOAuth(ctx context.Context, state string) (OAuthState, error)

	// SaveSAML persists the SAML RelayState for ttl.
	SaveSAML(ctx context.Context, relayState string, payload SAMLState, ttl time.Duration) error
	// ConsumeSAML atomically reads and deletes the SAML RelayState.
	ConsumeSAML(ctx context.Context, relayState string) (SAMLState, error)
}

// --- Redis implementation ----------------------------------------------------

// RedisStateStore is the production StateStore. Keys are namespaced by
// flow so OAuth and SAML collisions cannot occur.
type RedisStateStore struct {
	rdb    *redis.Client
	prefix string // for tests: per-test key prefix
}

// NewRedisStateStore builds a StateStore backed by a redis client. The
// keyPrefix lets tests isolate themselves from a shared Redis instance
// (e.g. CI's cluster).
func NewRedisStateStore(rdb *redis.Client, keyPrefix string) *RedisStateStore {
	if keyPrefix == "" {
		keyPrefix = "auth"
	}
	return &RedisStateStore{rdb: rdb, prefix: keyPrefix}
}

func (s *RedisStateStore) oauthKey(state string) string {
	return s.prefix + ":oauth:state:" + state
}

func (s *RedisStateStore) samlKey(relay string) string {
	return s.prefix + ":saml:relay:" + relay
}

func (s *RedisStateStore) SaveOAuth(ctx context.Context, state string, payload OAuthState, ttl time.Duration) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, s.oauthKey(state), b, ttl).Err()
}

func (s *RedisStateStore) ConsumeOAuth(ctx context.Context, state string) (OAuthState, error) {
	// Atomic: GET + DEL via Lua so a concurrent callback can't observe
	// the same state twice. The script returns the raw value or empty
	// if the key didn't exist.
	const lua = `
		local v = redis.call('GET', KEYS[1])
		if v == false then return '' end
		redis.call('DEL', KEYS[1])
		return v
	`
	res, err := s.rdb.Eval(ctx, lua, []string{s.oauthKey(state)}).Text()
	if err != nil {
		return OAuthState{}, err
	}
	if res == "" {
		return OAuthState{}, ErrStateNotFound
	}
	var p OAuthState
	if err := json.Unmarshal([]byte(res), &p); err != nil {
		return OAuthState{}, err
	}
	return p, nil
}

func (s *RedisStateStore) SaveSAML(ctx context.Context, relay string, payload SAMLState, ttl time.Duration) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, s.samlKey(relay), b, ttl).Err()
}

func (s *RedisStateStore) ConsumeSAML(ctx context.Context, relay string) (SAMLState, error) {
	const lua = `
		local v = redis.call('GET', KEYS[1])
		if v == false then return '' end
		redis.call('DEL', KEYS[1])
		return v
	`
	res, err := s.rdb.Eval(ctx, lua, []string{s.samlKey(relay)}).Text()
	if err != nil {
		return SAMLState{}, err
	}
	if res == "" {
		return SAMLState{}, ErrStateNotFound
	}
	var p SAMLState
	if err := json.Unmarshal([]byte(res), &p); err != nil {
		return SAMLState{}, err
	}
	return p, nil
}

// --- In-memory implementation (tests) ----------------------------------------

// MemoryStateStore is a thread-safe in-memory StateStore. The 0-cost
// path for unit tests that don't want to spin a Redis container.
type MemoryStateStore struct {
	mu    sync.Mutex
	oauth map[string]oauthMemoryEntry
	saml  map[string]samlMemoryEntry
	now   func() time.Time
}

type oauthMemoryEntry struct {
	payload  OAuthState
	expireAt time.Time
}

type samlMemoryEntry struct {
	payload  SAMLState
	expireAt time.Time
}

// NewMemoryStateStore returns an empty in-memory store. Pass nil to
// use time.Now; tests that need to fast-forward time can pass a custom
// clock via NewMemoryStateStoreWithClock.
func NewMemoryStateStore() *MemoryStateStore {
	return NewMemoryStateStoreWithClock(time.Now)
}

// NewMemoryStateStoreWithClock is the testable variant.
func NewMemoryStateStoreWithClock(now func() time.Time) *MemoryStateStore {
	return &MemoryStateStore{
		oauth: make(map[string]oauthMemoryEntry),
		saml:  make(map[string]samlMemoryEntry),
		now:   now,
	}
}

func (s *MemoryStateStore) SaveOAuth(_ context.Context, state string, payload OAuthState, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.oauth[state] = oauthMemoryEntry{payload: payload, expireAt: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStateStore) ConsumeOAuth(_ context.Context, state string) (OAuthState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.oauth[state]
	if !ok {
		return OAuthState{}, ErrStateNotFound
	}
	delete(s.oauth, state)
	if s.now().After(e.expireAt) {
		return OAuthState{}, ErrStateNotFound
	}
	return e.payload, nil
}

func (s *MemoryStateStore) SaveSAML(_ context.Context, relay string, payload SAMLState, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.saml[relay] = samlMemoryEntry{payload: payload, expireAt: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStateStore) ConsumeSAML(_ context.Context, relay string) (SAMLState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.saml[relay]
	if !ok {
		return SAMLState{}, ErrStateNotFound
	}
	delete(s.saml, relay)
	if s.now().After(e.expireAt) {
		return SAMLState{}, ErrStateNotFound
	}
	return e.payload, nil
}

// --- helpers ----------------------------------------------------------------

// GenerateRandomState returns 32 random bytes encoded as base64url
// (no padding). 32 bytes / 256 bits is the same strength the SAML POC
// uses for AuthnRequest IDs.
func GenerateRandomState() (string, error) {
	return generateRandomBase64URL(32)
}

// GenerateCodeVerifier returns a high-entropy PKCE code_verifier (43
// chars base64url). The OAuth2 RFC 7636 §4.1 specifies 43-128 chars
// from the unreserved set; 43 (32 random bytes base64url-no-pad) is
// the minimum that satisfies the security requirement.
func GenerateCodeVerifier() (string, error) {
	return generateRandomBase64URL(32)
}

func generateRandomBase64URL(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
