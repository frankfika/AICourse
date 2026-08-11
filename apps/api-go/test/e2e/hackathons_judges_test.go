// hackathons_judges_test.go — e2e tests for the hackathons/judges
// sub-resource. Phase 2 T19.1. Covers the 4 endpoints (1 public, 3 admin):
//
//	GET    /api/v1/hackathons/:id/judges            public list
//	POST   /api/v1/hackathons/:id/judges            admin add
//	PATCH  /api/v1/hackathons/:id/judges/:judgeId   admin update
//	DELETE /api/v1/hackathons/:id/judges/:judgeId   admin delete (hard)
//
// Schema reminder: judges has NO created_at, NO updated_at, NO deleted_at.
// role is VARCHAR ('judge'|'advisor'|'host'). Hard delete on the
// controller path (NestJS parity).
package e2e

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestHackathonJudges_Unauthenticated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-Unauth", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// POST / PATCH / DELETE need admin auth
	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons/" + id + "/judges"},
		{"PATCH", "/api/v1/hackathons/" + id + "/judges/" + uuid.NewString()},
		{"DELETE", "/api/v1/hackathons/" + id + "/judges/" + uuid.NewString()},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestHackathonJudges_AdminGated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-AG", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, _ := env.registerStudent(t, "judge-ag")

	// Student → 403
	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons/" + id + "/judges"},
		{"PATCH", "/api/v1/hackathons/" + id + "/judges/" + uuid.NewString()},
		{"DELETE", "/api/v1/hackathons/" + id + "/judges/" + uuid.NewString()},
	} {
		status, _ := env.do(t, c.method, c.path, tok, map[string]any{"name": "x"})
		require.Equal(t, 403, status, "%s %s should 403", c.method, c.path)
	}
}

func TestHackathonJudges_PublicList(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-List", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Empty
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/judges", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)

	// Add 2
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "Alice", "title": "CTO", "role": "judge", "orderIndex": 1,
	})
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "Bob", "title": "VP Eng", "role": "advisor", "orderIndex": 0,
	})

	// List ordered by orderIndex ASC → Bob first
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/judges", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 2)
	require.Equal(t, "Bob", list[0]["name"])
	require.Equal(t, "Alice", list[1]["name"])
}

func TestHackathonJudges_CreateValidation(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-CV", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Missing name → 400
	status, _ := env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "",
	})
	require.Equal(t, 400, status)

	// Bad role → 400
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "X", "role": "mentor",
	})
	require.Equal(t, 400, status)

	// Hackathon not found → 404
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+uuid.NewString()+"/judges", env.adminTok, map[string]any{
		"name": "X",
	})
	require.Equal(t, 404, status)

	// Default role applied
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "Default",
	})
	require.Equal(t, 201, status, "create with default role: %s", string(raw))
	var j map[string]any
	require.NoError(t, json.Unmarshal(raw, &j))
	require.Equal(t, "judge", j["role"])
}

func TestHackathonJudges_Update(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-U", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "Updatable", "title": "Eng",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var j map[string]any
	require.NoError(t, json.Unmarshal(raw, &j))
	judgeID := j["id"].(string)

	// Update
	orderIdx := int32(5)
	status, raw = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/judges/"+judgeID, env.adminTok, map[string]any{
		"title": "Senior Eng", "orderIndex": orderIdx, "role": "host",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &j))
	require.Equal(t, "Senior Eng", j["title"])
	require.Equal(t, "host", j["role"])
	require.Equal(t, float64(5), j["orderIndex"])

	// Cross-hackathon update → 404
	otherID := env.insertHackathonDirect(t, "Other-Hack", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, _ = env.do(t, "PATCH", "/api/v1/hackathons/"+otherID+"/judges/"+judgeID, env.adminTok, map[string]any{
		"title": "Hijack",
	})
	require.Equal(t, 404, status)

	// Bad role → 400
	status, _ = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/judges/"+judgeID, env.adminTok, map[string]any{
		"role": "mentor",
	})
	require.Equal(t, 400, status)
}

func TestHackathonJudges_Delete(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Judges-D", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/judges", env.adminTok, map[string]any{
		"name": "Removable",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var j map[string]any
	require.NoError(t, json.Unmarshal(raw, &j))
	judgeID := j["id"].(string)

	// Delete
	status, _ = env.do(t, "DELETE", "/api/v1/hackathons/"+id+"/judges/"+judgeID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// DB verify
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM judges WHERE id = ?`, judgeID).Scan(&n))
	require.Equal(t, 0, n, "judge should be hard-deleted")

	// Re-delete → 404
	status, _ = env.do(t, "DELETE", "/api/v1/hackathons/"+id+"/judges/"+judgeID, env.adminTok, nil)
	require.Equal(t, 404, status)
}
