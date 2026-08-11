// Package e2e — badges module end-to-end test.
//
// Phase 2 T14-2: covers the 6 /api/v1/badges/* endpoints.
//
//	GET    /badges              list active (public)
//	GET    /badges/me           my badge wall (auth)
//	POST   /badges              create (admin)
//	PATCH  /badges/:id          update (admin)
//	DELETE /badges/:id          delete (admin)
//	GET    /badges/admin/stats  admin stats (admin)
//
// Mirrors apps/api/src/modules/badges/badges.controller.ts 1:1.
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
	"github.com/frankfika/ai-academy/api-go/internal/badges"
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

type badgesTestEnv struct {
	app      *fiber.App
	db       *sql.DB
	log      *zap.Logger
	adminTok string
}

func setupBadgesEnv(t *testing.T) *badgesTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_badges_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_badges_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	adminEmail := makeEmail("bdg-admin")
	_ = insertUserDirect(t, db, adminEmail, "Admin Badges", "admin", "Str0ngP@ssw0rd!!")
	adminTok, _ := loginAs(t, db, cfg, adminEmail, "Str0ngP@ssw0rd!!")

	badgesRepo := badges.NewRepo(db)
	badgesSvc := badges.NewService(badgesRepo, log)
	badgesH := handler.NewBadgesHandler(badgesSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-badges",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	badgesH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &badgesTestEnv{app: app, db: db, log: log, adminTok: adminTok}
}

func (e *badgesTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *badgesTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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
	require.NotEmpty(t, out.AccessToken)
	return out.AccessToken, out.User.ID
}

func (e *badgesTestEnv) insertBadge(t *testing.T, code, criteriaType string, criteriaValue int32) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO badges (id, code, name, description, icon, category, criteria_type, criteria_value, points, is_active, order_index, updated_at)
		VALUES (?, ?, ?, 'x', 'award', 'general', ?, ?, 0, 1, 0, ?)
	`, id, code, code, criteriaType, criteriaValue, now)
	require.NoError(t, err)
	return id
}

func (e *badgesTestEnv) setPoints(t *testing.T, userID string, pts int32) {
	t.Helper()
	_, err := e.db.Exec(`UPDATE users SET points = ? WHERE id = ?`, pts, userID)
	require.NoError(t, err)
}

// ============ TESTS ============

func TestBadges_Unauthenticated_401(t *testing.T) {
	env := setupBadgesEnv(t)
	// /me requires auth
	status, _ := env.do(t, "GET", "/api/v1/badges/me", "", nil)
	require.Equal(t, 401, status)
	// Admin routes
	status, _ = env.do(t, "POST", "/api/v1/badges", "", map[string]any{})
	require.Equal(t, 401, status)
}

func TestBadges_NonAdmin_403(t *testing.T) {
	env := setupBadgesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("bdg-stu"))

	status, _ := env.do(t, "POST", "/api/v1/badges", tok, map[string]any{
		"code": "x", "name": "X", "criteriaType": "first_enrollment",
	})
	require.Equal(t, 403, status)
}

func TestBadges_PublicList_OnlyActive(t *testing.T) {
	env := setupBadgesEnv(t)
	// Insert active + inactive
	env.insertBadge(t, "act1", "first_enrollment", 1)
	inactiveID := uuid.NewString()
	now := time.Now().UTC()
	_, err := env.db.Exec(`INSERT INTO badges (id, code, name, description, icon, category, criteria_type, criteria_value, points, is_active, order_index, updated_at)
		VALUES (?, 'inact', 'Inactive', 'x', 'award', 'general', 'first_enrollment', 1, 0, 0, 0, ?)`, inactiveID, now)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/api/v1/badges", "", nil)
	require.Equal(t, 200, status, "list: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1, "public should only see active")
	require.Equal(t, "act1", list[0]["code"])
}

func TestBadges_AdminCreate_AndUpdate_AndDelete(t *testing.T) {
	env := setupBadgesEnv(t)

	// Create
	status, raw := env.do(t, "POST", "/api/v1/badges", env.adminTok, map[string]any{
		"code":          "first_enroll",
		"name":          "First enrollment",
		"description":   "Enroll in your first course",
		"criteriaType":  "first_enrollment",
		"criteriaValue": 1,
		"points":        10,
	})
	require.Equal(t, 201, status, "create: %s", string(raw))
	var created struct {
		ID       string `json:"id"`
		Code     string `json:"code"`
		IsActive bool   `json:"isActive"`
		Points   int32  `json:"points"`
	}
	require.NoError(t, json.Unmarshal(raw, &created))
	require.Equal(t, "first_enroll", created.Code)
	require.True(t, created.IsActive, "default isActive=true")
	require.Equal(t, int32(10), created.Points)

	// Bad criteria type
	status, raw = env.do(t, "POST", "/api/v1/badges", env.adminTok, map[string]any{
		"code": "x", "name": "X", "criteriaType": "weird",
	})
	require.Equal(t, 400, status, "bad criteriaType: %s", string(raw))

	// Duplicate code
	status, raw = env.do(t, "POST", "/api/v1/badges", env.adminTok, map[string]any{
		"code": "first_enroll", "name": "Dup", "criteriaType": "first_enrollment",
	})
	require.Equal(t, 409, status, "dup code: %s", string(raw))

	// Update
	status, raw = env.do(t, "PATCH", "/api/v1/badges/"+created.ID, env.adminTok, map[string]any{
		"name":     "First enrollment v2",
		"isActive": false,
		"points":   20,
	})
	require.Equal(t, 200, status, "update: %s", string(raw))
	var updated struct {
		Name     string `json:"name"`
		Points   int32  `json:"points"`
		IsActive bool   `json:"isActive"`
	}
	require.NoError(t, json.Unmarshal(raw, &updated))
	require.Equal(t, "First enrollment v2", updated.Name)
	require.Equal(t, int32(20), updated.Points)
	require.False(t, updated.IsActive)

	// Delete
	status, raw = env.do(t, "DELETE", "/api/v1/badges/"+created.ID, env.adminTok, nil)
	require.Equal(t, 200, status, "delete: %s", string(raw))

	// Verify gone
	status, _ = env.do(t, "GET", "/api/v1/badges", "", nil)
	require.Equal(t, 200, status)
}

func TestBadges_Me_NoBadgesYet(t *testing.T) {
	env := setupBadgesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("bdg-empty"))

	status, raw := env.do(t, "GET", "/api/v1/badges/me", tok, nil)
	require.Equal(t, 200, status, "me: %s", string(raw))
	var list []map[string]any
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Empty(t, list, "no badges configured yet")
}

func TestBadges_Me_WithProgress_NotUnlocked(t *testing.T) {
	env := setupBadgesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("bdg-progress"))
	// PointsReached badge — user has 50 points, target is 100
	env.insertBadge(t, "p100", "points_reached", 100)
	// Set user points to 50
	// First get user id from /auth/me
	req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, _ := env.app.Test(req, -1)
	var me struct {
		ID string `json:"id"`
	}
	body, _ := io.ReadAll(resp.Body)
	require.NoError(t, json.Unmarshal(body, &me))
	resp.Body.Close()
	env.setPoints(t, me.ID, 50)

	status, raw := env.do(t, "GET", "/api/v1/badges/me", tok, nil)
	require.Equal(t, 200, status, "me: %s", string(raw))
	var list []struct {
		Badge struct {
			Code string `json:"code"`
		} `json:"badge"`
		Unlocked bool  `json:"unlocked"`
		Progress int32 `json:"progress"`
		Target   int32 `json:"target"`
	}
	require.NoError(t, json.Unmarshal(raw, &list))
	require.Len(t, list, 1)
	require.Equal(t, "p100", list[0].Badge.Code)
	require.False(t, list[0].Unlocked, "should not be unlocked (50 < 100)")
	require.Equal(t, int32(50), list[0].Progress)
	require.Equal(t, int32(100), list[0].Target)
}

func TestBadges_AdminStats(t *testing.T) {
	env := setupBadgesEnv(t)
	env.insertBadge(t, "s1", "first_enrollment", 1)
	env.insertBadge(t, "s2", "points_reached", 50)

	status, raw := env.do(t, "GET", "/api/v1/badges/admin/stats", env.adminTok, nil)
	require.Equal(t, 200, status, "stats: %s", string(raw))
	var stats struct {
		TotalUsers          int64            `json:"totalUsers"`
		TotalBadgesUnlocked int64            `json:"totalBadgesUnlocked"`
		BadgeDistribution   []map[string]any `json:"badgeDistribution"`
		Leaderboard         []map[string]any `json:"leaderboard"`
	}
	require.NoError(t, json.Unmarshal(raw, &stats))
	require.GreaterOrEqual(t, stats.TotalUsers, int64(1), "at least the admin user")
	require.Equal(t, int64(0), stats.TotalBadgesUnlocked, "no unlocks yet")
	require.Empty(t, stats.BadgeDistribution, "no unlocks")
	require.NotEmpty(t, stats.Leaderboard, "admin should be in leaderboard")
}

func TestBadges_AdminStats_RequiresAdmin(t *testing.T) {
	env := setupBadgesEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("bdg-stats-stu"))

	status, _ := env.do(t, "GET", "/api/v1/badges/admin/stats", tok, nil)
	require.Equal(t, 403, status, "non-admin must be 403")
}
