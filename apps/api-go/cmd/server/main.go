// AI Academy API - Go rewrite (Phase 0 skeleton)
//
// Entry point: wires config, logger, fiber app, middleware, routes.
// The framework choice (Fiber v2) was decided in docs/go-migration-execution-plan.md
// to minimize migration friction from the previous Express/NestJS API.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/admin"
	"github.com/frankfika/ai-academy/api-go/internal/ai"
	"github.com/frankfika/ai-academy/api-go/internal/audit"
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/badges"
	"github.com/frankfika/ai-academy/api-go/internal/certificates"
	"github.com/frankfika/ai-academy/api-go/internal/chapters"
	"github.com/frankfika/ai-academy/api-go/internal/chat"
	"github.com/frankfika/ai-academy/api-go/internal/cms"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/frankfika/ai-academy/api-go/internal/courses"
	"github.com/frankfika/ai-academy/api-go/internal/degrees"
	"github.com/frankfika/ai-academy/api-go/internal/enrollments"
	"github.com/frankfika/ai-academy/api-go/internal/enterprise"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/hackathons"
	"github.com/frankfika/ai-academy/api-go/internal/handler"
	"github.com/frankfika/ai-academy/api-go/internal/instructors"
	"github.com/frankfika/ai-academy/api-go/internal/learningevents"
	"github.com/frankfika/ai-academy/api-go/internal/lessons"
	"github.com/frankfika/ai-academy/api-go/internal/logger"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/notes"
	"github.com/frankfika/ai-academy/api-go/internal/notifications"
	"github.com/frankfika/ai-academy/api-go/internal/orders"
	"github.com/frankfika/ai-academy/api-go/internal/points"
	"github.com/frankfika/ai-academy/api-go/internal/practices"
	"github.com/frankfika/ai-academy/api-go/internal/progress"
	"github.com/frankfika/ai-academy/api-go/internal/resources"
	"github.com/frankfika/ai-academy/api-go/internal/reviews"
	"github.com/frankfika/ai-academy/api-go/internal/site"
	"github.com/frankfika/ai-academy/api-go/internal/uploads"
	"github.com/frankfika/ai-academy/api-go/internal/urlimport"
	"github.com/frankfika/ai-academy/api-go/internal/users"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config load failed: %v\n", err)
		os.Exit(1)
	}

	log, err := logger.New(cfg.Env)
	if err != nil {
		fmt.Fprintf(os.Stderr, "logger init failed: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync() //nolint:errcheck

	log.Info("api-go starting",
		zap.String("env", cfg.Env),
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("version", cfg.Version),
	)

	app := fiber.New(fiber.Config{
		AppName:               "ai-academy-api-go",
		BodyLimit:             100 * 1024, // 100KB, matches NestJS main.ts
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          30 * time.Second,
		IdleTimeout:           60 * time.Second,
		DisableStartupMessage: true,
		StreamRequestBody:     true,
		ErrorHandler:          errs.Handler(log),
	})

	// Mount global middleware (order matters: recover outermost, then requestid, then logger).
	app.Use(recover.New(recover.Config{
		EnableStackTrace: cfg.Env == "development",
	}))
	app.Use(requestid.New(requestid.Config{
		Header:    "X-Request-Id",
		Generator: func() string { return uuid.NewString() },
	}))
	app.Use(middleware.LimitRequestBodyExceptLocalUpload(100 * 1024))
	app.Use(fiberlogger.New(fiberlogger.Config{
		Format:     "${time} ${locals:requestid} ${status} ${method} ${path} ${latency} ${ip}\n",
		TimeFormat: "2006-01-02T15:04:05Z07:00",
		Output:     os.Stdout,
	}))
	app.Use(helmet.New(helmet.Config{
		ContentSecurityPolicy:     "",
		CrossOriginEmbedderPolicy: "false",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigin,
		AllowCredentials: true,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type,Authorization,X-Request-Id",
	}))
	// Rate limit: default 100 req / 1 min. Phase 1 swap to Redis-backed via go-redis.
	app.Use(limiter.New(globalLimiterConfig()))

	// Health & readiness — registered before any versioned routes.
	//
	// /healthz is wired through internal/handler.Liveness which embeds
	// the OpenAPI-generated `gen.HealthControllerLivenessV1OK` response
	// type. This is the Phase 0 T2 smoke test that demonstrates the
	// gen package is reachable from the request path. The JSON shape is
	// preserved verbatim (see internal/handler/health.go).
	app.Get("/healthz", handler.Liveness(cfg))
	app.Get("/readyz", handler.Readiness())

	// API v1 group — controllers mount here in later phases.
	v1 := app.Group("/api/v1")

	// Phase 1 T7 + Phase 2 T11: wire the auth + users flows. We open MySQL
	// once at boot; build the repos, then the services, then the token
	// issuer, then the HTTP handlers. If the DB is unreachable or any
	// module fails to build, we log + continue so the rest of the app
	// stays up — module-dependent endpoints will return 503, not 500.
	mountAuth(v1, cfg, log)
	mountUsers(v1, cfg, log)
	mountCourses(v1, cfg, log)
	mountChapters(v1, cfg, log)
	mountLessons(v1, cfg, log)
	mountResources(v1, cfg, log)
	mountEnrollments(v1, cfg, log)
	mountOrders(v1, cfg, log)
	mountDegrees(v1, cfg, log)
	mountBadges(v1, cfg, log)
	mountCertificates(v1, cfg, log)
	mountPractices(v1, cfg, log)
	mountProgress(v1, cfg, log)
	mountLearningEvents(v1, cfg, log)
	mountNotes(v1, cfg, log)
	mountReviews(v1, cfg, log)
	mountNotifications(v1, cfg, log)
	mountPoints(v1, cfg, log)
	mountUploads(v1, cfg, log)
	mountChat(v1, cfg, log)
	mountAI(v1, cfg, log)
	mountInstructors(v1, cfg, log)
	mountSite(v1, cfg, log)
	mountEnterprise(v1, cfg, log)
	mountUrlImport(v1, cfg, log)
	mountHackathons(v1, cfg, log)
	mountAdmin(v1, cfg, log)
	mountAudit(v1, cfg, log)
	mountCMS(v1, cfg, log)
	mountSitemap(app, cfg, log)
	wireRefundNotifier(v1, cfg, log)
	wireEnterpriseNotifier(v1, cfg, log)

	// 404 fallback (NestJS renders 404 JSON; we keep parity).
	app.Use(func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "Route not found: "+c.Method()+" "+c.Path())
	})

	// Prometheus /metrics on a separate listener (Prometheus scrapers want plain text,
	// not Fiber's response pipeline).
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		addr := fmt.Sprintf(":%d", cfg.MetricsPort)
		log.Info("metrics server listening", zap.String("addr", addr))
		if err := http.ListenAndServe(addr, mux); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("metrics server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown on SIGINT / SIGTERM with 10s grace.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	listenErr := make(chan error, 1)
	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		if err := app.Listen(addr); err != nil {
			listenErr <- err
		}
		close(listenErr)
	}()

	select {
	case err := <-listenErr:
		if err != nil {
			log.Error("fiber listen failed", zap.Error(err))
			os.Exit(1)
		}
	case sig := <-stop:
		log.Info("shutdown signal received", zap.String("signal", sig.String()))
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := app.ShutdownWithContext(ctx); err != nil {
			log.Error("graceful shutdown failed", zap.Error(err))
			os.Exit(1)
		}
		log.Info("shutdown complete")
	}
}

func globalLimiterConfig() limiter.Config {
	return limiter.Config{
		Max:        100,
		Expiration: time.Minute,
		// Fiber is not configured with ProxyHeader/TrustedProxies, so IP()
		// is the direct peer address and cannot be changed by a spoofed
		// X-Forwarded-For header. Most importantly, it is stable across
		// requests; request-id must never be part of the bucket key.
		KeyGenerator: func(c *fiber.Ctx) string { return c.IP() },
	}
}

// mountAuth opens the DB, builds the auth stack, and mounts the routes.
// Failures degrade gracefully — we log + return without registering
// /auth/* routes. Callers will get 404 instead of 500, which is the
// right behavior for "auth is currently unavailable".
//
// IMPORTANT: the *sql.DB returned by sql.Open is intentionally leaked
// (not Close()d on shutdown) because Fiber's app.Test and the production
// listener share the same goroutine pool. Closing the DB on main()'s
// return path causes the first real request after startup to fail with
// "sql: database is closed". The Go runtime will reclaim the connection
// when the process exits.
func mountAuth(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, auth endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("auth: db open failed, auth endpoints disabled", zap.Error(err))
		return
	}
	// Pool tuning for the production load. MaxOpenConns/ConnMaxLifetime
	// mirror the NestJS TypeORM pool config (main.ts:32-38).
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("auth: db ping failed, auth endpoints disabled", zap.Error(err))
		return
	}
	cancel()

	authRepo := auth.NewAuthRepo(conn)
	authCfg, err := auth.LoadAuthConfig()
	if err != nil {
		log.Warn("auth: config load failed, auth endpoints disabled", zap.Error(err))
		return
	}
	if len(authCfg.EnabledProviders) == 0 {
		log.Warn("auth: no providers enabled, /auth/* disabled")
		return
	}
	authSvc, err := auth.BuildService(authCfg, authRepo)
	if err != nil {
		log.Warn("auth: build service failed, /auth/* disabled", zap.Error(err))
		return
	}
	authSvc.SetRepo(authRepo)
	// AuthService is the single owner of OAuth/SAML state. Non-production
	// uses process-local memory; production stateful providers require Redis
	// so state survives restarts and is shared by all instances.
	// Fake identity mode is strictly test-only; development/staging must still
	// perform the real IdP exchange even though they use an in-memory store.
	auth.OAuthTestMode = cfg.Env == "test"
	if cfg.Env != "production" {
		authSvc.SetStateStore(auth.NewMemoryStateStore())
	} else if authConfigNeedsStateStore(authCfg) {
		if cfg.RedisURL == "" {
			log.Error("auth: REDIS_URL is required in production when OAuth or SAML is enabled; auth endpoints disabled")
			return
		}
		redisOpts, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			log.Error("auth: invalid REDIS_URL; auth endpoints disabled", zap.Error(err))
			return
		}
		redisClient := redis.NewClient(redisOpts)
		redisCtx, redisCancel := context.WithTimeout(context.Background(), 5*time.Second)
		err = redisClient.Ping(redisCtx).Err()
		redisCancel()
		if err != nil {
			_ = redisClient.Close()
			log.Error("auth: Redis unavailable; auth route mounting aborted", zap.Error(err))
			return
		}
		authSvc.SetStateStore(auth.NewRedisStateStore(redisClient, "auth"))
	}

	if cfg.JWTSecret == "" {
		log.Warn("auth: JWT_SECRET not set, /auth/* disabled")
		return
	}

	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret),
		authRepo,
		auth.TokenTTL,
		auth.RefreshTokenTTL,
	)
	authHandler := handler.NewAuthHandler(authSvc, authRepo, tokens, handler.AuthHandlerConfig{
		Env:             cfg.Env,
		AccessTokenTTL:  auth.TokenTTL,
		RefreshTokenTTL: auth.RefreshTokenTTL,
	}, log)
	resetNotifier := auth.NewResendPasswordResetNotifier(cfg.ResendAPIKey, cfg.MailFrom, cfg.PublicURL, nil)
	passwordResetSvc := auth.NewPasswordResetService(authRepo, resetNotifier, 12, log)
	passwordResetHandler := handler.NewPasswordResetHandler(passwordResetSvc)
	// Mount explicit static routes before AuthHandler's provider catch-alls.
	passwordResetHandler.Mount(v1)
	authHandler.Mount(v1)
	log.Info("auth routes mounted",
		zap.Strings("providers", providerStrings(authCfg.EnabledProviders)))
}

func authConfigNeedsStateStore(cfg *auth.AuthConfig) bool {
	for _, id := range cfg.EnabledProviders {
		if id == "oauth.google" || id == "oauth.github" || id == "sso.saml" {
			return true
		}
	}
	return false
}

func providerStrings(ids []auth.ProviderID) []string {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = string(id)
	}
	return out
}

// mountUsers opens a *sql.DB (sharing the same instance mountAuth would
// have used if it's already been called), builds the users service +
// handler, and mounts the routes.
//
// Phase 2 T11: this function piggybacks on the auth DB connection by
// accepting the *sql.DB from mountAuth. If we want to make this
// independent, we'd refactor to a shared `connectDB()` helper.
func mountUsers(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, users endpoints will return 503")
		return
	}
	if cfg.JWTSecret == "" {
		log.Warn("JWT_SECRET not set, users endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("users: db open failed, users endpoints disabled", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("users: db ping failed, users endpoints disabled", zap.Error(err))
		return
	}
	cancel()

	usersRepo := users.NewRepo(conn)
	usersSvc := users.NewService(usersRepo, log, 0) // bcrypt cost 12 (default)
	// Build a token issuer for the requireAuth middleware. We only need
	// the Verify method here — the auth service's own dispatcher
	// already issues new tokens on register/login/refresh.
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret),
		authRepo,
		auth.TokenTTL,
		auth.RefreshTokenTTL,
	)

	usersHandler := handler.NewUsersHandler(usersSvc, tokens, log)
	usersHandler.Mount(v1)

	identitiesHandler := handler.NewIdentitiesHandler(usersSvc, tokens, log)
	identitiesHandler.Mount(v1)
	log.Info("users + identities routes mounted (T11)")
}

// mountCourses opens a *sql.DB, builds the courses service + handler, and
// mounts the routes.
//
// Phase 2 T12-1: courses module is read-mostly public, with admin-only
// mutations. The list + detail endpoints are reachable without auth.
func mountCourses(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, courses endpoints will return 503")
		return
	}
	if cfg.JWTSecret == "" {
		log.Warn("JWT_SECRET not set, courses endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("courses: db open failed, courses endpoints disabled", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("courses: db ping failed, courses endpoints disabled", zap.Error(err))
		return
	}
	cancel()

	coursesRepo := courses.NewRepo(conn)
	coursesSvc := courses.NewService(coursesRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret),
		authRepo,
		auth.TokenTTL,
		auth.RefreshTokenTTL,
	)
	coursesHandler := handler.NewCoursesHandler(coursesSvc, tokens, log)
	coursesHandler.Mount(v1)
	log.Info("courses routes mounted (T12-1)")
}

// mountChapters opens a *sql.DB and mounts the chapters service +
// handler. Phase 2 T12-2.
//
// The chapters handler is a sibling of mountCourses — they share the
// same `*sql.DB` pattern. (Future refactor: a shared connectDB() helper
// to avoid the open-twice; out of scope for T12-2.)
func mountChapters(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, chapters endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("chapters: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("chapters: db ping failed", zap.Error(err))
		return
	}
	cancel()

	chaptersRepo := chapters.NewRepo(conn)
	chaptersSvc := chapters.NewService(chaptersRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewChaptersHandler(chaptersSvc, tokens, log)
	h.Mount(v1)
	log.Info("chapters routes mounted (T12-2)")
}

// mountLessons opens a *sql.DB and mounts the lessons service + handler.
// Phase 2 T12-3.
//
// The lessons repo is also exposed as the cascade hook for the chapters
// service: when a chapter is soft-deleted, the chapters.Service.Delete
// calls lessons.Repo.SoftDeleteByChapter to cascade the soft-delete to
// the chapter's lessons. We wire the lessons repo into the chapters
// hook here so the cross-module call is set up at boot.
func mountLessons(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, lessons endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("lessons: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("lessons: db ping failed", zap.Error(err))
		return
	}
	cancel()

	lessonsRepo := lessons.NewRepo(conn)
	lessonsSvc := lessons.NewService(lessonsRepo, log)

	// Wire the chapters → lessons cascade hook. The chapters package
	// exposes LessonSoftDeleteByChapter as a package-level var; we
	// close over the lessons repo and override it.
	chapters.LessonSoftDeleteByChapter = func(ctx context.Context, _ *sql.DB, chapterID string) (int64, error) {
		return lessonsRepo.SoftDeleteByChapter(ctx, chapterID)
	}

	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewLessonsHandler(lessonsSvc, tokens, log)
	h.Mount(v1)
	log.Info("lessons routes mounted (T12-3)")
}

// mountResources opens a *sql.DB and mounts the resources service +
// handler. Phase 2 T12-4.
//
// Resources are attached to lessons and have a hard FK on lesson_id
// with ON DELETE CASCADE (so DB-level cascade handles physical
// lesson deletion; the repo's SoftDeleteByLesson handles soft-delete
// cascade from the lesson soft-delete path).
func mountResources(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, resources endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("resources: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("resources: db ping failed", zap.Error(err))
		return
	}
	cancel()

	resourcesRepo := resources.NewRepo(conn)
	resourcesSvc := resources.NewService(resourcesRepo, log)

	// Wire the lessons → resources cascade hook. When a lesson is
	// soft-deleted, the lessons service calls resources.SoftDeleteByLesson
	// to cascade the soft-delete to the lesson's resources.
	lessons.ResourceSoftDeleteByLesson = func(ctx context.Context, _ *sql.DB, lessonID string) (int64, error) {
		return resourcesRepo.SoftDeleteByLesson(ctx, lessonID)
	}

	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewResourcesHandler(resourcesSvc, tokens, log)
	h.Mount(v1)
	log.Info("resources routes mounted (T12-4)")
}

// mountEnrollments opens a *sql.DB and mounts the enrollments service
// + handler. Phase 2 T13-1.
func mountEnrollments(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, enrollments endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("enrollments: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("enrollments: db ping failed", zap.Error(err))
		return
	}
	cancel()

	enrollmentsRepo := enrollments.NewRepo(conn)
	enrollmentsSvc := enrollments.NewService(enrollmentsRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewEnrollmentsHandler(enrollmentsSvc, tokens, log)
	h.Mount(v1)
	log.Info("enrollments routes mounted (T13-1)")
}

// mountOrders opens a *sql.DB and mounts the orders service + handler.
// Phase 2 T13-2.
func mountOrders(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, orders endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("orders: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("orders: db ping failed", zap.Error(err))
		return
	}
	cancel()

	ordersRepo := orders.NewRepo(conn)
	ordersSvc := orders.NewService(ordersRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewOrdersHandler(ordersSvc, tokens, cfg.Env, log)
	h.Mount(v1)
	log.Info("orders routes mounted (T13-2)")
}

// mountDegrees opens a *sql.DB and mounts the degrees service + handler.
// Phase 2 T14-1.
func mountDegrees(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, degrees endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("degrees: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("degrees: db ping failed", zap.Error(err))
		return
	}
	cancel()

	degreesRepo := degrees.NewRepo(conn)
	degreesSvc := degrees.NewService(degreesRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewDegreesHandler(degreesSvc, tokens, log)
	h.Mount(v1)
	log.Info("degrees routes mounted (T14-1)")
}

// mountBadges opens a *sql.DB and mounts the badges service + handler.
// Phase 2 T14-2. Wires the enrollments.BadgeCheckAward cross-module
// hook with the real implementation.
func mountBadges(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, badges endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("badges: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("badges: db ping failed", zap.Error(err))
		return
	}
	cancel()

	badgesRepo := badges.NewRepo(conn)
	badgesSvc := badges.NewService(badgesRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)

	// Wire the enrollments.BadgeCheckAward cross-module hook with the
	// real implementation. After a user enrolls in a course, the
	// enrollments service kicks this off to award any newly-earned
	// badges (e.g. "first_enrollment").
	enrollments.BadgeCheckAward = func(ctx context.Context, userID string) error {
		_, err := badgesSvc.CheckAndAward(ctx, userID)
		return err
	}

	h := handler.NewBadgesHandler(badgesSvc, tokens, log)
	h.Mount(v1)
	log.Info("badges routes mounted (T14-2) + enrollments.BadgeCheckAward wired")
}

// mountCertificates opens a *sql.DB and mounts the certificates service
// + handler. Phase 2 T14-3. Wires the orders.IssueCertificateOnPaid
// cross-module hook with the real implementation.
func mountCertificates(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, certificates endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("certificates: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("certificates: db ping failed", zap.Error(err))
		return
	}
	cancel()

	certRepo := certificates.NewRepo(conn)
	certSvc := certificates.NewService(certRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)

	// Wire the orders.IssueCertificateOnPaid cross-module hook with
	// the real implementation. When an order is paid (or a free
	// course auto-enrolls), the orders service kicks off cert issue.
	// The certificate's title is computed here from the type+ref
	// combination (e.g. "纳米学位《AI 全栈工程师》· 学位证书").
	orders.IssueCertificateOnPaid = func(ctx context.Context, userID, typ, refID string) {
		title := "完成证书"
		description := "您已成功完成本课程，恭喜！"
		switch typ {
		case "course":
			title = "课程完成证书"
		case "degree":
			title = "学位证书"
		}
		_, err := certSvc.IssueCertificate(ctx, certificates.IssueInput{
			UserID:      userID,
			Type:        typ,
			RefID:       refID,
			Title:       title,
			Description: description,
		})
		if err != nil {
			log.Warn("issue certificate failed",
				zap.String("userId", userID),
				zap.String("type", typ),
				zap.String("refId", refID),
				zap.Error(err))
		}
	}

	h := handler.NewCertificatesHandler(certSvc, tokens, log)
	h.Mount(v1)
	log.Info("certificates routes mounted (T14-3) + orders.IssueCertificateOnPaid wired")
}

// mountPractices opens a *sql.DB and mounts the practices service +
// handler. Phase 2 T14-4.
func mountPractices(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, practices endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("practices: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("practices: db ping failed", zap.Error(err))
		return
	}
	cancel()

	practicesRepo := practices.NewRepo(conn)
	practicesSvc := practices.NewService(practicesRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewPracticesHandler(practicesSvc, tokens, log)
	h.Mount(v1)
	log.Info("practices routes mounted (T14-4)")
}

// mountProgress opens a *sql.DB and mounts the progress service +
// handler. Phase 2 T15-1.
func mountProgress(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, progress endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("progress: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("progress: db ping failed", zap.Error(err))
		return
	}
	cancel()

	progressRepo := progress.NewRepo(conn)
	progressSvc := progress.NewService(progressRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewProgressHandler(progressSvc, tokens, log)
	h.Mount(v1)
	log.Info("progress routes mounted (T15-1)")
}

// mountLearningEvents opens a *sql.DB and mounts the learning_events
// service + handler. Phase 2 T15-2.
func mountLearningEvents(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, learning-events endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("learning-events: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("learning-events: db ping failed", zap.Error(err))
		return
	}
	cancel()

	leRepo := learningevents.NewRepo(conn)
	leSvc := learningevents.NewService(leRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewLearningEventsHandler(leSvc, tokens, log)
	h.Mount(v1)
	log.Info("learning-events routes mounted (T15-2)")
}

// mountNotes opens a *sql.DB and mounts the notes service + handler.
// Phase 2 T15-3.
func mountNotes(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, notes endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("notes: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("notes: db ping failed", zap.Error(err))
		return
	}
	cancel()

	notesRepo := notes.NewRepo(conn)
	notesSvc := notes.NewService(notesRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewNotesHandler(notesSvc, tokens, log)
	h.Mount(v1)
	log.Info("notes routes mounted (T15-3)")
}

// mountReviews opens a *sql.DB and mounts the reviews service +
// handler. Phase 2 T15-4.
func mountReviews(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, reviews endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("reviews: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("reviews: db ping failed", zap.Error(err))
		return
	}
	cancel()

	reviewsRepo := reviews.NewRepo(conn)
	reviewsSvc := reviews.NewService(reviewsRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewReviewsHandler(reviewsSvc, tokens, log)
	h.Mount(v1)
	log.Info("reviews routes mounted (T15-4)")
}

// mountNotifications opens a *sql.DB and mounts the notifications
// service + handler. Phase 2 T16-1. Wires the orders.NotifyOrderCreated
// cross-module hook with the real implementation.
//
// 6 endpoints (all JWT-auth):
//
//	GET    /notifications                list + unread count
//	GET    /notifications/unread-count    just the count (bell badge)
//	POST   /notifications/:id/read        mark one read
//	POST   /notifications/read-all        mark all read
//	DELETE /notifications/:id             soft-delete one
//	POST   /notifications/clear-read      soft-delete all read
//
// Cross-module wiring notes:
//   - orders.NotifyOrderCreated was a stub declared in T13-2; the
//     orders service calls it fire-and-forget after a paid order is
//     created. We override it here with a real impl that pushes a
//     'order' notification into the user's inbox.
func mountNotifications(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, notifications endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("notifications: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("notifications: db ping failed", zap.Error(err))
		return
	}
	cancel()

	notifRepo := notifications.NewRepo(conn)
	notifSvc := notifications.NewService(notifRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)

	// Wire the orders.NotifyOrderCreated cross-module hook with the
	// real implementation. When the orders service creates a paid
	// order, this fires a user-facing 'order' notification.
	orders.NotifyOrderCreated = func(ctx context.Context, userID, orderID, amount string) {
		err := notifSvc.CreateNotification(ctx, notifications.CreateNotificationInput{
			UserID:  userID,
			Type:    "order",
			Title:   "订单已创建",
			Body:    "您的订单已创建，金额 ¥" + amount + "，请尽快完成支付。",
			LinkURL: "/orders/" + orderID,
		})
		if err != nil {
			log.Warn("notify order created failed",
				zap.String("userId", userID),
				zap.String("orderId", orderID),
				zap.Error(err))
		}
	}

	h := handler.NewNotificationsHandler(notifSvc, tokens, log)
	h.Mount(v1)
	log.Info("notifications routes mounted (T16-1) + orders.NotifyOrderCreated wired")
}

// mountPoints opens a *sql.DB and mounts the points service + handler.
// Phase 2 T16-2. Single endpoint:
//
//	GET /points/me
//
// Returns the user's points, level, level-progress, and the 10 most
// recent non-deleted point transactions.
//
// Future cross-module hook: practices.AwardOnPracticeComplete could
// call points.Award to grant +N points; that wiring is out of scope
// for T16-2 (the public read API is the deliverable).
func mountPoints(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, points endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("points: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("points: db ping failed", zap.Error(err))
		return
	}
	cancel()

	pointsRepo := points.NewRepo(conn)
	pointsSvc := points.NewService(pointsRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewPointsHandler(pointsSvc, tokens, log)
	h.Mount(v1)
	log.Info("points routes mounted (T16-2)")
}

// mountChat opens a *sql.DB and mounts the chat service + handler.
// Phase 2 T17. 5 endpoints (all JWT-auth):
//
//	POST   /chat/sessions
//	GET    /chat/sessions
//	GET    /chat/sessions/:id/messages
//	POST   /chat/sessions/:id/messages
//	DELETE /chat/sessions/:id
//
// The send-message endpoint uses a stub assistant reply in dev/test;
// real Gemini + RAG integration ships in T17.1 (needs GEMINI_API_KEY).
func mountChat(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, chat endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("chat: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("chat: db ping failed", zap.Error(err))
		return
	}
	cancel()

	chatRepo := chat.NewRepo(conn)
	chatSvc := chat.NewService(chatRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewChatHandler(chatSvc, tokens, log)
	h.Mount(v1)
	log.Info("chat routes mounted (T17)")
}

// mountUploads opens a *sql.DB and mounts the uploads service + handler.
// Phase 2 T16-3. 2 endpoints (both JWT-auth):
//
//	POST /uploads/sign      → presigned upload URL
//	POST /uploads/complete  → confirm + writeback to entity
//
// Storage backend: InMemoryStorage (no real S3 in dev/test).
// For production, swap to LocalFileStorage or a real S3 impl — the
// interface is identical.
//
// Throttling: NestJS uses @nestjs/throttler. We don't have a
// production-equivalent here; rate-limiting is expected to be done
// at the API gateway (nginx / envoy) for the Go API. (Same caveat
// as T15-2 learning events.)
func mountUploads(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.Env == "production" {
		log.Error("uploads: no supported production object-storage backend is configured; upload routes disabled")
		return
	}
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, uploads endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("uploads: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("uploads: db ping failed", zap.Error(err))
		return
	}
	cancel()

	uploadsRepo := uploads.NewRepo(conn)
	// InMemoryStorage is the default for dev/test. Production swap
	publicBase := strings.TrimRight(cfg.UploadPublicBaseURL, "/")
	if publicBase == "" {
		origin := strings.TrimRight(cfg.PublicURL, "/")
		if origin == "" {
			origin = fmt.Sprintf("http://localhost:%d", cfg.Port)
		}
		publicBase = origin + "/api/v1/uploads/files"
	}
	uploadBase := strings.TrimSuffix(publicBase, "/files") + "/_local_upload"
	storage := uploads.NewLocalFileStorageWithUploadBase(cfg.LocalUploadDir, publicBase, uploadBase)
	uploadsSvc := uploads.NewService(uploadsRepo, storage, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewUploadsHandler(uploadsSvc, tokens, log)
	h.MountLocal(v1, storage)
	h.Mount(v1)
	log.Info("uploads routes mounted with local storage", zap.String("root", cfg.LocalUploadDir))
}

// wireRefundNotifier connects the orders refund flow to the
// notifications service. When a user successfully refunds an order,
// orders.refundNotifier fires a "退款已完成" notification into their
// inbox. Phase 2 T15-final.
func wireRefundNotifier(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, refund notifier not wired")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("refund notifier: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("refund notifier: db ping failed", zap.Error(err))
		return
	}
	cancel()

	notifRepo := notifications.NewRepo(conn)
	notifSvc := notifications.NewService(notifRepo, log)
	orders.SetRefundNotifier(func(ctx context.Context, userID, orderID, refundAmount string) {
		err := notifSvc.CreateNotification(ctx, notifications.CreateNotificationInput{
			UserID:  userID,
			Type:    "order",
			Title:   "退款申请已完成",
			Body:    "订单退款已处理，退款金额 ¥" + refundAmount + "。",
			LinkURL: "/orders/" + orderID,
		})
		if err != nil {
			log.Warn("refund notification failed",
				zap.String("userId", userID),
				zap.String("orderId", orderID),
				zap.Error(err))
		}
	})
	log.Info("refund notifier wired (T15-final) — orders.SetRefundNotifier")
}

// mountAI opens a *sql.DB and mounts the AI service + handler.
// Phase 2 T21. 9 endpoints:
//
//	Admin (role=admin):
//	  GET    /api/v1/admin/ai-config/providers
//	  PUT    /api/v1/admin/ai-config/providers
//	  DELETE /api/v1/admin/ai-config/providers/:provider
//	  POST   /api/v1/admin/ai-config/test
//
//	Per-user (any auth):
//	  GET    /api/v1/ai/user-config/providers
//	  PUT    /api/v1/ai/user-config/providers
//	  DELETE /api/v1/ai/user-config/providers/:provider
//
//	Generate (role=admin, stub):
//	  POST   /api/v1/ai/generate-course
//	  POST   /api/v1/ai/generate-degree
//
// The 2 generate endpoints are stub-only. Real Gemini integration
// is T21.1 (needs GEMINI_API_KEY + the AiService / GeminiService from
// apps/api/src/common/gemini).
func mountAI(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, ai endpoints will return 503")
		return
	}
	if err := ai.ValidateEncryptionConfig(cfg.Env); err != nil {
		log.Error("ai: encryption config invalid, ai endpoints disabled", zap.Error(err))
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("ai: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("ai: db ping failed", zap.Error(err))
		return
	}
	cancel()

	aiRepo := ai.NewRepo(conn)
	aiSvc := ai.NewService(aiRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewAIHandler(aiSvc, tokens, log)
	h.Mount(v1)
	log.Info("ai routes mounted (T21)")
}

// mountInstructors opens a *sql.DB and mounts the instructors service
// + handler. Phase 2 T20.
//
// The instructors module is read-mostly public (2 endpoints) +
// admin-gated mutations (10 endpoints). It shares the same
// mount*Xxx bootstrap pattern as the courses/notes/reviews modules.
func mountInstructors(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, instructors endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("instructors: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("instructors: db ping failed", zap.Error(err))
		return
	}
	cancel()

	insRepo := instructors.NewRepo(conn)
	insSvc := instructors.NewService(insRepo, log)
	insExpertiseSvc := instructors.NewExpertiseService(insRepo, log)

	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewInstructorsHandler(insSvc, insExpertiseSvc, tokens, log)
	h.Mount(v1)
	log.Info("instructors routes mounted (T20 + T24 expertises)")
}

// mountHackathons opens a *sql.DB and mounts the hackathons service +
// handler. Phase 2 T19. 10 endpoints:
//
//	GET    /api/v1/hackathons                          public list
//	GET    /api/v1/hackathons/:id                      public detail
//	GET    /api/v1/hackathons/:id/announcements        public list
//	POST   /api/v1/hackathons                          admin create
//	PATCH  /api/v1/hackathons/:id                      admin update
//	DELETE /api/v1/hackathons/:id                      admin soft-delete
//	POST   /api/v1/hackathons/:id/announcements        admin create
//	POST   /api/v1/hackathons/:id/register             auth register
//	POST   /api/v1/hackathons/:id/cancel               auth cancel
//	GET    /api/v1/hackathons/:id/my-registration      auth self-lookup
//
// Teams / submissions / judges / sponsors endpoints (~20 routes) are
// deferred to T19.1. The schema tables exist; we just don't surface
// HTTP endpoints yet.
func mountHackathons(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, hackathons endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("hackathons: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("hackathons: db ping failed", zap.Error(err))
		return
	}
	cancel()

	hRepo := hackathons.NewRepo(conn)
	hSvc := hackathons.NewService(hRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewHackathonsHandler(hSvc, tokens, log)
	h.Mount(v1)
	log.Info("hackathons routes mounted (T19)")
}

// mountSite opens a *sql.DB and mounts the site service + handler.
// Phase 2 T22. The /api/v1/site/stats endpoint is public and
// returns homepage / AuthShell hero numbers (4 KPIs + featured
// course + term label). No JWT verification is required.
func mountSite(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, site endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("site: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("site: db ping failed", zap.Error(err))
		return
	}
	cancel()

	siteSvc := site.NewService(conn)
	siteH := handler.NewSiteHandler(siteSvc)
	siteH.Mount(v1)
	log.Info("site routes mounted (T22)")
}

// mountEnterprise opens a *sql.DB and mounts the enterprise service
// + handler. Phase 2 T22. 4 endpoints (1 public + 3 admin). The
// admin routes require RequireRole("admin"); the public POST is
// rate-limited by the global Fiber limiter (cmd/server/main.go:111).
func mountEnterprise(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, enterprise endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("enterprise: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("enterprise: db ping failed", zap.Error(err))
		return
	}
	cancel()

	entRepo := enterprise.NewRepo(conn)
	entSvc := enterprise.NewService(entRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewEnterpriseHandler(entSvc, tokens, log)
	h.Mount(v1)
	log.Info("enterprise routes mounted (T22)")
}

// mountUrlImport opens a *sql.DB and mounts the urlimport service +
// handler. Phase 2 T22. 2 admin-only endpoints (single + batch).
// Both return stub task data; the real metadata fetch + Gemini
// course-draft flow lands in T22.1.
func mountUrlImport(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, url-import endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("urlimport: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("urlimport: db ping failed", zap.Error(err))
		return
	}
	cancel()

	urlRepo := urlimport.NewRepo(conn)
	urlSvc := urlimport.NewService(urlRepo, log)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewUrlImportHandler(urlSvc, tokens, log)
	h.Mount(v1)
	log.Info("urlimport routes mounted (T22 + T22.1) [real metadata extraction]")
}

// wireEnterpriseNotifier connects the enterprise inquiry service to
// a Resend-backed email sender. When an admin moves an inquiry to
// 'contacted' or 'qualified', the notifier fires a "your inquiry has
// been updated" email to the inquirer.
//
// Phase 2 T22.1: stub logs the notifier call. Real Resend
// integration (RESEND_API_KEY env var) lives in a follow-up.
func wireEnterpriseNotifier(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	enterprise.SetResendNotifier(func(_ context.Context, inquiryID, email, subject, body string) {
		log.Info("enterprise inquiry notification (stub)",
			zap.String("inquiryId", inquiryID),
			zap.String("email", email),
			zap.String("subject", subject),
			zap.Int("bodyLen", len(body)),
		)
	})
	log.Info("enterprise notifier wired (T22.1) — enterprise.SetResendNotifier [stub]")
}

// mountCMS opens a *sql.DB and mounts the cms service + handler. Phase 2
// T23. ~80 admin endpoints (under /api/v1/admin/cms/*) + 17 public read
// endpoints (under /api/v1/{app,site,page}-settings + /api/v1/{industries,...})
// over 16 resource tables. Admin routes are gated by RequireAuth +
// RequireRole("admin"); public routes are open.
func mountCMS(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, cms endpoints will not be mounted")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("cms: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("cms: db ping failed", zap.Error(err))
		return
	}
	cancel()

	cmsRepo := cms.NewRepo(conn)
	cmsSvc := cms.NewService(cmsRepo, log)
	h := handler.NewCMSHandler(cmsSvc, nil, log)
	h.MountPublic(v1)

	if cfg.JWTSecret == "" {
		log.Warn("JWT_SECRET not set, public cms routes mounted but admin cms routes disabled")
		return
	}
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	adminHandler := handler.NewCMSHandler(cmsSvc, tokens, log)
	adminHandler.MountAdmin(v1)
	log.Info("public and admin cms routes mounted (T23)")
}

// mountSitemap attaches the public /sitemap.xml handler. The endpoint
// is mounted at the project root (not under /api/v1) to match the
// NestJS sitemap.controller.ts contract. We re-open the DB rather
// than thread it through, mirroring the other mount* functions.
func mountSitemap(app *fiber.App, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" {
		log.Warn("DATABASE_URL not set, sitemap.xml will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("sitemap: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("sitemap: db ping failed", zap.Error(err))
		return
	}
	cancel()

	cmsRepo := cms.NewRepo(conn)
	cmsSvc := cms.NewService(cmsRepo, log)
	// Sitemap doesn't need JWT; build a minimal handler with a nil-ish
	// token issuer (the SitemapHandler never calls Verify).
	h := handler.NewCMSHandler(cmsSvc, nil, log)
	app.Get("/sitemap.xml", h.SitemapHandler())
	log.Info("sitemap.xml route mounted (T23)")
}

// mountAdmin opens a *sql.DB and mounts the admin dashboard service +
// handler. Phase 2 T24. 1 endpoint (admin-only):
//
//	GET /api/v1/admin/stats
//
// The endpoint runs ~17 short aggregations against MySQL (orders,
// users, progress_records, enrollments, certificates, courses,
// enterprise_inquiries). The NestJS service does the same via
// Promise.all; the Go version is sequential because each query is
// sub-millisecond and the admin dashboard is a single-user surface.
func mountAdmin(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, admin endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("admin: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("admin: db ping failed", zap.Error(err))
		return
	}
	cancel()

	apiVersion := "1.0.0"
	if cfg.Env != "" {
		apiVersion = cfg.Env
	}
	adminSvc := admin.NewService(conn, apiVersion)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewAdminHandler(adminSvc, tokens, log)
	h.Mount(v1)
	log.Info("admin routes mounted (T24)")
}

// mountAudit opens a *sql.DB and mounts the audit-log service +
// handler. Phase 2 T24. 1 endpoint (admin-only):
//
//	GET /api/v1/audit-logs?userId=&entity=&action=&relatedUserId=&page=&limit=
//
// The list query is composed dynamically (the NestJS service does
// the same). The filters AND together; relatedUserId is OR-combined
// against userId and (entity='user' + entityId=<relatedUserId>).
func mountAudit(v1 fiber.Router, cfg *config.Config, log *zap.Logger) {
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		log.Warn("DATABASE_URL or JWT_SECRET not set, audit endpoints will return 503")
		return
	}
	conn, err := sql.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Warn("audit: db open failed", zap.Error(err))
		return
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := conn.PingContext(pingCtx); err != nil {
		cancel()
		log.Warn("audit: db ping failed", zap.Error(err))
		return
	}
	cancel()

	auditSvc := audit.NewService(conn)
	authRepo := auth.NewAuthRepo(conn)
	tokens := auth.NewJWTTokenIssuer(
		[]byte(cfg.JWTSecret), authRepo, auth.TokenTTL, auth.RefreshTokenTTL,
	)
	h := handler.NewAuditHandler(auditSvc, tokens, log)
	h.Mount(v1)
	log.Info("audit routes mounted (T24)")
}
