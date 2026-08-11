// Package e2e — practices module end-to-end test.
//
// Phase 2 T14-4: covers the 11 /api/v1/practices/* endpoints.
//
//	GET    /practices/courses/:courseId                  public list
//	GET    /practices/courses/:courseId/access           auth list
//	GET    /practices/admin/courses/:courseId            admin list
//	GET    /practices/:id                                get one
//	POST   /practices                                    admin create
//	PATCH  /practices/:id                                admin update
//	DELETE /practices/:id                                admin delete
//	GET    /practices/user/progress                      auth my progress
//	POST   /practices/:id/start                          auth start
//	POST   /practices/:id/complete                       auth complete
//	POST   /practices/:id/skip                           auth skip
//
// Mirrors apps/api/src/modules/practices/practices.controller.ts 1:1.
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
	"github.com/frankfika/ai-academy/api-go/internal/practices"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type practicesTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupPracticesEnv(t *testing.T) *practicesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_practices_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_practices_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("pra-admin")
	_ = insertUserDirect(t, db, adminEmail, "Admin Practices", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	practicesRepo := practices.NewRepo(db)
	practicesSvc := practices.NewService(practicesRepo, log)
	practicesH := handler.NewPracticesHandler(practicesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-practices",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	practicesH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &practicesTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *practicesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *practicesTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

func (e *practicesTestEnv) insertCourse(t *testing.T, title, costType string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', ?, 0, 'published', 'own', ?, ?)
	`, id, title, costType, now, now)
	require.NoError(t, err)
	return id
}

func (e *practicesTestEnv) insertProject(t *testing.T, courseID, title string, isActive bool) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO practice_projects
		  (id, course_id, title, description, project_url, difficulty, estimated_time, project_type, order_index, is_active, updated_at)
		VALUES (?, ?, ?, 'desc', 'https://example.com/p', 'intermediate', 30, 'notebook', 0, ?, ?)
	`, id, courseID, title, isActive, now)
	require.NoError(t, err)
	return id
}

func (e *practicesTestEnv) sampleProject(courseID string) map[string]any {
	return map[string]any{
		"courseId":      courseID,
		"title":         "Sample Project",
		"description":   "Build a small app",
		"projectUrl":    "https://example.com/p",
		"difficulty":    "intermediate",
		"estimatedTime": 30,
		"projectType":   "notebook",
		"orderIndex":    0,
		"isActive":      true,
	}
}

// ============ TESTS ============

func TestPractices_Unauthenticated_401(t *testing.T) {
	env := setupPracticesEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/practices/user/progress", "", nil)
	require.Equal(t, 401, status)
}

func TestPractices_ListByCourse_OnlyActive(t *testing.T) {
	env := setupPracticesEnv(t)
	courseID := env.insertCourse(t, "P-Free", "free")
	activeID := env.insertProject(t, courseID, "Active", true)
	env.insertProject(t, courseID, "Inactive", false)

	status, raw := env.do(t, "GET", "/api/v1/practices/courses/"+courseID, "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "public should only see active")
	require.Equal(t, activeID, list[0]["id"])
}

func TestPractices_ListByCourse_HidesProjectUrlForAnonymous(t *testing.T) {
	env := setupPracticesEnv(t)
	courseID := env.insertCourse(t, "HideURL", "free")
	env.insertProject(t, courseID, "HasURL", true)

	status, raw := env.do(t, "GET", "/api/v1/practices/courses/"+courseID, "", nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "", list[0]["projectUrl"], "projectUrl should be gated for anon")
}

func TestPractices_AdminList_AllProjects(t *testing.T) {
	env := setupPracticesEnv(t)
	courseID := env.insertCourse(t, "P-Admin", "free")
	env.insertProject(t, courseID, "A1", true)
	env.insertProject(t, courseID, "A2", false)

	status, raw := env.do(t, "GET", "/api/v1/practices/admin/courses/"+courseID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 2, "admin should see all")
}

func TestPractices_AdminList_RequiresAdmin(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-stu"))
	courseID := env.insertCourse(t, "P-AdminOnly", "free")

	status, _ := env.do(t, "GET", "/api/v1/practices/admin/courses/"+courseID, tok, nil)
	require.Equal(t, 403, status)
}

func TestPractices_GetByID_ProjectUrlForAdmin(t *testing.T) {
	env := setupPracticesEnv(t)
	courseID := env.insertCourse(t, "P-Get", "free")
	projectID := env.insertProject(t, courseID, "P1", true)

	// Admin → projectUrl visible
	status, raw := env.do(t, "GET", "/api/v1/practices/"+projectID, env.adminTok, nil)
	require.Equal(t, 200, status, "admin get: %s", string(raw))
	var resp struct {
		Project map[string]any `json:"project"`
		Course  map[string]any `json:"course"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, "https://example.com/p", resp.Project["projectUrl"], "admin sees projectUrl")
	require.Equal(t, courseID, resp.Course["id"])
}

func TestPractices_AdminCreate_AndUpdate_AndDelete(t *testing.T) {
	env := setupPracticesEnv(t)
	courseID := env.insertCourse(t, "P-Create", "free")

	// Create
	status, raw := env.do(t, "POST", "/api/v1/practices", env.adminTok, env.sampleProject(courseID))
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		IsActive bool   `json:"isActive"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "Sample Project", created.Title)
	require.True(t, created.IsActive)

	// Bad difficulty
	bad := env.sampleProject(courseID)
	bad["difficulty"] = "wizard"
	status, _ = env.do(t, "POST", "/api/v1/practices", env.adminTok, bad)
	require.Equal(t, 400, status, "bad difficulty")

	// Bad projectType
	bad2 := env.sampleProject(courseID)
	bad2["projectType"] = "weird"
	status, _ = env.do(t, "POST", "/api/v1/practices", env.adminTok, bad2)
	require.Equal(t, 400, status, "bad projectType")

	// Update
	status, raw = env.do(t, "PATCH", "/api/v1/practices/"+created.ID, env.adminTok, map[string]any{
		"title":    "Sample Project v2",
		"isActive": false,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated struct {
		Title    string `json:"title"`
		IsActive bool   `json:"isActive"`
	}
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "Sample Project v2", updated.Title)
	require.False(t, updated.IsActive)

	// Delete
	status, _ = env.do(t, "DELETE", "/api/v1/practices/"+created.ID, env.adminTok, nil)
	require.Equal(t, 200, status)
}

func TestPractices_StartProject_RequiresEnrollment_ForPaid(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-paid"))
	courseID := env.insertCourse(t, "Paid Course", "paid")
	projectID := env.insertProject(t, courseID, "P", true)

	// Paid course + no enrollment → 403
	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 403, status, "paid + no enrollment must be 403: %s", string(raw))
}

func TestPractices_StartProject_FreeCourse_OK(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-free"))
	courseID := env.insertCourse(t, "Free Course", "free")
	projectID := env.insertProject(t, courseID, "P", true)

	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 201, status, "start free: %s", string(raw))
	var comp struct {
		Status    string `json:"status"`
		ProjectID string `json:"projectId"`
	}
	require.NoError(t, json.Unmarshal(raw, &comp))
	require.Equal(t, "in_progress", comp.Status)
	require.Equal(t, projectID, comp.ProjectID)
}

func TestPractices_StartProject_Idempotent(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-twice"))
	courseID := env.insertCourse(t, "Free", "free")
	projectID := env.insertProject(t, courseID, "P", true)

	// First start
	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 201, status)
	var first struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &first))

	// Second start — should return same ID (idempotent)
	status, raw = env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 201, status)
	var second struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(raw, &second))
	require.Equal(t, first.ID, second.ID, "idempotent: same completion ID")
}

func TestPractices_CompleteProject_RequiresStart(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-nostart"))
	courseID := env.insertCourse(t, "Free", "free")
	projectID := env.insertProject(t, courseID, "P", true)

	// Complete without start → 404
	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/complete", tok, map[string]any{})
	require.Equal(t, 404, status, "complete without start must be 404: %s", string(raw))
}

func TestPractices_CompleteProject_Success(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-complete"))
	courseID := env.insertCourse(t, "Free", "free")
	projectID := env.insertProject(t, courseID, "P", true)

	// Start
	status, _ := env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 201, status)

	// Complete
	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/complete", tok, map[string]any{
		"submissionUrl": "https://github.com/me/repo",
		"notes":         "Done!",
	})
	require.Equal(t, 200, status, "complete: %s", string(raw))
	var comp struct {
		Status        string  `json:"status"`
		CompletedAt   *string `json:"completedAt"`
		SubmissionURL *string `json:"submissionUrl"`
		Notes         *string `json:"notes"`
	}
	require.NoError(t, json.Unmarshal(raw, &comp))
	require.Equal(t, "completed", comp.Status)
	require.NotNil(t, comp.CompletedAt)
	require.NotNil(t, comp.SubmissionURL)
	require.Equal(t, "https://github.com/me/repo", *comp.SubmissionURL)
	require.NotNil(t, comp.Notes)
	require.Equal(t, "Done!", *comp.Notes)
}

func TestPractices_SkipProject(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-skip"))
	courseID := env.insertCourse(t, "Free", "free")
	projectID := env.insertProject(t, courseID, "P", true)

	// Start
	status, _ := env.do(t, "POST", "/api/v1/practices/"+projectID+"/start", tok, nil)
	require.Equal(t, 201, status)

	// Skip
	status, raw := env.do(t, "POST", "/api/v1/practices/"+projectID+"/skip", tok, nil)
	require.Equal(t, 200, status, "skip: %s", string(raw))
	var comp struct {
		Status      string  `json:"status"`
		CompletedAt *string `json:"completedAt"`
	}
	require.NoError(t, json.Unmarshal(raw, &comp))
	require.Equal(t, "skipped", comp.Status)
	require.Nil(t, comp.CompletedAt, "skipped should not set completedAt")
}

func TestPractices_UserProgress_EmptyForNewUser(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-empty"))

	status, raw := env.do(t, "GET", "/api/v1/practices/user/progress", tok, nil)
	require.Equal(t, 200, status)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list)
}

func TestPractices_UserProgress_FilterByCourse(t *testing.T) {
	env := setupPracticesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pra-filter"))
	c1 := env.insertCourse(t, "C1", "free")
	c2 := env.insertCourse(t, "C2", "free")
	p1 := env.insertProject(t, c1, "P1", true)
	p2 := env.insertProject(t, c2, "P2", true)

	// Start both
	_, _ = env.do(t, "POST", "/api/v1/practices/"+p1+"/start", tok, nil)
	_, _ = env.do(t, "POST", "/api/v1/practices/"+p2+"/start", tok, nil)

	// Filter by courseId=c1
	status, raw := env.do(t, "GET", "/api/v1/practices/user/progress?courseId="+c1, tok, nil)
	require.Equal(t, 200, status)
	var list []struct {
		Project struct {
			CourseID string `json:"courseId"`
		} `json:"project"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "filter should return only c1")
	require.Equal(t, c1, list[0].Project.CourseID)
}
