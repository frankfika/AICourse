// Package e2e — notes module end-to-end test.
//
// Phase 2 T15-3: covers the 4 unique operations across 4 endpoints.
//
//	GET  /lessons/:lessonId/notes   list my notes
//	POST /lessons/:lessonId/notes   create
//	PATCH /notes/:id                 update (owner only)
//	DELETE /notes/:id                delete (owner only)
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
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/notes"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type notesTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupNotesEnv(t *testing.T) *notesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_notes_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_notes_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	notesRepo := notes.NewRepo(db)
	notesSvc := notes.NewService(notesRepo, log)
	notesH := handler.NewNotesHandler(notesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-notes",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	notesH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &notesTestEnv{app: app, db: db, log: log}
}

func (e *notesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *notesTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *notesTestEnv) insertLesson(t *testing.T) string {
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
	return lessonID
}

// ============ TESTS ============

func TestNotes_Unauthenticated_401(t *testing.T) {
	env := setupNotesEnv(t)
	lessonID := env.insertLesson(t)
	status, _ := env.do(t, "GET", "/api/v1/lessons/"+lessonID+"/notes/", "", nil)
	require.Equal(t, 401, status)
}

func TestNotes_Create_And_List(t *testing.T) {
	env := setupNotesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("notes-cr"))
	lessonID := env.insertLesson(t)

	// Create
	status, raw := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/notes/", tok, map[string]any{
		"content":     "My note",
		"positionSec": 60,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID          string `json:"id"`
		Content     string `json:"content"`
		PositionSec *int32 `json:"positionSec"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "My note", created.Content)
	require.NotNil(t, created.PositionSec)

	// Create with empty content → 400
	status, _ = env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/notes/", tok, map[string]any{
		"content": "",
	})
	require.Equal(t, 400, status, "empty content must be 400")

	// List
	status, raw = env.do(t, "GET", "/api/v1/lessons/"+lessonID+"/notes/", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "should have 1 note")
}

func TestNotes_Update_OwnerOnly(t *testing.T) {
	env := setupNotesEnv(t)
	tokA, _ := env.registerStudent(t, makeEmail("notes-owner"))
	tokB, _ := env.registerStudent(t, makeEmail("notes-other"))
	lessonID := env.insertLesson(t)

	// A creates
	status, raw := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/notes/", tokA, map[string]any{
		"content": "Original",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	noteID := created.ID

	// A updates → 200
	status, raw = env.do(t, "PATCH", "/api/v1/notes/"+noteID, tokA, map[string]any{
		"content": "Updated",
	})
	require.Equal(t, 200, status, "owner update: %s", string(raw))
	var updated struct {
		Content string `json:"content"`
	}
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "Updated", updated.Content)

	// B updates → 403
	status, _ = env.do(t, "PATCH", "/api/v1/notes/"+noteID, tokB, map[string]any{
		"content": "Hacked",
	})
	require.Equal(t, 403, status, "non-owner must be 403")
}

func TestNotes_Delete_OwnerOnly(t *testing.T) {
	env := setupNotesEnv(t)
	tokA, _ := env.registerStudent(t, makeEmail("notes-del"))
	tokB, _ := env.registerStudent(t, makeEmail("notes-delb"))
	lessonID := env.insertLesson(t)

	// A creates
	status, raw := env.do(t, "POST", "/api/v1/lessons/"+lessonID+"/notes/", tokA, map[string]any{
		"content": "X",
	})
	require.Equal(t, 201, status)
	var created struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))

	// B deletes → 403
	status, _ = env.do(t, "DELETE", "/api/v1/notes/"+created.ID, tokB, nil)
	require.Equal(t, 403, status)

	// A deletes → 200
	status, _ = env.do(t, "DELETE", "/api/v1/notes/"+created.ID, tokA, nil)
	require.Equal(t, 200, status)
}
