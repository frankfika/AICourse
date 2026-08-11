// Package e2e — uploads module end-to-end test.
//
// Phase 2 T16-3: covers the 2 /api/v1/uploads/* endpoints.
//
//	POST /uploads/sign     auth: presigned upload URL
//	POST /uploads/complete auth: confirm + writeback to entity
//
// Mirrors apps/api/src/modules/uploads/uploads.controller.ts.
//
// Test strategy: use InMemoryStorage (default for dev/test). After
// sign, the test seeds the blob via TestSeed() to simulate a browser
// PUT, then calls complete. This avoids a real network round-trip
// while still exercising the full lifecycle.
//
// Scopes covered:
//   - user-avatar (self + admin writeback)
//   - course-thumbnail (admin-only writeback)
//   - submission-video (owner check)
//   - validation tests (role, mime, size, refId)
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
	"github.com/frankfika/ai-academy/api-go/internal/uploads"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type uploadsTestEnv struct {
	app     *fiber.App
	db      *sql.DB
	cfg     *config.Config
	log     *zap.Logger
	storage *uploads.InMemoryStorage
}

func setupUploadsEnv(t *testing.T) *uploadsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_uploads_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_uploads_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	storage := uploads.NewInMemoryStorage("http://test.local/static")
	uploadsRepo := uploads.NewRepo(db)
	uploadsSvc := uploads.NewService(uploadsRepo, storage, log)
	uploadsH := handler.NewUploadsHandler(uploadsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-uploads",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	uploadsH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &uploadsTestEnv{app: app, db: db, cfg: cfg, log: log, storage: storage}
}

func (e *uploadsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *uploadsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *uploadsTestEnv) bootstrapAdmin(t *testing.T, email string) (string, string) {
	t.Helper()
	_ = insertUserDirect(t, e.db, email, "Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, adminID := loginAs(t, e.db, e.cfg, email, "Str0ngP@ssw0rd!!")
	return adminTok, adminID
}

// insertCourse writes a published course (so the writeback can target it).
func (e *uploadsTestEnv) insertCourse(t *testing.T, title string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://old.com/t.png', 'x', 'free', 0, 'published', 'own', ?, ?)
	`, id, title, now, now)
	require.NoError(t, err)
	return id
}

// insertSubmission writes a hackathon + submission owned by userID.
func (e *uploadsTestEnv) insertSubmission(t *testing.T, userID string) (hackID, subID string) {
	t.Helper()
	hackID = uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO hackathons (id, title, description, status, start_date, end_date, created_at, updated_at)
		VALUES (?, 'Test Hack', 'x', 'upcoming', ?, ?, ?, ?)
	`, hackID, now, now.Add(7*24*time.Hour), now, now)
	require.NoError(t, err)

	subID = uuid.NewString()
	_, err = e.db.ExecContext(context.Background(), `
		INSERT INTO submissions (id, hackathon_id, user_id, title, description, status, created_at, updated_at)
		VALUES (?, ?, ?, 'Test Sub', 'x', 'draft', ?, ?)
	`, subID, hackID, userID, now, now)
	require.NoError(t, err)
	return hackID, subID
}

// ============ TESTS ============

func TestUploads_Unauthenticated_401(t *testing.T) {
	env := setupUploadsEnv(t)
	for _, c := range []struct{ method, path string }{
		{"POST", "/api/v1/uploads/sign"},
		{"POST", "/api/v1/uploads/complete"},
	} {
		status, _ := env.do(t, c.method, c.path, "", nil)
		require.Equal(t, 401, status, "%s %s should 401", c.method, c.path)
	}
}

func TestUploads_Sign_HappyPath(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ul-sign"))

	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "user-avatar",
		"filename": "pic.png",
		"mimeType": "image/png",
		"size":     1024,
	})
	require.Equal(t, 200, status, "sign: %s", string(raw))
	var resp struct {
		UploadURL string `json:"uploadUrl"`
		PublicURL string `json:"publicUrl"`
		Key       string `json:"key"`
		ExpiresIn int32  `json:"expiresIn"`
		Scope     string `json:"scope"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.NotEmpty(t, resp.UploadURL)
	require.NotEmpty(t, resp.PublicURL)
	require.NotEmpty(t, resp.Key)
	require.Equal(t, "user-avatar", resp.Scope)
	require.Contains(t, resp.Key, "users/avatars/")
}

func TestUploads_Sign_ValidationErrors(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ul-valid"))

	cases := []struct {
		name string
		body map[string]any
		want int
	}{
		{
			name: "invalid scope",
			body: map[string]any{"scope": "garbage", "filename": "x.png", "mimeType": "image/png", "size": 100},
			want: 400,
		},
		{
			name: "invalid mime for user-avatar",
			body: map[string]any{"scope": "user-avatar", "filename": "x.exe", "mimeType": "application/octet-stream", "size": 100},
			want: 400,
		},
		{
			name: "size over limit for user-avatar (2MB cap)",
			body: map[string]any{"scope": "user-avatar", "filename": "big.png", "mimeType": "image/png", "size": 3 * 1024 * 1024},
			want: 400,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, tc.body)
			require.Equal(t, tc.want, status, "body: %s", string(raw))
		})
	}
}

func TestUploads_Sign_StudentCannotUploadCourseThumbnail(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ul-rbac"))
	courseID := env.insertCourse(t, "RBAC Test")

	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "course-thumbnail",
		"filename": "t.png",
		"mimeType": "image/png",
		"size":     1024,
		"refId":    courseID,
	})
	require.Equal(t, 403, status, "student → course-thumbnail should 403: %s", string(raw))
}

func TestUploads_Sign_NonexistentRefID(t *testing.T) {
	env := setupUploadsEnv(t)
	adminTok, _ := env.bootstrapAdmin(t, makeEmail("ul-404ref"))

	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", adminTok, map[string]any{
		"scope":    "course-thumbnail",
		"filename": "t.png",
		"mimeType": "image/png",
		"size":     1024,
		"refId":    "nonexistent-course-id",
	})
	require.Equal(t, 404, status, "admin → nonexistent course should 404: %s", string(raw))
}

func TestUploads_Complete_NotFound(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ul-notfound"))

	// sign first to get a valid key shape
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "user-avatar",
		"filename": "x.png",
		"mimeType": "image/png",
		"size":     100,
	})
	require.Equal(t, 200, status, "sign: %s", string(raw))
	var signResp struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	// complete without seeding — headObject should 404
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", tok, map[string]any{
		"scope": "user-avatar",
		"key":   signResp.Key,
	})
	require.Equal(t, 404, status, "complete w/o seed should 404: %s", string(raw))
}

func TestUploads_Complete_CrossUserKeyForbidden(t *testing.T) {
	env := setupUploadsEnv(t)
	tokA, userA := env.registerStudent(t, makeEmail("ul-xuser-a"))
	tokB, _ := env.registerStudent(t, makeEmail("ul-xuser-b"))

	// A signs
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tokA, map[string]any{
		"scope":    "user-avatar",
		"filename": "x.png",
		"mimeType": "image/png",
		"size":     100,
	})
	require.Equal(t, 200, status)
	var signResp struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	// B tries to complete A's key — should 403 (key starts with users/avatars/<A's id>/)
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", tokB, map[string]any{
		"scope": "user-avatar",
		"key":   signResp.Key,
		"refId": userA,
	})
	require.Equal(t, 403, status, "B completing A's key should 403: %s", string(raw))
}

func TestUploads_Complete_UserAvatar_Writeback(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("ul-avatar"))

	// sign
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "user-avatar",
		"filename": "me.png",
		"mimeType": "image/png",
		"size":     2048,
		"refId":    userID,
	})
	require.Equal(t, 200, status, "sign: %s", string(raw))
	var signResp struct {
		UploadURL string `json:"uploadUrl"`
		PublicURL string `json:"publicUrl"`
		Key       string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	// Seed the in-memory storage (simulates the browser PUT)
	env.storage.TestSeed(signResp.Key, "image/png", []byte("fake-png-bytes"))

	// complete
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", tok, map[string]any{
		"scope": "user-avatar",
		"key":   signResp.Key,
		"refId": userID,
	})
	require.Equal(t, 200, status, "complete: %s", string(raw))
	var completeResp struct {
		URL         string `json:"url"`
		PublicURL   string `json:"publicUrl"`
		Key         string `json:"key"`
		WrittenBack bool   `json:"writtenBack"`
	}
	require.NoError(t, json.Unmarshal(raw, &completeResp))
	require.Equal(t, signResp.PublicURL, completeResp.PublicURL)
	require.True(t, completeResp.WrittenBack, "writtenBack should be true when refId is set")

	// Verify the user's avatar_url was updated
	var avatar sql.NullString
	require.NoError(t, env.db.QueryRow(`SELECT avatar_url FROM users WHERE id = ?`, userID).Scan(&avatar))
	require.True(t, avatar.Valid, "avatar_url should be set")
	require.Equal(t, completeResp.PublicURL, avatar.String)
}

func TestUploads_Complete_CourseThumbnail_Writeback(t *testing.T) {
	env := setupUploadsEnv(t)
	adminTok, _ := env.bootstrapAdmin(t, makeEmail("ul-cthumb"))
	courseID := env.insertCourse(t, "Thumb Test")

	// sign
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", adminTok, map[string]any{
		"scope":    "course-thumbnail",
		"filename": "t.png",
		"mimeType": "image/png",
		"size":     1024,
		"refId":    courseID,
	})
	require.Equal(t, 200, status, "sign: %s", string(raw))
	var signResp struct {
		PublicURL string `json:"publicUrl"`
		Key       string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	// Seed
	env.storage.TestSeed(signResp.Key, "image/png", []byte("fake-thumb"))

	// complete
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", adminTok, map[string]any{
		"scope": "course-thumbnail",
		"key":   signResp.Key,
		"refId": courseID,
	})
	require.Equal(t, 200, status, "complete: %s", string(raw))

	// Verify courses.thumbnail was updated
	var thumb string
	require.NoError(t, env.db.QueryRow(`SELECT thumbnail FROM courses WHERE id = ?`, courseID).Scan(&thumb))
	require.Equal(t, signResp.PublicURL, thumb)
}

func TestUploads_Complete_OwnerSubmission_Writeback(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("ul-sub-own"))
	_, subID := env.insertSubmission(t, userID)

	// sign
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "submission-video",
		"filename": "demo.mp4",
		"mimeType": "video/mp4",
		"size":     5 * 1024 * 1024,
		"refId":    subID,
	})
	require.Equal(t, 200, status, "sign: %s", string(raw))
	var signResp struct {
		PublicURL string `json:"publicUrl"`
		Key       string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	env.storage.TestSeed(signResp.Key, "video/mp4", []byte("fake-mp4"))

	// complete
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", tok, map[string]any{
		"scope": "submission-video",
		"key":   signResp.Key,
		"refId": subID,
	})
	require.Equal(t, 200, status, "complete: %s", string(raw))

	// Verify submissions.video_url was updated
	var video sql.NullString
	require.NoError(t, env.db.QueryRow(`SELECT video_url FROM submissions WHERE id = ?`, subID).Scan(&video))
	require.True(t, video.Valid)
	require.Equal(t, signResp.PublicURL, video.String)
}

func TestUploads_Complete_OtherUsersSubmission_Forbidden(t *testing.T) {
	env := setupUploadsEnv(t)
	_, userA := env.registerStudent(t, makeEmail("ul-sub-a"))
	tokB, _ := env.registerStudent(t, makeEmail("ul-sub-b"))
	_, subID := env.insertSubmission(t, userA) // owned by A

	// B signs (student role, allowed by submission-video)
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tokB, map[string]any{
		"scope":    "submission-video",
		"filename": "demo.mp4",
		"mimeType": "video/mp4",
		"size":     1024,
		"refId":    subID,
	})
	require.Equal(t, 404, status, "B signing for A's submission should 404 (refId check): %s", string(raw))
}

func TestUploads_Complete_NoWriteback_WhenRefIDOmitted(t *testing.T) {
	env := setupUploadsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("ul-norefb"))

	// sign WITHOUT refId (frontend will use the returned publicUrl directly)
	status, raw := env.do(t, "POST", "/api/v1/uploads/sign", tok, map[string]any{
		"scope":    "user-avatar",
		"filename": "x.png",
		"mimeType": "image/png",
		"size":     100,
	})
	require.Equal(t, 200, status)
	var signResp struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(raw, &signResp))

	env.storage.TestSeed(signResp.Key, "image/png", []byte("x"))

	// complete without refId — should succeed but writtenBack=false
	status, raw = env.do(t, "POST", "/api/v1/uploads/complete", tok, map[string]any{
		"scope": "user-avatar",
		"key":   signResp.Key,
	})
	require.Equal(t, 200, status, "complete: %s", string(raw))
	var completeResp struct {
		WrittenBack bool `json:"writtenBack"`
	}
	require.NoError(t, json.Unmarshal(raw, &completeResp))
	require.False(t, completeResp.WrittenBack, "no refId → no writeback")
}
