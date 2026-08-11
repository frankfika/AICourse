// Package e2e — instructors module end-to-end test.
//
// Phase 2 T20: covers the 12 endpoints of
// apps/api/src/modules/instructors/instructors.controller.ts.
//
// Public surface (2): list (published only) + detail by slug.
// Admin surface (10): list/get/create/update/soft-delete/reorder +
// course-links list/add/remove/bulk-replace.
//
// Uses dockertest MySQL + real Prisma-derived schema, same as T12-1
// (courses). All mutations write to the real DB; we read back via
// direct SQL to verify the rows landed (no mocking).
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
	"github.com/frankfika/ai-academy/api-go/internal/instructors"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type instructorsTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
	adminID  string
}

func setupInstructorsEnv(t *testing.T) *instructorsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_instructors_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_instructors_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	// Bootstrap admin + student directly in DB.
	adminID := insertInstructorUserDirect(t, db, "admin-ins@example.test", "Admin Ins", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, "admin-ins@example.test", "Str0ngP@ssw0rd!!")

	insRepo := instructors.NewRepo(db)
	insSvc := instructors.NewService(insRepo, log)
	insExpertiseSvc := instructors.NewExpertiseService(insRepo, log)
	insH := handler.NewInstructorsHandler(insSvc, insExpertiseSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-instructors",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	insH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &instructorsTestEnv{app: app, db: db, log: log, adminTok: adminTok, adminID: adminID}
}

// do is a small test helper that mirrors notes_test.go / courses_test.go
// so we share the convention across e2e files.
func (e *instructorsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

// ============ shared helpers ============

// insertInstructorUserDirect writes a user row directly with a known
// password hash. We don't reuse insertUserDirect from courses_test.go
// because Go test files share a package and the symbol might not be
// visible from the same package — keeping our own avoids the
// dependency on a particular test file load order.
func insertInstructorUserDirect(t *testing.T, db *sql.DB, email, name, role, password string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(password), 4)
	require.NoError(t, err)
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err = db.ExecContext(context.Background(), `
		INSERT INTO users (id, email, password_hash, name, role, password_reset_required, points, level, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)
	`, id, email, string(h), name, role, now, now)
	require.NoError(t, err)
	return id
}

// registerInstructorStudent creates a student via /auth/register and
// returns the access token. Mirrors the courses_test.go helper.
func (e *instructorsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

// insertCourseDirect writes a course row for the course-link tests.
func (e *instructorsTestEnv) insertCourseDirect(t *testing.T, title, status string) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.Exec(`
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES (?, ?, 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, ?, 'own', ?, ?)
	`, id, title, status, now, now)
	require.NoError(t, err)
	return id
}

// sampleInstructor is the minimum valid payload for POST.
func sampleInstructor(name string) map[string]any {
	return map[string]any{
		"name":  name,
		"title": "Test Instructor",
		"bio":   "Markdown bio",
	}
}

// ============ TESTS ============

// T20 #1: public list — only published.
func TestInstructors_PublicList_OnlyPublished(t *testing.T) {
	env := setupInstructorsEnv(t)
	// Seed one published + one draft directly in DB.
	insertInstructorDirect(t, env.db, "Zhang San", "published")
	insertInstructorDirect(t, env.db, "Li Si", "draft")

	status, raw := env.do(t, "GET", "/api/v1/instructors", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var resp struct {
		Items []map[string]any `json:"items"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 1, resp.Total, "public should only see published")
	require.Equal(t, "Zhang San", resp.Items[0]["name"])
}

// T20 #2: public detail by slug.
func TestInstructors_PublicDetail_BySlug(t *testing.T) {
	env := setupInstructorsEnv(t)
	insertInstructorDirect(t, env.db, "Wang Wu", "published")

	status, raw := env.do(t, "GET", "/api/v1/instructors/wang-wu", "", nil)
	require.Equal(t, 200, status, "detail: %s", string(raw))
	var v map[string]any
	require.NoError(t, json.Unmarshal(raw, &v))
	require.Equal(t, "Wang Wu", v["name"])
	require.Equal(t, "wang-wu", v["slug"])
}

// T20 #11: public detail — not found → 404.
func TestInstructors_PublicDetail_NotFound_404(t *testing.T) {
	env := setupInstructorsEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/instructors/does-not-exist", "", nil)
	require.Equal(t, 404, status)
}

// T20 #10: unauthenticated admin → 401.
func TestInstructors_AdminList_Unauthenticated_401(t *testing.T) {
	env := setupInstructorsEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/admin/instructors", "", nil)
	require.Equal(t, 401, status)
}

// T20 #3: admin list — student forbidden, admin sees all.
func TestInstructors_AdminList_StudentForbidden_AdminSeesAll(t *testing.T) {
	env := setupInstructorsEnv(t)
	insertInstructorDirect(t, env.db, "P1", "published")
	insertInstructorDirect(t, env.db, "D1", "draft")

	studentTok, _ := env.registerStudent(t, makeEmail("ins-stu"))
	status, _ := env.do(t, "GET", "/api/v1/admin/instructors", studentTok, nil)
	require.Equal(t, 403, status, "student must be 403 on admin list")

	status, raw := env.do(t, "GET", "/api/v1/admin/instructors", env.adminTok, nil)
	require.Equal(t, 200, status)
	var resp struct {
		Total int `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, 2, resp.Total, "admin sees all")
}

// T20 #4: admin create + detail + slug auto-gen.
func TestInstructors_AdminCreate_And_Detail(t *testing.T) {
	env := setupInstructorsEnv(t)
	status, raw := env.do(t, "POST", "/api/v1/admin/instructors", env.adminTok, sampleInstructor("Zhao Liu"))
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created map[string]any
	require.NoError(t, json.Unmarshal(raw, &created))
	id := created["id"].(string)
	require.NotEmpty(t, id)
	require.Equal(t, "Zhao Liu", created["name"])
	// auto-generated slug from ascii name
	require.Equal(t, "zhao-liu", created["slug"])

	// Detail by id
	status, raw = env.do(t, "GET", "/api/v1/admin/instructors/"+id, env.adminTok, nil)
	require.Equal(t, 200, status)
	var detail map[string]any
	require.NoError(t, json.Unmarshal(raw, &detail))
	require.Equal(t, "Zhao Liu", detail["name"])

	// Verify DB row landed
	var dbSlug, dbName string
	var publishedAt sql.NullTime
	require.NoError(t, env.db.QueryRow(
		`SELECT slug, name, published_at FROM instructors WHERE id = ?`, id,
	).Scan(&dbSlug, &dbName, &publishedAt))
	require.Equal(t, "zhao-liu", dbSlug)
	require.Equal(t, "Zhao Liu", dbName)
	require.False(t, publishedAt.Valid, "should be draft by default")
}

// T20 #4b: explicit slug collides → 409.
func TestInstructors_AdminCreate_SlugConflict_409(t *testing.T) {
	env := setupInstructorsEnv(t)
	insertInstructorDirect(t, env.db, "AAA", "published") // slug = aaa

	body := map[string]any{"name": "Other", "slug": "aaa"}
	status, _ := env.do(t, "POST", "/api/v1/admin/instructors", env.adminTok, body)
	require.Equal(t, 409, status, "duplicate slug should be 409")
}

// T20 #5: admin update — partial fields.
func TestInstructors_AdminUpdate_Partial(t *testing.T) {
	env := setupInstructorsEnv(t)
	id := insertInstructorDirect(t, env.db, "Old Name", "draft")

	// Update title + publish
	patch := map[string]any{
		"title":     "New Title",
		"published": true,
	}
	status, raw := env.do(t, "PATCH", "/api/v1/admin/instructors/"+id, env.adminTok, patch)
	require.Equal(t, 200, status, "update: %s", string(raw))
	var upd map[string]any
	require.NoError(t, json.Unmarshal(raw, &upd))
	require.Equal(t, "New Title", upd["title"])
	require.NotNil(t, upd["publishedAt"], "publishedAt should be set")

	// Verify in DB
	var title string
	var publishedAt sql.NullTime
	require.NoError(t, env.db.QueryRow(
		`SELECT title, published_at FROM instructors WHERE id = ?`, id,
	).Scan(&title, &publishedAt))
	require.Equal(t, "New Title", title)
	require.True(t, publishedAt.Valid, "DB should have published_at")
}

// T20 #6: admin soft delete — published_at → NULL.
func TestInstructors_AdminSoftDelete(t *testing.T) {
	env := setupInstructorsEnv(t)
	id := insertInstructorDirect(t, env.db, "Doomed", "published")

	status, raw := env.do(t, "DELETE", "/api/v1/admin/instructors/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// Verify published_at is NULL
	var publishedAt sql.NullTime
	require.NoError(t, env.db.QueryRow(
		`SELECT published_at FROM instructors WHERE id = ?`, id,
	).Scan(&publishedAt))
	require.False(t, publishedAt.Valid, "soft-delete must null out published_at")

	// 404 for public detail
	status, _ = env.do(t, "GET", "/api/v1/instructors/doomed", "", nil)
	require.Equal(t, 404, status, "public should not see soft-deleted")

	// 200 for admin detail (admin can still see the row)
	status, _ = env.do(t, "GET", "/api/v1/admin/instructors/"+id, env.adminTok, nil)
	require.Equal(t, 200, status, "admin can still see the row")
}

// T20 #7: admin reorder — drag-sort.
func TestInstructors_AdminReorder(t *testing.T) {
	env := setupInstructorsEnv(t)
	a := insertInstructorDirect(t, env.db, "Alpha", "published")
	b := insertInstructorDirect(t, env.db, "Beta", "published")
	c := insertInstructorDirect(t, env.db, "Gamma", "published")

	// Reorder: c, a, b
	body := map[string]any{"orderedIds": []string{c, a, b}}
	status, raw := env.do(t, "POST", "/api/v1/admin/instructors/reorder", env.adminTok, body)
	require.Equal(t, 200, status, "reorder: %s", string(raw))
	var resp map[string]any
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, float64(3), resp["reordered"])

	// Verify order_index in DB
	rows, err := env.db.Query(`SELECT id, order_index FROM instructors WHERE id IN (?, ?, ?) ORDER BY order_index ASC`, a, b, c)
	require.NoError(t, err)
	defer rows.Close()
	order := []string{}
	for rows.Next() {
		var id string
		var idx int32
		require.NoError(t, rows.Scan(&id, &idx))
		order = append(order, id)
	}
	require.Equal(t, []string{c, a, b}, order, "reorder should match new positions")
}

// T20 #7b: reorder with bad ID → 400.
func TestInstructors_AdminReorder_BadID_400(t *testing.T) {
	env := setupInstructorsEnv(t)
	body := map[string]any{"orderedIds": []string{"not-a-real-id"}}
	status, _ := env.do(t, "POST", "/api/v1/admin/instructors/reorder", env.adminTok, body)
	require.Equal(t, 400, status)
}

// T20 #8: course-links — add + list + remove.
func TestInstructors_CourseLinks_Add_List_Remove(t *testing.T) {
	env := setupInstructorsEnv(t)
	insID := insertInstructorDirect(t, env.db, "Pro", "published")
	courseID := env.insertCourseDirect(t, "Course A", "published")

	// Initially empty
	status, raw := env.do(t, "GET", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var initial []map[string]any
	require.NoError(t, json.Unmarshal(raw, &initial))
	require.Empty(t, initial)

	// Add link (instructor, not primary)
	status, raw = env.do(t, "POST", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, map[string]any{
		"courseId":   courseID,
		"role":       "instructor",
		"isPrimary":  true,
		"orderIndex": 0,
	})
	require.Equal(t, 201, status, "add: %s", string(raw))
	var link map[string]any
	require.NoError(t, json.Unmarshal(raw, &link))
	linkID := link["id"].(string)
	require.Equal(t, true, link["isPrimary"])
	require.Equal(t, "instructor", link["role"])
	require.NotEmpty(t, link["courseTitle"], "courseTitle should be populated from join")

	// List now has 1
	status, raw = env.do(t, "GET", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, nil)
	require.Equal(t, 200, status)
	var after []map[string]any
	require.NoError(t, json.Unmarshal(raw, &after))
	require.Len(t, after, 1)

	// Verify DB row landed
	var dbCount int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM course_instructor_links WHERE instructor_id = ? AND course_id = ?`,
		insID, courseID,
	).Scan(&dbCount))
	require.Equal(t, 1, dbCount)

	// Remove
	status, raw = env.do(t, "DELETE", "/api/v1/admin/instructors/course-links/"+linkID, env.adminTok, nil)
	require.Equal(t, 200, status, "remove: %s", string(raw))

	// DB row gone
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM course_instructor_links WHERE id = ?`, linkID,
	).Scan(&dbCount))
	require.Equal(t, 0, dbCount)
}

// T20 #8b: course-link add — mentor role forces isPrimary=false.
func TestInstructors_CourseLinks_MentorForcesNotPrimary(t *testing.T) {
	env := setupInstructorsEnv(t)
	insID := insertInstructorDirect(t, env.db, "Mentor", "published")
	courseID := env.insertCourseDirect(t, "Course B", "published")

	status, raw := env.do(t, "POST", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, map[string]any{
		"courseId":  courseID,
		"role":      "mentor",
		"isPrimary": true, // should be forced to false
	})
	require.Equal(t, 201, status, "add mentor: %s", string(raw))
	var link map[string]any
	require.NoError(t, json.Unmarshal(raw, &link))
	require.Equal(t, false, link["isPrimary"], "mentor role forces isPrimary=false")
}

// T20 #9: bulk replace — PUT /admin/instructors/:id/course-links.
func TestInstructors_CourseLinks_BulkReplace(t *testing.T) {
	env := setupInstructorsEnv(t)
	insID := insertInstructorDirect(t, env.db, "Multi", "published")
	c1 := env.insertCourseDirect(t, "C1", "published")
	c2 := env.insertCourseDirect(t, "C2", "published")
	c3 := env.insertCourseDirect(t, "C3", "published")

	// Seed two initial links
	for _, cid := range []string{c1, c2} {
		status, _ := env.do(t, "POST", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, map[string]any{
			"courseId": cid, "role": "instructor",
		})
		require.Equal(t, 201, status)
	}

	// Replace with [c2, c3] — c1 should be gone, c3 fresh
	body := map[string]any{
		"links": []map[string]any{
			{"courseId": c2, "role": "instructor", "isPrimary": true, "orderIndex": 0},
			{"courseId": c3, "role": "mentor", "orderIndex": 1},
		},
	}
	status, raw := env.do(t, "PUT", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, body)
	require.Equal(t, 200, status, "sync: %s", string(raw))
	var resp map[string]any
	require.NoError(t, json.Unmarshal(raw, &resp))
	links := resp["links"].([]any)
	require.Len(t, links, 2)

	// Verify DB: c1 is gone, c2 + c3 are present
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM course_instructor_links WHERE instructor_id = ? AND course_id = ?`, insID, c1,
	).Scan(&n))
	require.Equal(t, 0, n, "c1 should be deleted")
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM course_instructor_links WHERE instructor_id = ?`, insID,
	).Scan(&n))
	require.Equal(t, 2, n, "should have 2 links total")
}

// T20 #9b: bulk replace with two primary instructor links → 400.
func TestInstructors_CourseLinks_BulkReplace_TwoPrimaries_400(t *testing.T) {
	env := setupInstructorsEnv(t)
	insID := insertInstructorDirect(t, env.db, "Multi", "published")
	c1 := env.insertCourseDirect(t, "C1", "published")
	c2 := env.insertCourseDirect(t, "C2", "published")

	body := map[string]any{
		"links": []map[string]any{
			{"courseId": c1, "role": "instructor", "isPrimary": true},
			{"courseId": c2, "role": "instructor", "isPrimary": true},
		},
	}
	status, _ := env.do(t, "PUT", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, body)
	require.Equal(t, 400, status, "two primary instructors must be 400")
}

// T20 #6b: soft-delete cascade — instructor's course links are unlinked.
func TestInstructors_AdminSoftDelete_UnlinksCourses(t *testing.T) {
	env := setupInstructorsEnv(t)
	insID := insertInstructorDirect(t, env.db, "Cascade", "published")
	courseID := env.insertCourseDirect(t, "Cascade Course", "published")

	// Attach link
	status, _ := env.do(t, "POST", "/api/v1/admin/instructors/"+insID+"/course-links", env.adminTok, map[string]any{
		"courseId": courseID, "role": "instructor",
	})
	require.Equal(t, 201, status)

	// Soft-delete the instructor
	status, _ = env.do(t, "DELETE", "/api/v1/admin/instructors/"+insID, env.adminTok, nil)
	require.Equal(t, 200, status)

	// Verify links are gone
	var n int
	require.NoError(t, env.db.QueryRow(
		`SELECT COUNT(*) FROM course_instructor_links WHERE instructor_id = ?`, insID,
	).Scan(&n))
	require.Equal(t, 0, n, "soft-delete must cascade-unlink course assignments")
}

// ============ test-only insert helpers ============

// insertInstructorDirect writes an instructor row in the requested
// published/draft state. Used to seed the public/admin visibility tests.
func insertInstructorDirect(t *testing.T, db *sql.DB, name, published string) string {
	t.Helper()
	id := "c" + uuid.NewString()[:24] // match generateInstructorID shape
	now := time.Now().UTC()
	slug := slugifyForTest(name)
	var publishedAt sql.NullTime
	if published == "published" {
		publishedAt = sql.NullTime{Time: now, Valid: true}
	}
	_, err := db.Exec(`
		INSERT INTO instructors (id, slug, name, title, order_index, published_at, created_at, updated_at)
		VALUES (?, ?, ?, 'Test', 0, ?, ?, ?)
	`, id, slug, name, publishedAt, now, now)
	require.NoError(t, err)
	return id
}

// slugifyForTest is a tiny mirror of the production slugifier for use
// in DB seed inserts. Production logic is in internal/instructors/.
func slugifyForTest(name string) string {
	out := make([]byte, 0, len(name))
	prevDash := false
	for i := 0; i < len(name); i++ {
		c := name[i]
		switch {
		case c >= 'A' && c <= 'Z':
			out = append(out, c+32)
			prevDash = false
		case c >= 'a' && c <= 'z', c >= '0' && c <= '9':
			out = append(out, c)
			prevDash = false
		default:
			if !prevDash && len(out) > 0 {
				out = append(out, '-')
				prevDash = true
			}
		}
	}
	for len(out) > 0 && out[len(out)-1] == '-' {
		out = out[:len(out)-1]
	}
	if len(out) == 0 {
		return "i-test"
	}
	return string(out)
}
