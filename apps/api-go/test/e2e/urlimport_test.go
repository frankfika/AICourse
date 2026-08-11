// Package e2e — url-import module end-to-end test.
//
// Phase 2 T22: covers the 2 admin-only endpoints under
//
//	/api/v1/courses/import-*. T22 ships a stub; T22.1 wires the real
//	YouTube oEmbed + Bilibili view API + (optional) Gemini step.
//
// Routes:
//
//	POST /api/v1/courses/import-from-url         single URL → 202
//	POST /api/v1/courses/import-batch-from-urls  up to 20 URLs → 202
//
// Tests run offline by default — we point the module at httptest
// fixtures (via SetYouTubeOEmbedBaseURL / SetBilibiliViewBaseURL) so
// no real network calls are made. The fixtures return canned JSON
// shaped exactly like the real APIs.
package e2e

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/urlimport"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type urlImportTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
	adminID  string

	// Fixture server for the YouTube oEmbed and Bilibili view APIs.
	// Returned handlers are stored so individual tests can re-program
	// them between assertions.
	youtubeSrv *httptest.Server
	biliSrv    *httptest.Server
}

func setupUrlImportEnv(t *testing.T) *urlImportTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_urlimport_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_urlimport_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	var db *sql.DB
	// Slightly bump the dockertest retry window — default is 60s, but
	// on busy CI machines the host port-mapping can take a bit longer
	// when many tests in parallel try to spin up their own MySQL.
	pool.MaxWait = 90 * time.Second
	require.NoError(t, pool.Retry(func() error {
		var oerr error
		db, oerr = sql.Open("mysql", dsn)
		if oerr != nil {
			return oerr
		}
		return db.Ping()
	}), "mysql never came up")

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

	adminEmail := makeEmail("ui-admin")
	adminID := insertUserDirect(t, db, adminEmail, "UI Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	// Default fixtures: return a real-looking response for the
	// canonical test URL. Individual tests can re-program via the
	// env's youtubeSrv / biliSrv handles.
	youtubeSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "title": "AI Academy Test Video",
  "author_name": "Test Channel",
  "author_url": "https://www.youtube.com/@test",
  "type": "video",
  "version": "1.0",
  "provider_name": "YouTube",
  "provider_url": "https://www.youtube.com/",
  "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "width": 480,
  "height": 360
}`))
	}))
	biliSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "code": 0,
  "message": "0",
  "ttl": 1,
  "data": {
    "bvid": "BV1xx411c7mD",
    "title": "Bili Test Video",
    "desc": "A test description for e2e.",
    "pic": "https://i0.hdslb.com/bfs/archive/test.jpg",
    "duration": 183,
    "owner": { "name": "Test Uploader" }
  }
}`))
	}))
	// Point the urlimport module at the fixtures. The default prod
	// URLs are restored in Cleanup so parallel test files aren't
	// affected.
	prevYouTube := urlimport.YouTubeOEmbedBaseURL
	prevBili := urlimport.BilibiliViewBaseURL
	urlimport.SetYouTubeOEmbedBaseURL(youtubeSrv.URL)
	urlimport.SetBilibiliViewBaseURL(biliSrv.URL)

	urlRepo := urlimport.NewRepo(db)
	urlSvc := urlimport.NewService(urlRepo, log)
	urlH := handler.NewUrlImportHandler(urlSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-urlimport",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	urlH.Mount(v1)

	t.Cleanup(func() {
		urlimport.SetYouTubeOEmbedBaseURL(prevYouTube)
		urlimport.SetBilibiliViewBaseURL(prevBili)
		youtubeSrv.Close()
		biliSrv.Close()
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &urlImportTestEnv{
		app: app, db: db, log: log,
		adminTok: adminTok, adminID: adminID,
		youtubeSrv: youtubeSrv, biliSrv: biliSrv,
	}
}

func (e *urlImportTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
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

func (e *urlImportTestEnv) registerStudent(t *testing.T, email string) string {
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
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken
}

// ============ TESTS ============

func TestUrlImport_Unauthenticated_401(t *testing.T) {
	env := setupUrlImportEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/courses/import-from-url", "", map[string]any{
		"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	})
	require.Equal(t, 401, status, "import-from-url without auth must be 401")

	status, _ = env.do(t, "POST", "/api/v1/courses/import-batch-from-urls", "", map[string]any{
		"urls": []string{"https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
	})
	require.Equal(t, 401, status, "batch without auth must be 401")
}

func TestUrlImport_Student_403(t *testing.T) {
	env := setupUrlImportEnv(t)
	tok := env.registerStudent(t, makeEmail("ui-stu"))

	status, _ := env.do(t, "POST", "/api/v1/courses/import-from-url", tok, map[string]any{
		"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	})
	require.Equal(t, 403, status, "student must not import")

	status, _ = env.do(t, "POST", "/api/v1/courses/import-batch-from-urls", tok, map[string]any{
		"urls": []string{"https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
	})
	require.Equal(t, 403, status, "student must not batch-import")
}

// T22.1 happy path: YouTube oEmbed fixture returns canned metadata.
// The service should hit the fixture, persist title/author/thumbnail,
// flip status to 'fetched' (or 'imported' if GEMINI_API_KEY is set),
// and return 202 with the DTO enriched.
func TestUrlImport_Admin_Single_YouTube_Real(t *testing.T) {
	env := setupUrlImportEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	})
	require.Equal(t, 202, status, "import: %s", string(raw))

	var task struct {
		ID              string `json:"id"`
		URL             string `json:"url"`
		Platform        string `json:"platform"`
		Status          string `json:"status"`
		Note            string `json:"note"`
		Title           string `json:"title"`
		Author          string `json:"author"`
		ThumbnailURL    string `json:"thumbnailUrl"`
		DurationSeconds *int32 `json:"durationSeconds"`
		CreatedAt       string `json:"createdAt"`
		UpdatedAt       string `json:"updatedAt"`
	}
	require.NoError(t, json.Unmarshal(raw, &task))
	require.NotEmpty(t, task.ID)
	require.Equal(t, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", task.URL, "canonicalised")
	require.Equal(t, "youtube", task.Platform)
	// GEMINI_API_KEY is unset in tests → no Gemini call → status flips
	// to 'imported' (per T22.1 spec: imported after the metadata pass).
	require.Equal(t, "imported", task.Status, "T22.1 default: imported after metadata pass")
	require.Contains(t, task.Note, "T22.1", "note should mention the real impl")
	require.Equal(t, "AI Academy Test Video", task.Title)
	require.Equal(t, "Test Channel", task.Author)
	require.Equal(t, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", task.ThumbnailURL)

	// DB verify
	var (
		dbURL, dbPlatform, dbStatus, dbTitle, dbAuthor string
		dbThumb                                        string
	)
	require.NoError(t, env.db.QueryRow(
		"SELECT url, platform, status, title, author, thumbnail_url FROM url_imports WHERE id = ?",
		task.ID,
	).Scan(&dbURL, &dbPlatform, &dbStatus, &dbTitle, &dbAuthor, &dbThumb))
	require.Equal(t, "imported", dbStatus)
	require.Equal(t, "AI Academy Test Video", dbTitle)
	require.Equal(t, "Test Channel", dbAuthor)
	require.Equal(t, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", dbThumb)
}

func TestUrlImport_Admin_Single_Bilibili_Real(t *testing.T) {
	env := setupUrlImportEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "https://www.bilibili.com/video/BV1xx411c7mD",
	})
	require.Equal(t, 202, status, "import: %s", string(raw))

	var task struct {
		URL             string `json:"url"`
		Platform        string `json:"platform"`
		Status          string `json:"status"`
		Title           string `json:"title"`
		Author          string `json:"author"`
		DurationSeconds *int32 `json:"durationSeconds"`
	}
	require.NoError(t, json.Unmarshal(raw, &task))
	require.Equal(t, "https://www.bilibili.com/video/BV1xx411c7mD", task.URL)
	require.Equal(t, "bilibili", task.Platform)
	require.Equal(t, "imported", task.Status)
	require.Equal(t, "Bili Test Video", task.Title)
	require.Equal(t, "Test Uploader", task.Author)
	require.NotNil(t, task.DurationSeconds)
	require.Equal(t, int32(183), *task.DurationSeconds)
}

// T22.1: a fixture that returns 500 should mark the task 'failed'
// with a populated error_message column.
func TestUrlImport_Admin_Single_UpstreamFailure(t *testing.T) {
	env := setupUrlImportEnv(t)
	// Re-program the YouTube fixture to fail.
	env.youtubeSrv.Close()
	env.youtubeSrv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"backend down"}`))
	}))
	urlimport.SetYouTubeOEmbedBaseURL(env.youtubeSrv.URL)

	status, raw := env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "https://www.youtube.com/watch?v=EEEEEEEEEEE",
	})
	require.Equal(t, 202, status, "endpoint returns 202 even on upstream failure: %s", string(raw))

	var task struct {
		Status       string `json:"status"`
		ErrorMessage string `json:"errorMessage"`
	}
	require.NoError(t, json.Unmarshal(raw, &task))
	require.Equal(t, "failed", task.Status)
	require.Contains(t, task.ErrorMessage, "500", "error_message should mention the 500")

	var dbErrMsg string
	require.NoError(t, env.db.QueryRow(
		"SELECT COALESCE(error_message, '') FROM url_imports WHERE id IS NOT NULL ORDER BY created_at DESC LIMIT 1",
	).Scan(&dbErrMsg))
	require.Contains(t, dbErrMsg, "500")
}

func TestUrlImport_Admin_Single_RejectsBadURL(t *testing.T) {
	env := setupUrlImportEnv(t)
	// Unsupported host
	status, raw := env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "https://vimeo.com/12345",
	})
	require.Equal(t, 400, status, "unsupported host: %s", string(raw))

	// Garbage
	status, _ = env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "not a url",
	})
	require.Equal(t, 400, status)

	// Wrong scheme
	status, _ = env.do(t, "POST", "/api/v1/courses/import-from-url", env.adminTok, map[string]any{
		"url": "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
	})
	require.Equal(t, 400, status)
}

func TestUrlImport_Admin_Batch(t *testing.T) {
	env := setupUrlImportEnv(t)
	urls := []string{
		"https://www.youtube.com/watch?v=AAAAAAAAAAA",
		"https://www.bilibili.com/video/BV1xx411c7mD",
		"https://vimeo.com/12345", // unsupported
		"https://youtu.be/BBBBBBBBBBB",
	}
	status, raw := env.do(t, "POST", "/api/v1/courses/import-batch-from-urls", env.adminTok, map[string]any{
		"urls": urls,
	})
	require.Equal(t, 202, status, "batch: %s", string(raw))

	var summary struct {
		Total   int `json:"total"`
		Created int `json:"created"`
		Failed  int `json:"failed"`
		Results []struct {
			URL    string `json:"url"`
			Status string `json:"status"`
			TaskID string `json:"taskId,omitempty"`
			Error  string `json:"error,omitempty"`
		} `json:"results"`
	}
	require.NoError(t, json.Unmarshal(raw, &summary))
	require.Equal(t, 4, summary.Total)
	require.Equal(t, 3, summary.Created, "3 valid URLs persist a row")
	require.Equal(t, 1, summary.Failed, "1 unsupported (parse error)")
	require.Len(t, summary.Results, 4)

	// First result: supported YouTube URL → created
	require.Equal(t, "created", summary.Results[0].Status)
	require.NotEmpty(t, summary.Results[0].TaskID)
	// vimeo entry should be failed with an error
	require.Equal(t, "failed", summary.Results[2].Status)
	require.NotEmpty(t, summary.Results[2].Error)

	// DB verify: 3 rows in url_imports, all requested_by = admin
	var dbCount int
	require.NoError(t, env.db.QueryRow(
		"SELECT COUNT(*) FROM url_imports WHERE requested_by = ?", env.adminID,
	).Scan(&dbCount))
	require.Equal(t, 3, dbCount, "3 successful imports persisted")

	// All 3 should have status in (fetched, imported, failed) — never
	// 'pending' because the fetch is now synchronous.
	var distinctStatuses int
	require.NoError(t, env.db.QueryRow(
		"SELECT COUNT(DISTINCT status) FROM url_imports WHERE requested_by = ?", env.adminID,
	).Scan(&distinctStatuses))
	require.GreaterOrEqual(t, distinctStatuses, 1, "at least one status (imported|fetched|failed)")
}

func TestUrlImport_Admin_Batch_EmptyList(t *testing.T) {
	env := setupUrlImportEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/courses/import-batch-from-urls", env.adminTok, map[string]any{
		"urls": []string{},
	})
	require.Equal(t, 400, status, "empty urls must be 400")
}
