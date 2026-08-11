// Package e2e — points module end-to-end test.
//
// Phase 2 T16-2: covers the 1 /api/v1/points/me endpoint.
// Mirrors apps/api/src/modules/points/points.controller.ts.
//
// Tests:
//   - 401 unauthenticated
//   - Fresh user returns 0/1/100/100/100/[]
//   - User with points returns correct level curve
//   - User with transactions returns them in newest-first order
//   - Soft-deleted transactions are excluded
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
	"github.com/frankfika/ai-academy/api-go/internal/points"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/ory/dockertest/v3"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type pointsTestEnv struct {
	app *fiber.App
	db  *sql.DB
	log *zap.Logger
}

func setupPointsEnv(t *testing.T) *pointsTestEnv {
	t.Helper()
	pool, err := dockertest.NewPool("")
	require.NoError(t, err)
	pool.MaxWait = 180 * time.Second

	resource, err := pool.Run("mysql", "8.0", []string{
		"MYSQL_ROOT_PASSWORD=root_pw",
		"MYSQL_DATABASE=ai_academy_points_test",
		"MYSQL_USER=ai_academy",
		"MYSQL_PASSWORD=ai_academy_pass",
	})
	require.NoError(t, err)

	dsn := fmt.Sprintf("ai_academy:ai_academy_pass@tcp(127.0.0.1:%s)/ai_academy_points_test?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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

	pointsRepo := points.NewRepo(db)
	pointsSvc := points.NewService(pointsRepo, log)
	pointsH := handler.NewPointsHandler(pointsSvc, tokens, log)

	app := fiber.New(fiber.Config{
		AppName:      "ai-academy-api-go-e2e-points",
		ErrorHandler: errs.Handler(log),
	})
	app.Use(recover.New())
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	v1 := app.Group("/api/v1")
	authH.Mount(v1)
	pointsH.Mount(v1)

	t.Cleanup(func() {
		_ = db.Close()
		_ = pool.Purge(resource)
		_ = log.Sync()
	})

	return &pointsTestEnv{app: app, db: db, log: log}
}

func (e *pointsTestEnv) do(t *testing.T, method, path, authHeader string, body any) (int, []byte) {
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

func (e *pointsTestEnv) registerStudent(t *testing.T, email string) (string, string) {
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

// setUserPoints directly mutates the user's points + level. Used to
// exercise the level curve without going through the full award flow.
func (e *pointsTestEnv) setUserPoints(t *testing.T, userID string, points, level int32) {
	t.Helper()
	_, err := e.db.ExecContext(context.Background(), `
		UPDATE users SET points = ?, level = ? WHERE id = ?
	`, points, level, userID)
	require.NoError(t, err)
}

// insertPointTransaction writes a ledger row directly. refType +
// refID are optional (pass empty strings to insert NULL).
func (e *pointsTestEnv) insertPointTransaction(t *testing.T, userID, reason, refType, refID string, amount int32, deleted bool) string {
	t.Helper()
	id := uuid.NewString()
	now := time.Now().UTC()
	var rt interface{}
	if refType != "" {
		rt = refType
	}
	var rid interface{}
	if refID != "" {
		rid = refID
	}
	var delAt interface{}
	if deleted {
		delAt = now
	}
	_, err := e.db.ExecContext(context.Background(), `
		INSERT INTO point_transactions (id, user_id, amount, reason, ref_type, ref_id, deleted_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, userID, amount, reason, rt, rid, delAt, now)
	require.NoError(t, err, "insert point transaction")
	return id
}

// ============ TESTS ============

func TestPoints_Unauthenticated_401(t *testing.T) {
	env := setupPointsEnv(t)
	status, _ := env.do(t, "GET", "/api/v1/points/me", "", nil)
	require.Equal(t, 401, status)
}

func TestPoints_FreshUser_ZeroLevelOne(t *testing.T) {
	env := setupPointsEnv(t)
	tok, _ := env.registerStudent(t, makeEmail("pt-fresh"))

	status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
	require.Equal(t, 200, status, "get: %s", string(raw))
	var resp struct {
		Points             int32            `json:"points"`
		Level              int32            `json:"level"`
		CurrentLevelPoints int32            `json:"currentLevelPoints"`
		NextLevelPoints    int32            `json:"nextLevelPoints"`
		PointsToNextLevel  int32            `json:"pointsToNextLevel"`
		RecentTransactions []map[string]any `json:"recentTransactions"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Equal(t, int32(0), resp.Points)
	require.Equal(t, int32(1), resp.Level)
	require.Equal(t, int32(0), resp.CurrentLevelPoints)
	require.Equal(t, int32(100), resp.NextLevelPoints)
	require.Equal(t, int32(100), resp.PointsToNextLevel)
	require.Empty(t, resp.RecentTransactions)
}

func TestPoints_LevelCurve(t *testing.T) {
	env := setupPointsEnv(t)

	// calculateLevel(p) = floor(sqrt(p/100)) + 1
	// levelThreshold(L) = max(0, (L-1)^2 * 100)
	// L=1 → [0, 100)
	// L=2 → [100, 400)
	// L=3 → [400, 900)
	// L=4 → [900, 1600)
	// L=5 → [1600, 2500)

	cases := []struct {
		points      int32
		wantLevel   int32
		wantCurrent int32
		wantNext    int32
		wantToNext  int32
	}{
		{0, 1, 0, 100, 100},
		{50, 1, 0, 100, 50},
		{100, 2, 100, 400, 300},
		{399, 2, 100, 400, 1},
		{400, 3, 400, 900, 500},
		{1600, 5, 1600, 2500, 900},
	}

	for i, tc := range cases {
		// Each case gets its own user to avoid cross-test pollution.
		tok, userID := env.registerStudent(t, makeEmail(fmt.Sprintf("pt-curve-%d", i)))
		env.setUserPoints(t, userID, tc.points, tc.wantLevel)

		status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
		require.Equal(t, 200, status, "case %d: %s", i, string(raw))
		var resp struct {
			Points             int32 `json:"points"`
			Level              int32 `json:"level"`
			CurrentLevelPoints int32 `json:"currentLevelPoints"`
			NextLevelPoints    int32 `json:"nextLevelPoints"`
			PointsToNextLevel  int32 `json:"pointsToNextLevel"`
		}
		require.NoError(t, json.Unmarshal(raw, &resp), "case %d: %s", i, string(raw))
		require.Equal(t, tc.points, resp.Points, "case %d: points", i)
		require.Equal(t, tc.wantLevel, resp.Level, "case %d: level", i)
		require.Equal(t, tc.wantCurrent, resp.CurrentLevelPoints, "case %d: current", i)
		require.Equal(t, tc.wantNext, resp.NextLevelPoints, "case %d: next", i)
		require.Equal(t, tc.wantToNext, resp.PointsToNextLevel, "case %d: toNext", i)
	}
}

func TestPoints_RecentTransactions_NewestFirst(t *testing.T) {
	env := setupPointsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("pt-tx"))
	env.setUserPoints(t, userID, 350, 2)

	// Insert 3 transactions with different created_at. The SQL
	// ORDER BY created_at DESC means the most recent appears first.
	now := time.Now().UTC()
	insertTxAt := func(reason string, at time.Time, amount int32) {
		id := uuid.NewString()
		_, err := env.db.ExecContext(context.Background(), `
			INSERT INTO point_transactions (id, user_id, amount, reason, ref_type, ref_id, deleted_at, created_at)
			VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)
		`, id, userID, amount, reason, at)
		require.NoError(t, err)
	}
	insertTxAt("first", now.Add(-2*time.Hour), 10)
	insertTxAt("second", now.Add(-1*time.Hour), 20)
	insertTxAt("third", now, 30)

	status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
	require.Equal(t, 200, status, "get: %s", string(raw))
	var resp struct {
		RecentTransactions []struct {
			ID      string  `json:"id"`
			UserID  string  `json:"userId"`
			Amount  int32   `json:"amount"`
			Reason  string  `json:"reason"`
			RefType *string `json:"refType"`
			RefID   *string `json:"refId"`
		} `json:"recentTransactions"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Len(t, resp.RecentTransactions, 3)
	// Newest first
	require.Equal(t, "third", resp.RecentTransactions[0].Reason)
	require.Equal(t, int32(30), resp.RecentTransactions[0].Amount)
	require.Equal(t, "second", resp.RecentTransactions[1].Reason)
	require.Equal(t, "first", resp.RecentTransactions[2].Reason)
}

func TestPoints_SoftDeletedTransaction_Excluded(t *testing.T) {
	env := setupPointsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("pt-sd"))
	env.setUserPoints(t, userID, 100, 2)

	env.insertPointTransaction(t, userID, "active", "", "", 10, false)
	env.insertPointTransaction(t, userID, "soft-deleted", "", "", 20, true)

	status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
	require.Equal(t, 200, status)
	var resp struct {
		RecentTransactions []struct {
			Reason string `json:"reason"`
		} `json:"recentTransactions"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Len(t, resp.RecentTransactions, 1, "soft-deleted tx should be hidden")
	require.Equal(t, "active", resp.RecentTransactions[0].Reason)
}

func TestPoints_TransactionWithRefType(t *testing.T) {
	env := setupPointsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("pt-ref"))
	env.setUserPoints(t, userID, 50, 1)

	env.insertPointTransaction(t, userID, "完成课时", "lesson", "lesson-123", 10, false)
	env.insertPointTransaction(t, userID, "完成实践", "practice", "practice-456", 20, false)
	env.insertPointTransaction(t, userID, "报名奖励", "enrollment", "course-789", 30, false)

	status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
	require.Equal(t, 200, status)
	var resp struct {
		RecentTransactions []struct {
			Reason  string  `json:"reason"`
			RefType *string `json:"refType"`
			RefID   *string `json:"refId"`
		} `json:"recentTransactions"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Len(t, resp.RecentTransactions, 3)
	// Verify refType + refId are exposed in camelCase
	for _, tx := range resp.RecentTransactions {
		require.NotNil(t, tx.RefType, "refType should not be nil for these")
		require.NotNil(t, tx.RefID, "refId should not be nil for these")
	}
	// Newest first → enrollment (last inserted)
	require.Equal(t, "enrollment", *resp.RecentTransactions[0].RefType)
	require.Equal(t, "course-789", *resp.RecentTransactions[0].RefID)
}

func TestPoints_OnlyReturns10Recent(t *testing.T) {
	env := setupPointsEnv(t)
	tok, userID := env.registerStudent(t, makeEmail("pt-10"))
	env.setUserPoints(t, userID, 100, 2)

	// Insert 15 transactions; only 10 should be returned.
	now := time.Now().UTC()
	for i := 0; i < 15; i++ {
		id := uuid.NewString()
		_, err := env.db.ExecContext(context.Background(), `
			INSERT INTO point_transactions (id, user_id, amount, reason, ref_type, ref_id, deleted_at, created_at)
			VALUES (?, ?, ?, 'r', NULL, NULL, NULL, ?)
		`, id, userID, int32(i+1), now.Add(time.Duration(i)*time.Second))
		require.NoError(t, err)
	}

	status, raw := env.do(t, "GET", "/api/v1/points/me", tok, nil)
	require.Equal(t, 200, status)
	var resp struct {
		RecentTransactions []map[string]any `json:"recentTransactions"`
	}
	require.NoError(t, json.Unmarshal(raw, &resp))
	require.Len(t, resp.RecentTransactions, 10, "should cap at 10")
}
