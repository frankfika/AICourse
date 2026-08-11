package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHealthz_PingsDB verifies /healthz actually exercises the DB layer
// (not just returns a hardcoded "ok"). Phase 0 quality bar: health endpoint
// must reflect the dependency state.
func TestHealthz_PingsDB(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	resp, err := testApp.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))
	assert.Equal(t, "ok", body["status"])
}

// TestReadyz_PingsDB verifies /readyz returns 200 only when MySQL is reachable.
func TestReadyz_PingsDB(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	resp, err := testApp.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// TestUsers_CRUD_HappyPath exercises the placeholder user endpoint to
// validate the integration harness end-to-end. Phase 1 will replace this
// with auth/login → token issuance.
func TestUsers_CRUD_HappyPath(t *testing.T) {
	t.Parallel()
	email := fmt.Sprintf("user-%s@example.com", "happy")

	// 1. Create
	createBody := []byte(fmt.Sprintf(`{"email":%q,"displayName":"Happy Path"}`, email))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/test/users", bytes.NewReader(createBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := testApp.Test(req, -1)
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode, "POST /test/users body: %s", string(raw))

	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	assert.Equal(t, email, created["email"])
	assert.NotEmpty(t, created["id"])

	// 2. Read back
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/test/users?email="+email, nil)
	getResp, err := testApp.Test(getReq, -1)
	require.NoError(t, err)
	raw, _ = io.ReadAll(getResp.Body)
	getResp.Body.Close()
	assert.Equal(t, http.StatusOK, getResp.StatusCode, "GET body: %s", string(raw))

	var got map[string]any
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, email, got["email"])
	assert.Equal(t, "Happy Path", got["displayName"])
}

// TestUsers_GetMissing_NotFoundEnvelope asserts the canonical 404 envelope.
func TestUsers_GetMissing_NotFoundEnvelope(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test/users?email=missing@example.com", nil)
	resp, err := testApp.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	env := decodeEnvelope(t, raw)
	assert.Equal(t, http.StatusNotFound, env.StatusCode)
	assert.Equal(t, "NOT_FOUND", env.Error)
}

// TestUsers_PostMissingEmail_BadRequestEnvelope asserts the canonical 400 envelope.
func TestUsers_PostMissingEmail_BadRequestEnvelope(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/test/users",
		bytes.NewReader([]byte(`{"displayName":"x"}`)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := testApp.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	env := decodeEnvelope(t, raw)
	assert.Equal(t, http.StatusBadRequest, env.StatusCode)
	assert.Equal(t, "BAD_REQUEST", env.Error)
}

// decodeEnvelope mirrors the helper in test/e2e/setup_test.go.
// We duplicate rather than import to keep the two packages independent —
// the e2e package and the integration package will diverge as features land.
func decodeEnvelope(t *testing.T, raw []byte) struct {
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	Error      string `json:"error"`
	Timestamp  string `json:"timestamp"`
	Path       string `json:"path"`
	RequestID  string `json:"requestId"`
} {
	t.Helper()
	var env struct {
		StatusCode int    `json:"statusCode"`
		Message    string `json:"message"`
		Error      string `json:"error"`
		Timestamp  string `json:"timestamp"`
		Path       string `json:"path"`
		RequestID  string `json:"requestId"`
	}
	require.NoError(t, json.Unmarshal(raw, &env), "envelope parse failed: %s", string(raw))
	return env
}
