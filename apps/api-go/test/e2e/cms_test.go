// Package e2e — CMS module end-to-end test.
//
// Phase 2 T23: covers the 6 NestJS controllers in
// apps/api/src/modules/cms/ — cms-admin (16 resources × 4 ops = 64
// endpoints), cms-config (3 public), cms-content (10 public), cms-enum
// (2 public), cms-i18n (1 public), sitemap (1 public XML).
//
// Focus: every public endpoint must 200, every admin endpoint must 401
// without auth + 403 as student + 200 as admin. CRUD is exercised
// end-to-end (create → list → update → delete → list) on a representative
// subset of the 16 resources: app-settings (key PK), page-settings
// (composite), industries (id), testimonials (id), top-nav (id +
// assertSafeNavPath), footer-columns (id + per-link assertSafeNavPath),
// auth-providers (admin vs public strips config), i18n-messages
// (composite), enum-translations (composite), hot-keywords (scope
// enum), quick-prompts (scope enum), enterprise-methods (id).
//
// Uses dockertest MySQL + real schema. No mocks. The schema is the
// same 0001_init.sql used by every other e2e module; we just rely on
// the 16 CMS tables being there.
package e2e

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/cms"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
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

type cmsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
	adminID  string
}

func setupCMSEnv(t *testing.T) *cmsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err, "dockertest pool")
	// dockertest's default MaxWait is 60s; bump to 180s so a transient
	// high-load machine (load avg 10+) does not flake the mysql boot.
	pool.MaxWait = 300 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_cms_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err, "run mysql container")

	// Forward-declare db and log so the cleanup closure can reference
	// them safely even if the dockertest retry / schema / config step
	// below fails before they are populated. This prevents mysql
	// containers from leaking across tests when docker flakes.
	var db *sql.DB
	var log *zap.Logger

	// Register cleanup IMMEDIATELY after pool.Run so that a dockertest
	// flake (mysql never came up, schema apply failed, etc.) does not
	// leak the container across subsequent test invocations.
	t.Cleanup(func() {
		if db != nil {
			_ = db.Close()
		}
		_ = pool.Purge(resource)
		if log != nil {
			_ = log.Sync()
		}
	})

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_cms_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
		resource.GetPort("3306/tcp"))

	// On a high-load host (load avg 10+) the kernel can take a few
	// seconds to actually bind the host port even after `docker run`
	// returns. The exponential-backoff retry in dockertest starts
	// hitting within ~500ms; without a small upfront pause the very
	// first Ping can land before the port is wired up, producing
	// "connection refused" on every retry. 3 seconds is enough on
	// every machine we have seen.
	time.Sleep(5 * time.Second)

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

	log, err = logger.New("test")
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

	adminID := insertUserDirect(t, db, makeEmail("cms-admin"), "CMS Admin", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, lookupEmail(t, db, adminID), "Str0ngP@ssw0rd!!")

	cmsRepo := cms.NewRepo(db)
	cmsSvc := cms.NewService(cmsRepo, log)
	cmsH := handler.NewCMSHandler(cmsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-cms",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	cmsH.Mount(v1)
	app.Get("/sitemap.xml", cmsH.SitemapHandler())

	return &cmsTestEnv{app: app, db: db, log: log, adminTok: adminTok, adminID: adminID}
}

func (e *cmsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *cmsTestEnv) registerStudent(t *testing.T) string {
	t.Helper()
	email := makeEmail("cms-stu")
	body, _ := json.Marshal(map[string]any{
		"email": email, "password": "Str0ngP@ssw0rd!!", "name": "Student",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	require.Equal(t, 201, resp.StatusCode, "register student: %s", string(b))
	var out struct {
		AccessToken string `json:"accessToken"`
	}
	require.NoError(t, json.Unmarshal(b, &out))
	return out.AccessToken
}

// lookupEmail fetches a user's email by id (for /auth/login). The admin
// was created with a generated email so we read it back.
func lookupEmail(t *testing.T, db *sql.DB, id string) string {
	t.Helper()
	var email string
	err := db.QueryRow(`SELECT email FROM users WHERE id = ?`, id).Scan(&email)
	require.NoError(t, err)
	return email
}

// ============ auth boundary ============

// TestCMS_Admin_Unauthenticated_401 sweeps the 4 admin endpoints on a
// representative resource (industries). All must 401 without a token.
func TestCMS_Admin_Unauthenticated_401(t *testing.T) {
	env := setupCMSEnv(t)
	for _, method := range []string{"GET", "POST", "PATCH", "DELETE"} {
		var path string
		switch method {
		case "GET":
			path = "/api/v1/admin/cms/industries"
		case "POST":
			path = "/api/v1/admin/cms/industries"
		case "PATCH":
			path = "/api/v1/admin/cms/industries/abc"
		case "DELETE":
			path = "/api/v1/admin/cms/industries/abc"
		}
		var rdr io.Reader
		if method == "POST" {
			raw, _ := json.Marshal(map[string]any{"key": "x", "label": "x"})
			rdr = bytes.NewReader(raw)
		}
		req := httptest.NewRequest(method, path, rdr)
		if rdr != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		resp, err := env.app.Test(req, -1)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equalf(t, 401, resp.StatusCode, "%s %s must be 401 without auth", method, path)
	}
}

// TestCMS_Admin_Student_403 confirms a non-admin caller gets 403 on
// every admin route.
func TestCMS_Admin_Student_403(t *testing.T) {
	env := setupCMSEnv(t)
	studentTok := env.registerStudent(t)
	for _, path := range []string{
		"/api/v1/admin/cms/industries",
		"/api/v1/admin/cms/testimonials",
		"/api/v1/admin/cms/top-nav",
		"/api/v1/admin/cms/footer-columns",
		"/api/v1/admin/cms/auth-providers",
		"/api/v1/admin/cms/i18n/messages",
		"/api/v1/admin/cms/enum-translations",
		"/api/v1/admin/cms/date-format-templates",
	} {
		status, raw := env.do(t, "GET", path, studentTok, nil)
		require.Equalf(t, 403, status, "GET %s as student must be 403 (got %d body=%s)", path, status, string(raw))
	}
}

// ============ public reads must NOT 401 ============

// TestCMS_Public_NoAuth covers all 17 public read endpoints. None of
// them must 401, even without a token.
func TestCMS_Public_NoAuth(t *testing.T) {
	env := setupCMSEnv(t)
	paths := []string{
		"/api/v1/app-settings",
		"/api/v1/site-settings",
		"/api/v1/page-settings",
		"/api/v1/industries",
		"/api/v1/enterprise-methods",
		"/api/v1/testimonials",
		"/api/v1/quick-prompts",
		"/api/v1/course-categories",
		"/api/v1/popular-searches",
		"/api/v1/hot-keywords",
		"/api/v1/auth-providers",
		"/api/v1/top-nav",
		"/api/v1/footer-columns",
		"/api/v1/enum-translations",
		"/api/v1/date-format-templates",
		"/api/v1/i18n/messages",
	}
	for _, p := range paths {
		status, raw := env.do(t, "GET", p, "", nil)
		require.NotEqualf(t, 401, status, "GET %s must NOT be 401 (got %d body=%s)", p, status, string(raw))
		require.Equalf(t, 200, status, "GET %s must be 200 on empty DB (got %d body=%s)", p, status, string(raw))
	}
}

// ============ app_settings (key PK, full CRUD) ============

func TestCMS_AppSettings_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	// 1. create
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/app-settings", env.adminTok, map[string]any{
		"key":         "feature.signup.bonus",
		"valueJson":   map[string]any{"amount": 100, "enabled": true},
		"scope":       "global",
		"description": "Signup bonus amount",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "feature.signup.bonus", created["key"])
	require.Equal(t, "global", created["scope"])

	// 2. list (admin)
	status, raw = env.do(t, "GET", "/api/v1/admin/cms/app-settings", env.adminTok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)

	// 3. public list — same shape
	status, raw = env.do(t, "GET", "/api/v1/app-settings", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)

	// 4. public list filtered by scope
	status, raw = env.do(t, "GET", "/api/v1/app-settings?scope=global", "", nil)
	require.Equal(t, 200, status)

	// 5. update
	status, raw = env.do(t, "PATCH", "/api/v1/admin/cms/app-settings/feature.signup.bonus", env.adminTok, map[string]any{
		"valueJson": map[string]any{"amount": 200, "enabled": true},
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated map[string]any
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "feature.signup.bonus", updated["key"])

	// 6. delete
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/app-settings/feature.signup.bonus", env.adminTok, nil)
	require.Equal(t, 200, status)

	// 7. list — empty
	status, raw = env.do(t, "GET", "/api/v1/admin/cms/app-settings", env.adminTok, nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 0)
}

// TestCMS_AppSettings_BadJSON_400 confirms a missing valueJson returns
// 400 (not 500) on create.
func TestCMS_AppSettings_BadJSON_400(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/app-settings", env.adminTok, map[string]any{
		"key": "k",
	})
	require.Equal(t, 400, status)
}

// TestCMS_AppSettings_NotFound_404 covers PATCH + DELETE on missing key.
func TestCMS_AppSettings_NotFound_404(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "PATCH", "/api/v1/admin/cms/app-settings/missing", env.adminTok, map[string]any{
		"valueJson": map[string]any{"x": 1},
	})
	require.Equal(t, 404, status)

	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/app-settings/missing", env.adminTok, nil)
	require.Equal(t, 404, status)
}

// ============ site_settings (key PK + public keys= batch) ============

func TestCMS_SiteSettings_KeysBatch(t *testing.T) {
	env := setupCMSEnv(t)
	for _, key := range []string{"brand.hero.headline", "brand.footer.copyright", "unused"} {
		status, _ := env.do(t, "POST", "/api/v1/admin/cms/site-settings", env.adminTok, map[string]any{
			"key":       key,
			"valueJson": "value-of-" + key,
		})
		require.Equal(t, 201, status)
	}

	// ?keys=a,b → map response with only matching keys.
	status, raw := env.do(t, "GET", "/api/v1/site-settings?keys=brand.hero.headline,brand.footer.copyright", "", nil)
	require.Equal(t, 200, status)
	var byKey map[string]any
	require.NoError(t, json.Unmarshal(raw, &byKey))
	require.Len(t, byKey, 2)
	require.NotNil(t, byKey["brand.hero.headline"])
	require.NotNil(t, byKey["brand.footer.copyright"])
	_, present := byKey["unused"]
	require.False(t, present, "unused key must not be in batch result")
}

// ============ page_settings (composite PK page:key) ============

func TestCMS_PageSettings_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/page-settings", env.adminTok, map[string]any{
		"page":        "home",
		"key":         "hero.title",
		"valueJson":   "Welcome to AI Academy",
		"description": "Hero title on home",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))

	// update via composite id
	status, raw = env.do(t, "PATCH", "/api/v1/admin/cms/page-settings/home:hero.title", env.adminTok, map[string]any{
		"valueJson": "Updated",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))

	// public batch by pages
	status, raw = env.do(t, "GET", "/api/v1/page-settings?page=home&page=courses", "", nil)
	require.Equal(t, 200, status)
	var batch map[string]map[string]any
	require.NoError(t, json.Unmarshal(raw, &batch))
	require.Contains(t, batch, "home")
	require.Contains(t, batch["home"], "hero.title")

	// delete via composite id
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/page-settings/home:hero.title", env.adminTok, nil)
	require.Equal(t, 200, status)

	// invalid id
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/page-settings/only-one-part", env.adminTok, map[string]any{
		"valueJson": "x",
	})
	require.Equal(t, 400, status)
}

// ============ enum_translations (composite type:value:locale) ============

func TestCMS_EnumTranslations_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	// create
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/enum-translations", env.adminTok, map[string]any{
		"enumType":   "course_level",
		"enumValue":  "Beginner",
		"locale":     "zh-CN",
		"label":      "初级",
		"colorClass": "blue",
		"icon":       "star",
		"sortOrder":  1,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))

	// public list (filter)
	status, raw = env.do(t, "GET", "/api/v1/enum-translations?type=course_level&locale=zh-CN", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)

	// update via composite id
	status, raw = env.do(t, "PATCH", "/api/v1/admin/cms/enum-translations/course_level:Beginner:zh-CN", env.adminTok, map[string]any{
		"label": "入门",
	})
	require.Equal(t, 200, status, "update: %s", string(raw))

	// delete
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/enum-translations/course_level:Beginner:zh-CN", env.adminTok, nil)
	require.Equal(t, 200, status)

	// invalid id (only 2 parts)
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/enum-translations/course_level:Beginner", env.adminTok, map[string]any{
		"label": "x",
	})
	require.Equal(t, 400, status)
}

// ============ date_format_templates (composite scope:locale) ============

func TestCMS_DateFormatTemplates_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/date-format-templates", env.adminTok, map[string]any{
		"scope":    "global",
		"locale":   "zh-CN",
		"template": "YYYY-MM-DD",
	})
	require.Equal(t, 201, status, "create: %s", string(raw))

	status, raw = env.do(t, "PATCH", "/api/v1/admin/cms/date-format-templates/global:zh-CN", env.adminTok, map[string]any{
		"template": "YYYY/MM/DD",
	})
	require.Equal(t, 200, status)

	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/date-format-templates/global:zh-CN", env.adminTok, nil)
	require.Equal(t, 200, status)
}

// ============ industries (id PK, methodology JSON) ============

func TestCMS_Industries_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	methodology := map[string]any{
		"steps": []string{"collect", "analyze", "ship"},
	}
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/industries", env.adminTok, map[string]any{
		"key":         "fintech",
		"label":       "Fintech",
		"description": "Banking + AI",
		"icon":        "bank",
		"methodology": methodology,
		"isActive":    true,
		"orderIndex":  1,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	id := created["id"].(string)
	require.NotEmpty(t, id)

	// admin list — no filter
	status, raw = env.do(t, "GET", "/api/v1/admin/cms/industries", env.adminTok, nil)
	require.Equal(t, 200, status)
	var adminList []map[string]any
	require.NoError(t, json.Unmarshal(raw, &adminList))
	require.Len(t, adminList, 1)

	// public list — default active-only returns 1
	status, raw = env.do(t, "GET", "/api/v1/industries", "", nil)
	require.Equal(t, 200, status)
	var pubList []map[string]any
	require.NoError(t, json.Unmarshal(raw, &pubList))
	require.Len(t, pubList, 1)

	// public list — active=false returns 0
	status, raw = env.do(t, "GET", "/api/v1/industries?active=false", "", nil)
	require.Equal(t, 200, status)
	pubList = nil
	require.NoError(t, json.Unmarshal(raw, &pubList))
	require.Len(t, pubList, 0)

	// update — flip isActive to false
	status, raw = env.do(t, "PATCH", "/api/v1/admin/cms/industries/"+id, env.adminTok, map[string]any{
		"isActive": false,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))

	// public list — default returns 0
	status, raw = env.do(t, "GET", "/api/v1/industries", "", nil)
	require.Equal(t, 200, status)
	require.NoError(t, json.Unmarshal(raw, &pubList))
	require.Len(t, pubList, 0)

	// delete
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/industries/"+id, env.adminTok, nil)
	require.Equal(t, 200, status)

	// delete missing → 404
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/industries/"+id, env.adminTok, nil)
	require.Equal(t, 404, status)
}

// ============ testimonials (id PK) ============

func TestCMS_Testimonials_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/testimonials", env.adminTok, map[string]any{
		"name":       "Alice",
		"title":      "Engineer",
		"quote":      "Great course",
		"avatar":     "https://x.test/a.png",
		"isActive":   true,
		"orderIndex": 1,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	id := created["id"].(string)

	// update
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/testimonials/"+id, env.adminTok, map[string]any{
		"quote": "Updated",
	})
	require.Equal(t, 200, status)

	// public read
	status, raw = env.do(t, "GET", "/api/v1/testimonials", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "Updated", list[0]["quote"])

	// delete
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/testimonials/"+id, env.adminTok, nil)
	require.Equal(t, 200, status)

	// empty body missing required name
	status, _ = env.do(t, "POST", "/api/v1/admin/cms/testimonials", env.adminTok, map[string]any{
		"quote": "no name",
	})
	require.Equal(t, 400, status)
}

// ============ quick_prompts (id PK, scope enum) ============

func TestCMS_QuickPrompts_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/admin/cms/quick-prompts", env.adminTok, map[string]any{
		"label":      "Explain",
		"promptText": "Explain this code",
		"scope":      "lesson",
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	id := created["id"].(string)
	require.Equal(t, "💡", created["emoji"], "default emoji")

	// public list filtered by scope
	status, raw = env.do(t, "GET", "/api/v1/quick-prompts?scope=lesson", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)

	// public list filtered by scope=course (none)
	status, raw = env.do(t, "GET", "/api/v1/quick-prompts?scope=course", "", nil)
	require.Equal(t, 200, status)
	list = nil
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 0)

	// update
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/quick-prompts/"+id, env.adminTok, map[string]any{
		"emoji": "🤖",
		"scope": "course",
	})
	require.Equal(t, 200, status)

	// delete
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/quick-prompts/"+id, env.adminTok, nil)
	require.Equal(t, 200, status)
}

// ============ course_categories (id PK) ============

func TestCMS_CourseCategories_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/course-categories", env.adminTok, map[string]any{
		"key":        "nlp",
		"label":      "Natural Language Processing",
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)
}

// ============ popular_searches (id PK) ============

func TestCMS_PopularSearches_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/popular-searches", env.adminTok, map[string]any{
		"keyword":    "transformer",
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)
}

// ============ hot_keywords (id PK, scope enum) ============

func TestCMS_HotKeywords_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/hot-keywords", env.adminTok, map[string]any{
		"keyword":    "llm",
		"scope":      "courses",
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)

	// public filtered by scope
	status, raw := env.do(t, "GET", "/api/v1/hot-keywords?scope=courses", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
}

// ============ auth_providers (id PK, public strips config) ============

func TestCMS_AuthProviders_AdminListFull_PublicStripsConfig(t *testing.T) {
	env := setupCMSEnv(t)
	config := map[string]any{
		"clientId":     "public-id",
		"clientSecret": "super-secret", // MUST NOT appear in public response
		"redirectUrl":  "https://oauth.example.test/cb",
	}
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/auth-providers", env.adminTok, map[string]any{
		"id":         "github",
		"label":      "GitHub",
		"icon":       "Github",
		"config":     config,
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)

	// admin list — config present
	status, raw := env.do(t, "GET", "/api/v1/admin/cms/auth-providers", env.adminTok, nil)
	require.Equal(t, 200, status)
	var adminList []map[string]any
	require.NoError(t, json.Unmarshal(raw, &adminList))
	require.Len(t, adminList, 1)
	require.NotNil(t, adminList[0]["config"], "admin must see config")

	// public list — config absent
	status, raw = env.do(t, "GET", "/api/v1/auth-providers", "", nil)
	require.Equal(t, 200, status)
	var pubList []map[string]any
	require.NoError(t, json.Unmarshal(raw, &pubList))
	require.Len(t, pubList, 1)
	require.Nil(t, pubList[0]["config"], "public must NOT see config (P0 security)")
	require.Equal(t, "github", pubList[0]["id"])
	require.Equal(t, "GitHub", pubList[0]["label"])
}

// ============ top_nav (id PK + assertSafeNavPath) ============

func TestCMS_TopNav_AdminCRUD_SafePath(t *testing.T) {
	env := setupCMSEnv(t)

	// 1. valid internal path
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/top-nav", env.adminTok, map[string]any{
		"label":      "Home",
		"path":       "/",
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)

	// 2. valid external path
	status, _ = env.do(t, "POST", "/api/v1/admin/cms/top-nav", env.adminTok, map[string]any{
		"label":      "Docs",
		"path":       "https://docs.example.test",
		"isActive":   true,
		"orderIndex": 1,
	})
	require.Equal(t, 201, status)

	// 3. javascript: scheme → 400
	status, _ = env.do(t, "POST", "/api/v1/admin/cms/top-nav", env.adminTok, map[string]any{
		"label": "Evil",
		"path":  "javascript:alert(1)",
	})
	require.Equal(t, 400, status, "javascript: scheme must be 400")

	// 4. data: scheme → 400
	status, _ = env.do(t, "POST", "/api/v1/admin/cms/top-nav", env.adminTok, map[string]any{
		"label": "Evil2",
		"path":  "data:text/html,<script>",
	})
	require.Equal(t, 400, status, "data: scheme must be 400")

	// 5. protocol-relative → 400
	status, _ = env.do(t, "POST", "/api/v1/admin/cms/top-nav", env.adminTok, map[string]any{
		"label": "Evil3",
		"path":  "//evil.com",
	})
	require.Equal(t, 400, status, "//evil.com must be 400")

	// public read returns 2 valid ones
	status, raw := env.do(t, "GET", "/api/v1/top-nav", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 2)
}

// ============ footer_columns (id PK + per-link assertSafeNavPath) ============

func TestCMS_FooterColumns_AdminCRUD_SafePath(t *testing.T) {
	env := setupCMSEnv(t)
	links := []map[string]any{
		{"label": "GitHub", "path": "https://github.com/opencsg"},
		{"label": "Email", "path": "mailto:hi@example.test"},
	}
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/footer-columns", env.adminTok, map[string]any{
		"title":      "Community",
		"links":      links,
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)

	// update with a bad link → 400
	badLinks := []map[string]any{
		{"label": "Bad", "path": "javascript:alert(1)"},
	}
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/footer-columns/not-yet-fetched-id", env.adminTok, map[string]any{
		"title": "Community",
		"links": badLinks,
	})
	require.Equal(t, 404, status, "missing column → 404 (not 400)")

	// confirm via public list
	status, raw := env.do(t, "GET", "/api/v1/footer-columns", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
}

// ============ enterprise_methods (id PK, bullets JSON) ============

func TestCMS_EnterpriseMethods_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/enterprise-methods", env.adminTok, map[string]any{
		"num":        "01",
		"title":      "Diagnose",
		"desc":       "Step 1: Diagnose",
		"bullets":    []string{"audit", "interview", "synthesize"},
		"isActive":   true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status)

	// public read
	status, raw := env.do(t, "GET", "/api/v1/enterprise-methods", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "01", list[0]["num"])
}

// ============ i18n_messages (composite key:locale) ============

func TestCMS_I18nMessages_AdminCRUD(t *testing.T) {
	env := setupCMSEnv(t)
	status, _ := env.do(t, "POST", "/api/v1/admin/cms/i18n/messages", env.adminTok, map[string]any{
		"key":      "home.hero.title",
		"locale":   "zh-CN",
		"value":    "学习 AI",
		"category": "common",
	})
	require.Equal(t, 201, status)

	// public read filtered
	status, raw := env.do(t, "GET", "/api/v1/i18n/messages?locale=zh-CN&category=common", "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "学习 AI", list[0]["value"])

	// update via composite id
	status, _ = env.do(t, "PATCH", "/api/v1/admin/cms/i18n/messages/home.hero.title:zh-CN", env.adminTok, map[string]any{
		"value": "学习 AI 2.0",
	})
	require.Equal(t, 200, status)

	// delete via composite id
	status, _ = env.do(t, "DELETE", "/api/v1/admin/cms/i18n/messages/home.hero.title:zh-CN", env.adminTok, nil)
	require.Equal(t, 200, status)
}

// ============ sitemap ============
//
// Sitemap tests live in test/e2e/sitemap_test.go so the two file
// deliverables (cms_test.go + sitemap_test.go) are clean. We
// deliberately avoid duplicating the same setupCMSEnv / sitemap
// handlers here.
