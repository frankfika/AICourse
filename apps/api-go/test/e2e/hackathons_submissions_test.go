// hackathons_submissions_test.go — e2e tests for the
// hackathons/submissions sub-resource. Phase 2 T19.1. Covers:
//
//   - 5 endpoints: GET my-list (auth), GET all (admin), POST create (auth),
//     PATCH update (auth owner), POST judge (admin).
//   - Auth gates (401/403), DB verification, ownership check, status
//     transitions, judge score write-back.
//
// Schema reminder: submissions HAS deleted_at (soft delete). status ENUM:
// 'draft'|'submitted'|'under_review'|'shortlisted'|'winner'|'rejected'.
// score is DECIMAL(5,2) — round-trip as string to avoid float drift.
package e2e

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestHackathonSubmissions_Unauthenticated(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-Unauth", "upcoming", 7*24*time.Hour, 14*24*time.Hour)

	for _, c := range []struct{ method, path string }{
		{"GET", "/api/v1/hackathons/" + id + "/submissions"},
		{"POST", "/api/v1/hackathons/" + id + "/submissions"},
		{"PATCH", "/api/v1/hackathons/" + id + "/submissions/" + uuid.NewString()},
		{"POST", "/api/v1/hackathons/" + id + "/submissions/" + uuid.NewString() + "/judge"},
		{"GET", "/api/v1/hackathons/" + id + "/submissions/all"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestHackathonSubmissions_CreateAndMine(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-CR", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, uid := env.registerStudent(t, "sub-cr")
	env.insertRegistrationDirect(t, uid, id)

	// Create a draft submission
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok, map[string]any{
		"title":       "My Cool App",
		"description": "It does cool things",
		"demoUrl":     "https://demo.example.com",
		"repoUrl":     "https://github.com/me/app",
		"videoUrl":    "https://youtu.be/abc",
		"status":      "draft",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var sub map[string]any
	require.NoError(t, json.Unmarshal(raw, &sub))
	subID := sub["id"].(string)
	require.Equal(t, "draft", sub["status"])
	require.Equal(t, "My Cool App", sub["title"])

	// DB verify
	var (
		dbStatus, dbTitle string
		demoURL           *string
	)
	require.NoError(t, env.db.QueryRow(
		`SELECT status, title, demo_url FROM submissions WHERE id = ?`, subID,
	).Scan(&dbStatus, &dbTitle, &demoURL))
	require.Equal(t, "draft", dbStatus)
	require.Equal(t, "My Cool App", dbTitle)
	require.NotNil(t, demoURL)
	require.Equal(t, "https://demo.example.com", *demoURL)

	// My list
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, subID, list[0]["id"])

	// Other user sees nothing
	tok2, _ := env.registerStudent(t, "sub-cr2")
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions", tok2, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "other user should not see this submission")
}

func TestHackathonSubmissions_Create_StatusValidation(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-Val", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, uid := env.registerStudent(t, "sub-val")
	env.insertRegistrationDirect(t, uid, id)

	// Missing title → 400
	status, _ := env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok, map[string]any{
		"description": "no title",
	})
	require.Equal(t, 400, status)

	// Not registered → 403
	tok2, _ := env.registerStudent(t, "sub-val2")
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok2, map[string]any{
		"title": "x", "description": "y",
	})
	require.Equal(t, 403, status)

	// Bad status → 400
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok, map[string]any{
		"title": "x", "description": "y", "status": "garbage",
	})
	require.Equal(t, 400, status)
}

func TestHackathonSubmissions_UpdateOwnerOnly(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-UO", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tokA, uidA := env.registerStudent(t, "sub-uo-a")
	tokB, uidB := env.registerStudent(t, "sub-uo-b")
	env.insertRegistrationDirect(t, uidA, id)
	env.insertRegistrationDirect(t, uidB, id)

	// A creates
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tokA, map[string]any{
		"title": "OwnerApp", "description": "x",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var sub map[string]any
	require.NoError(t, json.Unmarshal(raw, &sub))
	subID := sub["id"].(string)

	// B (other user) tries to update → 404 (NestJS: not found)
	status, raw = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/submissions/"+subID, tokB, map[string]any{
		"title": "Hacked",
	})
	require.Equal(t, 404, status, "non-owner update → 404 (matches NestJS)")

	// A updates
	status, raw = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/submissions/"+subID, tokA, map[string]any{
		"title":  "OwnerApp v2",
		"status": "submitted",
	})
	require.Equal(t, 200, status, "owner update: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &sub))
	require.Equal(t, "OwnerApp v2", sub["title"])
	require.Equal(t, "submitted", sub["status"])
	require.NotNil(t, sub["submittedAt"], "submittedAt should be set after draft→submitted transition")

	// Update bad status → 400
	status, _ = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/submissions/"+subID, tokA, map[string]any{
		"status": "garbage",
	})
	require.Equal(t, 400, status)
}

func TestHackathonSubmissions_AdminListAll(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-AL", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, uid := env.registerStudent(t, "sub-al")
	env.insertRegistrationDirect(t, uid, id)
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok, map[string]any{
		"title": "X", "description": "y",
	})

	// Student → 403
	status, _ := env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions/all", tok, nil)
	require.Equal(t, 403, status)

	// Admin → 200
	status, raw := env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions/all", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
}

func TestHackathonSubmissions_Judge(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-J", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tok, uid := env.registerStudent(t, "sub-j")
	env.insertRegistrationDirect(t, uid, id)
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tok, map[string]any{
		"title": "Judgeable", "description": "x", "status": "submitted",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var sub map[string]any
	require.NoError(t, json.Unmarshal(raw, &sub))
	subID := sub["id"].(string)

	// Student → 403
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions/"+subID+"/judge", tok, map[string]any{
		"score": 85.0,
	})
	require.Equal(t, 403, status)

	// Admin judges
	// NestJS JudgeSubmissionDto uses @IsInt, so fractional scores are not
	// part of the API contract even though MySQL stores the value as DECIMAL.
	score := 87
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions/"+subID+"/judge", env.adminTok, map[string]any{
		"score":    score,
		"feedback": "Strong entry",
		"status":   "shortlisted",
	})
	require.Equal(t, 200, status, "judge: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &sub))
	require.Equal(t, "shortlisted", sub["status"])
	require.Equal(t, "Strong entry", sub["feedback"])
	require.NotNil(t, sub["score"])
	require.Equal(t, "87.00", sub["score"], "DECIMAL(5,2) stored as '87.00'")

	// Bad score range → 400
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions/"+subID+"/judge", env.adminTok, map[string]any{
		"score": 150.0,
	})
	require.Equal(t, 400, status)

	// Judge non-existent submission → 404
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions/"+uuid.NewString()+"/judge", env.adminTok, map[string]any{
		"score": 80.0,
	})
	require.Equal(t, 404, status)
}

func TestHackathonSubmissions_TeamSubmission(t *testing.T) {
	env := setupHackathonEnv(t)
	id := env.insertHackathonDirect(t, "Subs-T", "upcoming", 7*24*time.Hour, 14*24*time.Hour)
	tokA, uidA := env.registerStudent(t, "sub-t-a")
	tokB, uidB := env.registerStudent(t, "sub-t-b")
	env.insertRegistrationDirect(t, uidA, id)
	env.insertRegistrationDirect(t, uidB, id)

	// A creates team
	status, raw := env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams", tokA, map[string]any{
		"name": "SubTeam",
	})
	require.Equal(t, 201, status, "create team: %s", string(raw))
	var team map[string]any
	require.NoError(t, json.Unmarshal(raw, &team))
	teamID := team["id"].(string)

	// B joins
	env.do(t, "POST", "/api/v1/hackathons/"+id+"/teams/"+teamID+"/join", tokB, nil)

	// A creates a team-owned submission
	status, raw = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tokA, map[string]any{
		"title": "TeamApp", "description": "team work",
		"teamId": teamID,
	})
	require.Equal(t, 201, status, "create team submission: %s", string(raw))
	var sub map[string]any
	require.NoError(t, json.Unmarshal(raw, &sub))
	subID := sub["id"].(string)
	require.Equal(t, teamID, sub["teamId"], "submission should be linked to the team")
	require.Nil(t, sub["userId"], "team submission has userId=NULL")

	// Both A and B see it in "my submissions"
	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions", tokA, nil)
	require.Equal(t, 200, status)
	var listA []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listA))
	require.Len(t, listA, 1, "captain sees team submission")
	require.Equal(t, subID, listA[0]["id"])

	status, raw = env.do(t, "GET", "/api/v1/hackathons/"+id+"/submissions", tokB, nil)
	require.Equal(t, 200, status)
	var listB []map[string]any
	require.NoError(t, json.Unmarshal(raw, &listB))
	require.Len(t, listB, 1, "team member sees team submission")
	require.Equal(t, subID, listB[0]["id"])

	// B (team member) can update the team submission
	status, raw = env.do(t, "PATCH", "/api/v1/hackathons/"+id+"/submissions/"+subID, tokB, map[string]any{
		"title": "TeamApp v2",
	})
	require.Equal(t, 200, status, "team member update: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &sub))
	require.Equal(t, "TeamApp v2", sub["title"])

	// Non-member cannot create a submission for this team
	tokC, uidC := env.registerStudent(t, "sub-t-c")
	env.insertRegistrationDirect(t, uidC, id)
	status, _ = env.do(t, "POST", "/api/v1/hackathons/"+id+"/submissions", tokC, map[string]any{
		"title": "Hijack", "description": "x", "teamId": teamID,
	})
	require.Equal(t, 403, status, "non-member cannot submit for this team")
}
