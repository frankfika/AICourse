// hackathons_sponsors_test.go — e2e tests for the hackathons/sponsors
// sub-resource. Phase 2 T19.1. Covers the 4 endpoints (1 public, 3 admin):
//
//	GET    /api/v1/hackathons/:id/sponsors             public list
//	POST   /api/v1/hackathons/:id/sponsors             admin add
//	PATCH  /api/v1/hackathons/:id/sponsors/:sponsorId  admin update
//	DELETE /api/v1/hackathons/:id/sponsors/:sponsorId  admin delete (hard)
//
// Schema reminder: sponsors has created_at + updated_at, NO deleted_at.
// tier is VARCHAR ('platinum'|'gold'|'silver'|'bronze'). Hard delete on
// the controller path (NestJS parity).
package e2e

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestHackathonSponsors_Unauthenticated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-Unauth", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons/" + id + "/sponsors"},
		{"PATCH", "/api/v1/hackathons/" + id + "/sponsors/" + uuid.NewString()},
		{"DELETE", "/api/v1/hackathons/" + id + "/sponsors/" + uuid.NewString()},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestHackathonSponsors_AdminGated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-AG", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, _ := env.registerStudent(t, "sponsor-ag")

	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons/" + id + "/sponsors"},
		{"PATCH", "/api/v1/hackathons/" + id + "/sponsors/" + uuid.NewString()},
		{"DELETE", "/api/v1/hackathons/" + id + "/sponsors/" + uuid.NewString()},
	} {
		status, _ := env.do(t, c.method, c.path, tok, map[string]any{"name": "x"})
		require.Equal(t, 403, status, "%s %s should 403", c.method, c.path)
	}
}

func TestHackathonSponsors_PublicList(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-List", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Empty
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/sponsors", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)

	// Add 3 (different tiers + orderIndex)
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "SilverCo", "tier": "silver", "orderIndex": 0,
	})
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "GoldCo", "tier": "gold", "orderIndex": 0,
	})
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "PlatinumCo", "tier": "platinum", "orderIndex": 0,
	})

	// List ordered by tier ASC: gold, platinum, silver (alphabetical)
	// NestJS: `orderBy: [{ tier: 'asc' }, { orderIndex: 'asc' }]`
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/sponsors", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3)
	require.Equal(t, "GoldCo", list[0]["name"])
	require.Equal(t, "PlatinumCo", list[1]["name"])
	require.Equal(t, "SilverCo", list[2]["name"])
}

func TestHackathonSponsors_CreateValidation(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-CV", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Missing name → 400
	status, _ := env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "",
	})
	require.Equal(t, 400, status)

	// Bad tier → 400
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "X", "tier": "diamond",
	})
	require.Equal(t, 400, status)

	// Hackathon not found → 404
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+uuid.NewString()+"/sponsors", env.adminTok, map[string]any{
		"name": "X",
	})
	require.Equal(t, 404, status)

	// Default tier applied
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "Default",
	})
	require.Equal(t, 201, status, "create with default tier: %s", string(raw))
	var sp map[string]any
	require.NoError(t, json.Unmarshal(raw, &sp))
	require.Equal(t, "silver", sp["tier"])
}

func TestHackathonSponsors_Update(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-U", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "Updatable", "tier": "bronze", "logoUrl": "https://old.example.com/logo.png",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var sp map[string]any
	require.NoError(t, json.Unmarshal(raw, &sp))
	sponsorID := sp["id"].(string)

	// Update
	orderIdx := int32(2)
	status, raw = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/sponsors/"+sponsorID, env.adminTok, map[string]any{
		"tier": "gold", "orderIndex": orderIdx, "websiteUrl": "https://new.example.com",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &sp))
	require.Equal(t, "gold", sp["tier"])
	require.Equal(t, "https://new.example.com", sp["websiteUrl"])
	require.Equal(t, float64(2), sp["orderIndex"])
	require.Equal(t, "https://old.example.com/logo.png", sp["logoUrl"], "logoUrl preserved when not patched")

	// Cross-hackathon update → 404
	otherID := env.insertHackathonDirect(t, "Other-Hack", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, _ = env.do(t, "PATCH", "/api/v1/hackathons/"+otherID+"/sponsors/"+sponsorID, env.adminTok, map[string]any{
		"tier": "platinum",
	})
	require.Equal(t, 404, status)

	// Bad tier → 400
	status, _ = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/sponsors/"+sponsorID, env.adminTok, map[string]any{
		"tier": "diamond",
	})
	require.Equal(t, 400, status)
}

func TestHackathonSponsors_Delete(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Sponsors-D", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/sponsors", env.adminTok, map[string]any{
		"name": "Removable", "tier": "gold",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var sp map[string]any
	require.NoError(t, json.Unmarshal(raw, &sp))
	sponsorID := sp["id"].(string)

	// Delete
	status, _ = env.do(t, "DELETE", "/api/v1/hackathons/"+id+"/sponsors/"+sponsorID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// DB verify
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM sponsors WHERE id = ?`, sponsorID).Scan(&n))
	require.Equal(t, 0, n, "sponsor should be hard-deleted")

	// Re-delete → 404
	status, _ = env.do(t, "DELETE", "/api/v1/hackathons/"+id+"/sponsors/"+sponsorID, env.adminTok, nil)
	require.Equal(t, 404, status)
}
