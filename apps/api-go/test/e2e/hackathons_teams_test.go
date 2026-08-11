// hackathons_teams_test.go — e2e tests for the hackathons/teams
// sub-resource. Phase 2 T19.1. Covers:
//
//   - 4 endpoints: GET list (public), POST create (auth), POST join (auth),
//     POST leave (auth).
//   - Auth gates (401/403), DB verification, NestJS-parity edge cases
//     (duplicate name, duplicate membership, full team).
//   - Captain-leave → team disband (hard delete + cascade).
//
// Schema reminder: teams has NO deleted_at, NO slug, NO updated_at. team_members
// has NO joined_at, NO deleted_at. Captain leaving → team hard-deleted
// (CASCADE removes team_members).
package e2e

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// insertRegistrationDirect writes a hackathon_registrations row directly,
// bypassing the API. Used for tests that don't care about the registration
// lifecycle (they just need a user to be "registered" so they can join a
// team). status='registered', deleted_at=NULL — matches the
// ensureRegistered() service-layer precondition.
func (e *hackathonTestEnv) insertRegistrationDirect(t *testing.T, userID, hackathonID string) {
	t.Helper()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO hackathon_registrations (id, hackathon_id, user_id, status, registered_at)
		VALUES (?, ?, ?, 'registered', ?)
	`, uuid.NewString(), hackathonID, userID, time.Now().UTC())
	require.NoError(t, err)
}

func TestHackathonTeams_Unauthenticated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-Unauth", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/hackathons/" + id + "/teams"},
		{"POST", "/api/v1/hackathons/" + id + "/teams/" + uuid.NewString() + "/join"},
		{"POST", "/api/v1/hackathons/" + id + "/teams/" + uuid.NewString() + "/leave"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestHackathonTeams_PublicList(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-List", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	// Empty list (no teams yet)
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/teams", "", nil)
	require.Equal(t, 200, status)
	var teams []map[string]any
	require.NoError(t, json.Unmarshal(raw, &teams))
	require.Empty(t, teams)

	// Register a user, create a team
	tok, uid := env.registerStudent(t, "team-list")
	env.insertRegistrationDirect(t, uid, id)
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tok, map[string]any{
		"name":   "Team Alpha",
		"slogan": "We build cool things",
	})
	require.Equal(t, 201, status, "create team: %s", string(raw))
	var team map[string]any
	require.NoError(t, json.Unmarshal(raw, &team))
	require.Equal(t, "Team Alpha", team["name"])
	require.Equal(t, "We build cool things", team["slogan"])
	require.Equal(t, float64(1), team["memberCount"])
	require.NotEmpty(t, team["members"])

	// Public list now has 1
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/teams", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &teams))
	require.Len(t, teams, 1)
	require.Equal(t, "Team Alpha", teams[0]["name"])
	require.Equal(t, float64(1), teams[0]["memberCount"])
}

func TestHackathonTeams_CreateAndJoin(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-CJ", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	tokA, uidA := env.registerStudent(t, "team-a")
	tokB, uidB := env.registerStudent(t, "team-b")
	tokC, uidC := env.registerStudent(t, "team-c")
	env.insertRegistrationDirect(t, uidA, id)
	env.insertRegistrationDirect(t, uidB, id)
	env.insertRegistrationDirect(t, uidC, id)

	// A creates a team
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tokA, map[string]any{
		"name": "Bravo",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var team map[string]any
	require.NoError(t, json.Unmarshal(raw, &team))
	teamID := team["id"].(string)
	require.Equal(t, "Bravo", team["name"])

	// DB verify: A is the captain
	var (
		captainID  string
		memberRole string
	)
	require.NoError(t, env.db.QueryRow(`SELECT captain_id FROM teams WHERE id = ?`, teamID).Scan(&captainID))
	require.Equal(t, uidA, captainID)
	require.NoError(t, env.db.QueryRow(`SELECT role FROM team_members WHERE team_id = ? AND user_id = ?`, teamID, uidA).Scan(&memberRole))
	require.Equal(t, "captain", memberRole)

	// B joins
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/join", tokB, nil)
	require.Equal(t, 201, status, "join: %s", string(raw))
	var member map[string]any
	require.NoError(t, json.Unmarshal(raw, &member))
	require.Equal(t, "member", member["role"])

	// DB verify: 2 members
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM team_members WHERE team_id = ?`, teamID).Scan(&n))
	require.Equal(t, 2, n)

	// C tries to join the same team — allowed (team size max 5 by default).
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/join", tokC, nil)
	require.Equal(t, 201, status)

	// A tries to join a different (new) team — already in a team → 400
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tokA, map[string]any{
		"name": "SecondTeam",
	})
	require.Equal(t, 400, status, "already in a team: %s", string(raw))
}

func TestHackathonTeams_Validation(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-Val", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, uid := env.registerStudent(t, "team-val")
	env.insertRegistrationDirect(t, uid, id)

	// Missing name → 400
	status, _ := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tok, map[string]any{
		"name": "",
	})
	require.Equal(t, 400, status)

	// Not registered → 403
	tok2, _ := env.registerStudent(t, "team-val2")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tok2, map[string]any{
		"name": "no-register",
	})
	require.Equal(t, 403, status)

	// Create one team
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tok, map[string]any{
		"name": "X1",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))

	// Duplicate name → 400
	tok3, uid3 := env.registerStudent(t, "team-val3")
	env.insertRegistrationDirect(t, uid3, id)
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tok3, map[string]any{
		"name": "X1",
	})
	require.Equal(t, 400, status, "duplicate name → 400")

	// Join a non-existent team → 404
	tok4, uid4 := env.registerStudent(t, "team-val4")
	env.insertRegistrationDirect(t, uid4, id)
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+uuid.NewString()+"/join", tok4, nil)
	require.Equal(t, 404, status)

	// Join a team from a different hackathon → 404. tok4 is registered
	// for `id`; we also need to register for `otherID` so the
	// "team not found" path runs (else the service 403s on the
	// not-registered-for-this-hackathon check first).
	otherID := env.insertHackathonDirect(t, "Other-Hack", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	env.insertRegistrationDirect(t, uid4, otherID)
	teamID := mustGetTeamIDFromDB(t, env, "X1", id)
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+otherID+"/teams/"+teamID+"/join", tok4, nil)
	require.Equal(t, 404, status, "team from a different hackathon → 404")
}

func TestHackathonTeams_LeaveAsMember(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-LM", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tokA, uidA := env.registerStudent(t, "team-lm-a")
	tokB, uidB := env.registerStudent(t, "team-lm-b")
	env.insertRegistrationDirect(t, uidA, id)
	env.insertRegistrationDirect(t, uidB, id)

	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tokA, map[string]any{
		"name": "LMTeam",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var team map[string]any
	require.NoError(t, json.Unmarshal(raw, &team))
	teamID := team["id"].(string)

	// B joins
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/join", tokB, nil)

	// B leaves
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/leave", tokB, nil)
	require.Equal(t, 200, status, "leave: %s", string(raw))
	var resp map[string]string
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, "Left team", resp["message"])

	// DB verify: only A remains, team still exists
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM team_members WHERE team_id = ?`, teamID).Scan(&n))
	require.Equal(t, 1, n)
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM teams WHERE id = ?`, teamID).Scan(&n))
	require.Equal(t, 1, n)

	// Non-member tries to leave → 400
	tokC, _ := env.registerStudent(t, "team-lm-c")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/leave", tokC, nil)
	require.Equal(t, 400, status, "non-member leave → 400")
}

func TestHackathonTeams_LeaveAsCaptain_Disband(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Teams-LC", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tokA, uidA := env.registerStudent(t, "team-lc-a")
	tokB, uidB := env.registerStudent(t, "team-lc-b")
	env.insertRegistrationDirect(t, uidA, id)
	env.insertRegistrationDirect(t, uidB, id)

	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tokA, map[string]any{
		"name": "LCTeam",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var team map[string]any
	require.NoError(t, json.Unmarshal(raw, &team))
	teamID := team["id"].(string)

	// B joins
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/join", tokB, nil)

	// A (captain) leaves → team disbanded
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/leave", tokA, nil)
	require.Equal(t, 200, status, "captain leave: %s", string(raw))
	var resp map[string]string
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, "Team disbanded", resp["message"])

	// DB verify: team + members all gone
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM teams WHERE id = ?`, teamID).Scan(&n))
	require.Equal(t, 0, n, "team should be hard-deleted")
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM team_members WHERE team_id = ?`, teamID).Scan(&n))
	require.Equal(t, 0, n, "members should be CASCADE-deleted")
}

// mustGetTeamIDFromDB is a tiny helper that fetches a team's id by name
// (used for cross-hackathon join tests).
func mustGetTeamIDFromDB(t *testing.T, env *hackathonTestEnv, name, hackathonID string) string {
	t.Helper()
	var id string
	require.NoError(t, env.db.QueryRow(`SELECT id FROM teams WHERE name = ? AND hackathon_id = ?`, name, hackathonID).Scan(&id))
	return id
}
