package hackathons

import (
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/stretchr/testify/require"
)

func TestEffectiveStatusUsesDatesForNonEditorialStates(t *testing.T) {
	now := time.Date(2026, 8, 12, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name   string
		status db.HackathonsStatus
		start  time.Time
		end    time.Time
		want   db.HackathonsStatus
	}{
		{"upcoming before start", db.HackathonsStatusUpcoming, now.Add(time.Hour), now.Add(2 * time.Hour), db.HackathonsStatusUpcoming},
		{"persisted upcoming is now active", db.HackathonsStatusUpcoming, now.Add(-time.Hour), now.Add(time.Hour), db.HackathonsStatusActive},
		{"persisted active is now judging", db.HackathonsStatusActive, now.Add(-2 * time.Hour), now.Add(-time.Hour), db.HackathonsStatusJudging},
		{"editorial finished is preserved", db.HackathonsStatusFinished, now.Add(time.Hour), now.Add(2 * time.Hour), db.HackathonsStatusFinished},
		{"editorial cancelled is preserved", db.HackathonsStatusCancelled, now.Add(-time.Hour), now.Add(time.Hour), db.HackathonsStatusCancelled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := db.Hackathon{Status: tt.status, StartDate: tt.start, EndDate: tt.end}
			require.Equal(t, tt.want, effectiveStatus(h, now))
		})
	}
}

func TestValidateOptionalHTTPURL(t *testing.T) {
	require.NoError(t, validateOptionalHTTPURL("demoUrl", ""))
	require.NoError(t, validateOptionalHTTPURL("demoUrl", "https://example.com/demo?q=1"))
	require.Error(t, validateOptionalHTTPURL("demoUrl", "javascript:alert(1)"))
	require.Error(t, validateOptionalHTTPURL("demoUrl", "//example.com/path"))
	require.Error(t, validateOptionalHTTPURL("demoUrl", "https://"))
}

func TestHackathonListResponseContract(t *testing.T) {
	now := time.Date(2026, 8, 12, 12, 0, 0, 0, time.UTC)
	checkedInAt := now.Add(time.Hour)
	row := db.ListHackathonResponseRowsRow{
		ID: "hackathon-1", Title: "AI Sprint", Description: "Build it",
		Status: db.HackathonsStatusActive, StartDate: now.Add(-time.Hour), EndDate: now.Add(24 * time.Hour),
		MaxTeamSize: 5, MinTeamSize: 1, CreatedAt: now, UpdatedAt: now,
		OrganizerUserID:   sql.NullString{String: "organizer-1", Valid: true},
		OrganizerName:     sql.NullString{String: "Organizer", Valid: true},
		RegistrationCount: 12, TeamCount: 4, SubmissionCount: 3,
		MyRegistrationID:     sql.NullString{String: "registration-1", Valid: true},
		MyRegistrationUserID: sql.NullString{String: "user-1", Valid: true},
		MyRegistrationStatus: db.NullHackathonRegistrationsStatus{
			HackathonRegistrationsStatus: db.HackathonRegistrationsStatusRegistered,
			Valid:                        true,
		},
		MyRegistrationRegisteredAt: sql.NullTime{Time: now, Valid: true},
		MyRegistrationCheckedInAt:  sql.NullTime{Time: checkedInAt, Valid: true},
	}

	h := hackathonFromListRow(row)
	dto := toHackathonDTO(h, effectiveStatus(h, now))
	decorateHackathonDTO(&dto, responseRelations{
		organizerID: row.OrganizerUserID, organizerName: row.OrganizerName,
		registrationCount: row.RegistrationCount, teamCount: row.TeamCount, submissionCount: row.SubmissionCount,
		myRegistrationID: row.MyRegistrationID, myRegistrationUserID: row.MyRegistrationUserID,
		myRegistrationStatus: row.MyRegistrationStatus, myRegisteredAt: row.MyRegistrationRegisteredAt,
		myCheckedInAt: row.MyRegistrationCheckedInAt,
	})

	payload, err := json.Marshal(dto)
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, json.Unmarshal(payload, &body))
	require.Equal(t, "organizer-1", body["organizer"].(map[string]any)["id"])
	require.Equal(t, float64(12), body["_count"].(map[string]any)["registrations"])
	require.Equal(t, float64(4), body["_count"].(map[string]any)["teams"])
	require.Equal(t, float64(3), body["_count"].(map[string]any)["submissions"])
	require.Equal(t, "registered", body["myRegistration"].(map[string]any)["status"])
	require.Equal(t, checkedInAt.Format(time.RFC3339), body["myRegistration"].(map[string]any)["checkedInAt"])
	require.NotContains(t, body, "judges", "list responses must not pay the detail-only judges cost")
}

func TestHackathonAnonymousAndDetailJSONContract(t *testing.T) {
	now := time.Date(2026, 8, 12, 12, 0, 0, 0, time.UTC)
	dto := toHackathonDTO(db.Hackathon{
		ID: "hackathon-1", Title: "AI Sprint", Description: "Build it",
		Status: db.HackathonsStatusActive, StartDate: now, EndDate: now.Add(time.Hour),
		MaxTeamSize: 5, MinTeamSize: 1, CreatedAt: now, UpdatedAt: now,
	}, db.HackathonsStatusActive)
	decorateHackathonDTO(&dto, responseRelations{})
	judges := []JudgeDTO{}
	dto.Judges = &judges

	payload, err := json.Marshal(dto)
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, json.Unmarshal(payload, &body))
	require.Nil(t, body["organizer"])
	require.Nil(t, body["myRegistration"])
	require.Equal(t, []any{}, body["judges"])
	require.Equal(t, float64(0), body["_count"].(map[string]any)["registrations"])
}
