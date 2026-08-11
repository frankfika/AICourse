// Package e2e — learning_events module end-to-end test.
//
// Phase 2 T15-2: covers the 4 /api/v1/learning-events/* endpoints.
//
//	POST /learning-events                   create one (auth required)
//	POST /learning-events/batch             create many (auth required)
//	GET  /learning-events/me                list mine (auth required)
//	GET  /learning-events/lesson/:lessonId  admin/instructor list
//
// Mirrors apps/api/src/modules/learning-events/learning-events.controller.ts.
package e2e

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/learningevents"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type learningEventsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
	instTok  string // instructor token (also allowed on /lesson/:id)
	instID   string
	adminID  string
}

// setupLearningEventsEnv spins up a fresh dockertest MySQL, applies the
// shared 0001_init.sql schema, mounts the auth + learning_events
// handlers, and seeds one admin and one instructor (via insertUserDirect
// — see auth_test.go / courses_test.go for the convention). The student
// in each test is created via /auth/register so we exercise the public
// sign-up path.
func setupLearningEventsEnv(t *testing.T) *learningEventsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")
	// dockertest's default MaxWait is 60s; bump to 300s so a transient
	// host-load spike (load avg 4-15 on this dev box) does not flake
	// the MySQL container boot. (Hard requirement per Phase 2 T23
	// lesson, mirrored from cms_test.go.)
	pool.MaxWait = 300 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_le_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "dockertest run mysql")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_le_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}))

	applySchema(t, db)

	cfg, err := config.Load()
	require.NoError(t, err)
	cfg.DatabaseURL = dsn
	cfg.JWTSecret = "f8e7d6c5b4a39281ffeeddccbbaa99887766554433221100aabbccddeeff0011"
	cfg.Env = "test"

	log, err := logger.New("test")
	require.NoError(t, err)

	authRepo := auth.NewAuthRepo(db)
	authCfg, err := auth.LoadAuthConfig()
	require.NoError(t, err)
	authSvc, err := auth.BuildService(authCfg, authRepo)
	require.NoError(t, err)
	tokens := auth.NewJWTTokenIssuer([]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL)

	authH := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env: cfg.Env, AccessTokenTTL: auth.TokenTTL, RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)

	// Seed admin + instructor via direct insert (loginAs takes email, not
	// userID — courses_test.go::loginAs pattern). Both roles are
	// permitted on /learning-events/lesson/:lessonId per the handler's
	// RequireRole("admin", "instructor").
	adminEmail := makeEmail("le-admin")
	adminID := insertUserDirect(t, db, adminEmail, "Admin LE", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	instEmail := makeEmail("le-inst")
	instID := insertUserDirect(t, db, instEmail, "Instructor LE", "instructor", "Str0ngP@ssw0rd!!")
	instTok, _ := loginAs(t, db, cfg, instEmail, "Str0ngP@ssw0rd!!")

	leRepo := learningevents.NewRepo(db)
	leSvc := learningevents.NewService(leRepo, log)
	leH := handler.NewLearningEventsHandler(leSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-le",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	leH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &learningEventsTestEnv{
		app: app, db: db, log: log,
		adminTok: adminTok, adminID: adminID,
		instTok: instTok, instID: instID,
	}
}

func (e *learningEventsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if raw != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authHeader != "" {
		req.Header.Set("Authorization", "Bearer "+authHeader)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, b
}

// registerStudent is a convenience wrapper around the public
// /api/v1/auth/register endpoint. Mirrors notes_test.go::registerStudent.
func (e *learningEventsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"email": email, "password": "Str0ngP@ssw0rd!!", "name": "Student",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "register: %s", string(b))
	var out struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken, out.User.ID
}

// insertLesson creates a course → chapter → lesson chain so that the
// /learning-events/lesson/:lessonId endpoint has a real FK target.
// Returns (lessonID, courseID).
func (e *learningEventsTestEnv) insertLesson(t *testing.T) (string, string) {
	t.Helper()
	now := time.Now().UTC()
	courseID := uuid.NewString()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, 'Test', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)
	`, courseID, now, now)
	require.NoError(t, err)
	chapterID := uuid.NewString()
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO chapters (id, course_id, title, description, order_index, created_at)
		VALUES (?, ?, 'Ch 1', 'x', 0, ?)
	`, chapterID, courseID, now)
	require.NoError(t, err)
	lessonID := uuid.NewString()
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO lessons (id, chapter_id, title, description, order_index, is_preview, created_at)
		VALUES (?, ?, 'L1', 'x', 0, 0, ?)
	`, lessonID, chapterID, now)
	require.NoError(t, err)
	return lessonID, courseID
}

// ============ TESTS ============

// TestLearningEvents_Unauthenticated_401 — every route must reject a
// caller without a Bearer token. Per the handler, POST / and /batch
// and GET /me sit behind RequireAuth; GET /lesson/:lessonId is behind
// RequireAuth + RequireRole(admin, instructor) so missing auth also
// 401s (RequireAuth runs first and short-circuits before the role
// check).
func TestLearningEvents_Unauthenticated_401(t *testing.T) {
	env := setupLearningEventsEnv(t)
	lessonID, _ := env.insertLesson(t)

	status, _ := env.do(t, "POST", "/api/v1/learning-events/", "", map[string]any{
		"eventType": "play",
	})
	require.Equal(t, 401, status, "POST /learning-events/ without token must 401")

	status, _ = env.do(t, "POST", "/api/v1/learning-events/batch", "", map[string]any{
		"events": []map[string]any{{"eventType": "play"}},
	})
	require.Equal(t, 401, status, "POST /learning-events/batch without token must 401")

	status, _ = env.do(t, "GET", "/api/v1/learning-events/me", "", nil)
	require.Equal(t, 401, status, "GET /learning-events/me without token must 401")

	status, _ = env.do(t, "GET", "/api/v1/learning-events/lesson/"+lessonID, "", nil)
	require.Equal(t, 401, status, "GET /learning-events/lesson/:id without token must 401")
}

// TestLearningEvents_CreateOne_And_ListMine — the happy path for the
// create+read self flow. Verifies:
//   - POST returns 201 with the persisted event wrapped under "event".
//   - The DTO echoes back eventType, lessonId and the optional
//     positionSec (counter fields use *int32 so we can round-trip 120
//     without coercion).
//   - GET /me returns the just-created event for the same user.
func TestLearningEvents_CreateOne_And_ListMine(t *testing.T) {
	env := setupLearningEventsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("le-create"))
	lessonID, _ := env.insertLesson(t)

	// Create one
	status, raw := env.do(t, "POST", "/api/v1/learning-events/", tok, map[string]any{
		"eventType":   "play",
		"lessonId":    lessonID,
		"positionSec": 120,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var resp struct {
		Event struct {
			ID          string  `json:"id"`
			EventType   string  `json:"eventType"`
			LessonID    *string `json:"lessonId"`
			PositionSec *int32  `json:"positionSec"`
		} `json:"event"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.NotEmpty(t, resp.Event.ID, "id must be assigned")
	require.Equal(t, "play", resp.Event.EventType)
	require.NotNil(t, resp.Event.LessonID, "lessonId should be echoed back")
	require.Equal(t, lessonID, *resp.Event.LessonID)
	require.NotNil(t, resp.Event.PositionSec, "positionSec should round-trip")
	require.Equal(t, int32(120), *resp.Event.PositionSec)

	// Read mine — must see the new event.
	status, raw = env.do(t, "GET", "/api/v1/learning-events/me", tok, nil)
	require.Equal(t, 200, status, "list me: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "user A should see exactly their 1 event")
	first := list[0]
	require.Equal(t, "play", first["eventType"])
	require.Equal(t, lessonID, first["lessonId"])
}

// TestLearningEvents_CreateOne_InvalidEventType_400 — the service
// rejects anything not in {play, pause, seek, complete, replay, skip,
// note}. We send "bogus" and expect 400 from BadRequest.
func TestLearningEvents_CreateOne_InvalidEventType_400(t *testing.T) {
	env := setupLearningEventsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("le-badtype"))

	status, raw := env.do(t, "POST", "/api/v1/learning-events/", tok, map[string]any{
		"eventType": "bogus",
	})
	require.Equal(t, 400, status, "bad eventType: %s", string(raw))
}

// TestLearningEvents_BatchCreate_AtLeast2 — batch must accept multiple
// events, persist them, and report the inserted count. We send 3
// (above the required minimum of 2) covering distinct eventType values
// to also exercise the per-row validation in CreateBatch.
func TestLearningEvents_BatchCreate_AtLeast2(t *testing.T) {
	env := setupLearningEventsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("le-batch"))
	lessonID, _ := env.insertLesson(t)

	status, raw := env.do(t, "POST", "/api/v1/learning-events/batch", tok, map[string]any{
		"events": []map[string]any{
			{"eventType": "play", "lessonId": lessonID, "positionSec": 0},
			{"eventType": "pause", "lessonId": lessonID, "positionSec": 30},
			{"eventType": "complete", "lessonId": lessonID, "positionSec": 60},
		},
	})
	require.Equal(t, 201, status, "batch: %s", string(raw))
	var resp struct {
		Count int `json:"count"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 3, resp.Count)

	// Confirm in DB
	var n int
	require.NoError(t, env.db.QueryRow(`SELECT COUNT(*) FROM learning_events WHERE lesson_id = ?`, lessonID).Scan(&n))
	require.Equal(t, 3, n)

	// And the user can read them back via /me.
	status, raw = env.do(t, "GET", "/api/v1/learning-events/me", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 3, "/me should expose the 3 batch-inserted events")
}

// TestLearningEvents_CrossUserIsolation — ListMine must scope to the
// calling user. Two students, both write events to the same lesson,
// and /me on each side must return only their own (not the other
// user's, not a merged list). Verifies both count and userId per row.
func TestLearningEvents_CrossUserIsolation(t *testing.T) {
	env := setupLearningEventsEnv(t)
	tokA, idA := env.registerStudent(t, makeEmail("le-iso-a"))
	tokB, idB := env.registerStudent(t, makeEmail("le-iso-b"))
	lessonID, _ := env.insertLesson(t)
	require.NotEqual(t, idA, idB, "register must yield distinct user ids")

	// A posts 2 events
	for i := 0; i < 2; i++ {
		status, _ := env.do(t, "POST", "/api/v1/learning-events/", tokA, map[string]any{
			"eventType":   "play",
			"lessonId":    lessonID,
			"positionSec": i * 10,
		})
		require.Equal(t, 201, status)
	}

	// B posts 3 events
	for i := 0; i < 3; i++ {
		status, _ := env.do(t, "POST", "/api/v1/learning-events/", tokB, map[string]any{
			"eventType":   "play",
			"lessonId":    lessonID,
			"positionSec": i * 10,
		})
		require.Equal(t, 201, status)
	}

	// A reads /me — only 2 events, all owned by A.
	status, rawA := env.do(t, "GET", "/api/v1/learning-events/me", tokA, nil)
	require.Equal(t, 200, status)
	var listA []map[string]any
	require.NoError(t, json.Unmarshal(rawA, &listA))
	require.Len(t, listA, 2, "user A must see only their own 2 events")
	for _, e := range listA {
		require.Equal(t, idA, e["userId"], "every row in A's /me must be authored by A")
	}

	// B reads /me — only 3 events, all owned by B.
	status, rawB := env.do(t, "GET", "/api/v1/learning-events/me", tokB, nil)
	require.Equal(t, 200, status)
	var listB []map[string]any
	require.NoError(t, json.Unmarshal(rawB, &listB))
	require.Len(t, listB, 3, "user B must see only their own 3 events")
	for _, e := range listB {
		require.Equal(t, idB, e["userId"], "every row in B's /me must be authored by B")
	}
}

// TestLearningEvents_ListByLesson_RoleGate — admin and instructor can
// read the lesson-scoped list; a plain student is rejected with 403
// even though they hold a valid token. Exercises the path-parameter
// branch of the route table.
func TestLearningEvents_ListByLesson_RoleGate(t *testing.T) {
	env := setupLearningEventsEnv(t)
	lessonID, _ := env.insertLesson(t)

	// student — registered through the public /auth/register endpoint,
	// which assigns the default "student" role. The handler's
	// RequireRole("admin", "instructor") middleware must 403.
	tok, _ := env.registerStudent(t, makeEmail("le-student"))
	status, _ := env.do(t, "GET", "/api/v1/learning-events/lesson/"+lessonID, tok, nil)
	require.Equal(t, 403, status, "non-admin/instructor must be 403")

	// admin — seeded in env, role=admin. Must return 200 (empty list,
	// no events yet).
	status, raw := env.do(t, "GET", "/api/v1/learning-events/lesson/"+lessonID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "no events yet, admin should see []")

	// instructor — also allowed per RequireRole. Same 200 (empty list).
	status, raw = env.do(t, "GET", "/api/v1/learning-events/lesson/"+lessonID, env.instTok, nil)
	require.Equal(t, 200, status, "instructor: %s", string(raw))
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "instructor empty list")
}

// TestLearningEvents_ListByLesson_AdminSeesAll — the admin endpoint
// must surface events from every user that wrote to the lesson (this
// is the operator view; ListMine does NOT collapse here). Confirms the
// path-param route is actually wired to ListByLesson and the
// repo.ListByLesson sqlc query.
func TestLearningEvents_ListByLesson_AdminSeesAll(t *testing.T) {
	env := setupLearningEventsEnv(t)
	tokA, _ := env.registerStudent(t, makeEmail("le-adminview-a"))
	tokB, _ := env.registerStudent(t, makeEmail("le-adminview-b"))
	lessonID, _ := env.insertLesson(t)

	for i := 0; i < 2; i++ {
		status, _ := env.do(t, "POST", "/api/v1/learning-events/", tokA, map[string]any{
			"eventType":   "play",
			"lessonId":    lessonID,
			"positionSec": i,
		})
		require.Equal(t, 201, status)
	}
	for i := 0; i < 3; i++ {
		status, _ := env.do(t, "POST", "/api/v1/learning-events/", tokB, map[string]any{
			"eventType":   "pause",
			"lessonId":    lessonID,
			"positionSec": i,
		})
		require.Equal(t, 201, status)
	}

	// Admin sees all 5 events for the lesson.
	status, raw := env.do(t, "GET", "/api/v1/learning-events/lesson/"+lessonID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 5, "admin must see every event on the lesson regardless of author")

	// And each row carries the lessonId we queried.
	for _, e := range list {
		require.Equal(t, lessonID, e["lessonId"], "row lessonId must match the path param")
	}
}
