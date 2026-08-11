// Package handler — Fiber HTTP handlers.
//
// Phase 1 T7 wires the auth flow end-to-end: register / login / refresh /
// logout / me. The handler is intentionally thin — all business logic lives
// in the auth package and the AuthRepo; the handler just maps HTTP <-> Go
// types and applies the NestJS-compatible error envelope.
package handler

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// AuthHandler bundles everything the auth routes need.
type AuthHandler struct {
	svc    *auth.AuthService
	repo   *auth.AuthRepo
	tokens auth.TokenIssuer
	cfg    AuthHandlerConfig
	log    *zap.Logger
}

// AuthHandlerConfig holds runtime knobs.
type AuthHandlerConfig struct {
	Env             string // "production" | "development" | "test"
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

// NewAuthHandler constructs the handler. The TokenIssuer is built by the
// caller (typically main.go) so the JWT secret can come from config.
func NewAuthHandler(svc *auth.AuthService, repo *auth.AuthRepo, tokens auth.TokenIssuer, cfg AuthHandlerConfig, log *zap.Logger) *AuthHandler {
	return &AuthHandler{svc: svc, repo: repo, tokens: tokens, cfg: cfg, log: log}
}

// Mount registers all /api/v1/auth/* routes on the given Fiber app/group.
//
// Phase 1 routes (T7) + Phase 2 T8 (OAuth/SSO + identity management):
//
//	POST /auth/register
//	POST /auth/login
//	POST /auth/refresh
//	POST /auth/logout
//	GET  /auth/me
//	GET  /auth/providers
//	GET  /auth/identities                              (auth)
//	DELETE /auth/identities/:id                        (auth)
//	GET  /auth/:providerId/start                      (init OAuth/SAML flow)
//	POST /auth/:providerId                             (direct authenticate)
//	POST /auth/:providerId/callback                    (OAuth/SAML callback)
//	GET  /auth/:providerId/link/start                  (link flow, auth)
//	POST /auth/:providerId/link/callback               (link flow, auth)
//
// Order matters: the static paths (providers, identities, register,
// login, refresh, logout, me) MUST register before the `:providerId`
// catch-alls. Fiber routes match in order.
func (h *AuthHandler) Mount(router fiber.Router) {
	g := router.Group("/auth")
	g.Get("/providers", h.listProviders)
	g.Post("/register", h.register)
	g.Post("/login", h.login)
	g.Post("/refresh", h.refresh)
	g.Post("/logout", h.logout)
	g.Get("/me", middleware.RequireAuth(h.tokens), h.me)

	// Identity list/unlink live in identities.go (IdentitiesHandler) and
	// mount after this handler — that handler enforces the last-primary
	// guard via users.Service.UnlinkIdentity. Don't re-register /identities
	// here: Fiber dispatches to whichever handler mounted first, and the
	// last-primary guard has to win.

	// OAuth / SSO flows. The :providerId catch-all matches last.
	g.Get("/:providerId/start", h.startProvider)
	g.Post("/:providerId", h.authenticate)
	g.Post("/:providerId/callback", h.providerCallback)
	g.Get("/:providerId/link/start", middleware.RequireAuth(h.tokens), h.startLink)
	g.Post("/:providerId/link/callback", middleware.RequireAuth(h.tokens), h.linkCallback)
}

// listProviders returns the enabled providers so the frontend can render
// the right "Sign in with X" buttons.
func (h *AuthHandler) listProviders(c *fiber.Ctx) error {
	providers := h.svc.List()
	return c.JSON(fiber.Map{"providers": providers})
}

// register creates a new user + issues a TokenPair.
//
//	POST /api/v1/auth/register
//	body: { email, password, name }
func (h *AuthHandler) register(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if !auth.ValidateEmailPublic(body.Email) || !auth.ValidatePasswordPublic(body.Password) {
		return errs.BadRequest("invalid email or password format")
	}

	result, err := h.svc.Authenticate(c.Context(), "email_password", auth.AuthCredentials{
		"email":    body.Email,
		"password": body.Password,
		"name":     body.Name,
		"mode":     "register",
	})
	if err != nil {
		return mapAuthError(err)
	}

	// Resolve userID by email. The dispatcher doesn't have a SQL handle, so
	// the handler looks up the user record here. On register the email_password
	// provider just created the row, so it MUST exist.
	user, err := h.repo.GetUserByEmail(c.Context(), result.Identity.Profile.Email)
	if err != nil {
		return errs.Internal("resolve user after register: "+err.Error(), err)
	}

	// Issue tokens.
	pair, err := h.tokens.Issue(c.Context(), user.ID, user.Email, defaultRole)
	if err != nil {
		return errs.Internal("issue tokens: "+err.Error(), err)
	}
	h.setRefreshCookie(c, pair.RefreshToken)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"accessToken": pair.AccessToken,
		"user": fiber.Map{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  defaultRole,
		},
	})
}

// login authenticates an existing user and issues a fresh TokenPair.
//
//	POST /api/v1/auth/login
//	body: { email, password }
func (h *AuthHandler) login(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if body.Email == "" || body.Password == "" {
		return errs.BadRequest("email and password are required")
	}

	result, err := h.svc.Authenticate(c.Context(), "email_password", auth.AuthCredentials{
		"email":    body.Email,
		"password": body.Password,
		"mode":     "login",
	})
	if err != nil {
		return mapAuthError(err)
	}

	// Resolve userID by email (same as register).
	user, err := h.repo.GetUserByEmail(c.Context(), result.Identity.Profile.Email)
	if err != nil {
		return errs.Internal("resolve user after login: "+err.Error(), err)
	}

	// Issue the JWT with the user's actual role (not the defaultRole
	// hardcoded for register). Admin users must end up with role=admin
	// in the token so role-gated endpoints accept them.
	pair, err := h.tokens.Issue(c.Context(), user.ID, user.Email, string(user.Role))
	if err != nil {
		return errs.Internal("issue tokens: "+err.Error(), err)
	}
	h.setRefreshCookie(c, pair.RefreshToken)

	return c.JSON(fiber.Map{
		"accessToken": pair.AccessToken,
		"user": fiber.Map{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  string(user.Role),
		},
	})
}

// refresh rotates the refresh token (read from the httpOnly cookie) and
// issues a new TokenPair. The old refresh token is revoked. If the presented
// token has already been rotated, this is a reuse signal and we return 401.
//
//	POST /api/v1/auth/refresh
//	cookie: refresh_token=<opaque>
func (h *AuthHandler) refresh(c *fiber.Ctx) error {
	old := c.Cookies("refresh_token")
	if old == "" {
		return errs.Unauthorized("missing refresh token")
	}

	pair, err := h.tokens.RotateRefreshToken(c.Context(), old)
	if err != nil {
		if errors.Is(err, auth.ErrTokenReuse) {
			// Compromise signal. The old token is gone; we can't tell which
			// user it belonged to, so we can't revoke all their tokens. Just
			// return 401 and log a warning so the SOC team can correlate.
			h.log.Warn("refresh token reuse detected — possible token compromise",
				zap.String("request_id", c.Get("X-Request-Id")))
			return errs.Unauthorized("refresh token reuse detected")
		}
		if errors.Is(err, auth.ErrInvalidToken) {
			return errs.Unauthorized("invalid or expired refresh token")
		}
		return errs.Internal("rotate token: "+err.Error(), err)
	}

	h.setRefreshCookie(c, pair.RefreshToken)

	// Decode the new access token's claims to get user identity for the response.
	claims, err := h.tokens.Verify(c.Context(), pair.AccessToken)
	if err != nil {
		return errs.Internal("verify new token: "+err.Error(), err)
	}
	return c.JSON(fiber.Map{
		"accessToken": pair.AccessToken,
		"user": fiber.Map{
			"id":    claims.UserID,
			"email": claims.Email,
			"role":  claims.Role,
		},
	})
}

// logout revokes the refresh token presented via cookie and clears it.
//
//	POST /api/v1/auth/logout
//	cookie: refresh_token=<opaque>
func (h *AuthHandler) logout(c *fiber.Ctx) error {
	if old := c.Cookies("refresh_token"); old != "" {
		if err := h.repo.DropUserFromToken(c.Context(), old); err != nil {
			// Best-effort. Log and continue.
			h.log.Warn("logout: drop refresh token", zap.Error(err))
		}
	}
	c.Cookie(h.clearRefreshCookie())
	return c.JSON(fiber.Map{"message": "Logged out"})
}

// me returns the current user's profile. Requires a valid access token.
//
//	GET /api/v1/auth/me
//	header: Authorization: Bearer <jwt>
func (h *AuthHandler) me(c *fiber.Ctx) error {
	claims, ok := c.Locals("auth_claims").(*auth.Claims)
	if !ok {
		return errs.Unauthorized("missing auth context")
	}
	if claims == nil {
		return errs.Unauthorized("missing auth context")
	}
	user, err := h.repo.GetUserByID(c.Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, auth.ErrNotFound) {
			return errs.NotFound("user not found")
		}
		return errs.Internal("get user: "+err.Error(), err)
	}
	return c.JSON(fiber.Map{
		"id":    user.ID,
		"email": user.Email,
		"name":  user.Name,
		"role":  string(user.Role),
	})
}

// requireAuth is now in internal/middleware/auth.go so users/identities
// handlers can share the JWT verification path. The local helper is kept
// as a thin alias for the few callers that already reference it; new code
// should call middleware.RequireAuth(h.tokens) directly.

// setRefreshCookie writes the httpOnly refresh token cookie with the
// NestJS-compatible attributes:
//   - httpOnly:    true (JS can't read it)
//   - secure:      true in production
//   - sameSite:    "strict" in production, "lax" in dev/test
//   - path:        /api/v1/auth
//   - maxAge:      7 days
func (h *AuthHandler) setRefreshCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    token,
		HTTPOnly: true,
		Secure:   h.cfg.Env == "production",
		SameSite: sameSiteFor(h.cfg.Env),
		Path:     "/api/v1/auth",
		MaxAge:   int(h.cfg.RefreshTokenTTL.Seconds()),
	})
}

func (h *AuthHandler) clearRefreshCookie() *fiber.Cookie {
	return &fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HTTPOnly: true,
		Secure:   h.cfg.Env == "production",
		SameSite: sameSiteFor(h.cfg.Env),
		Path:     "/api/v1/auth",
		MaxAge:   -1, // delete
	}
}

func sameSiteFor(env string) string {
	if env == "production" {
		return "Strict"
	}
	return "Lax"
}

// mapAuthError translates a provider-layer error into a NestJS-compatible
// HTTP envelope. Lives here (not in the auth package) so the auth package
// stays free of HTTP semantics.
func mapAuthError(err error) error {
	// errs.AppError instances carry their own status code — pass them through
	// unchanged so the provider's intent (400/401/409/422) survives the
	// wrapping done by errs.Conflict, errs.Unauthorized, etc.
	var ae *errs.AppError
	if errors.As(err, &ae) {
		return ae
	}
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials):
		return errs.Unauthorized("invalid credentials")
	case errors.Is(err, auth.ErrEmailTaken):
		return errs.Conflict("email already registered")
	case errors.Is(err, auth.ErrUserNotFound):
		return errs.NotFound("user not found")
	case errors.Is(err, auth.ErrProviderDisabled):
		return errs.BadRequest("auth provider not available")
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return errs.Internal(fmt.Sprintf("auth: %v", err), err)
	default:
		return errs.Internal(err.Error(), err)
	}
}

// ============ T8: OAuth / SSO ============
//
// /auth/identities GET + DELETE are mounted by IdentitiesHandler.Mount
// (see identities.go) so the last-primary guard can run via
// users.Service.UnlinkIdentity. Don't re-register those routes here.

// startProvider is the start step of the OAuth / SSO flow. Returns
// the IdP authorization URL the client should redirect the user to.
//
//	GET /auth/:providerId/start
func (h *AuthHandler) startProvider(c *fiber.Ctx) error {
	providerID := auth.ProviderID(c.Params("providerId"))
	auth, err := h.svc.CreateAuthorization(c.Context(), providerID)
	if err != nil {
		return mapAuthError(err)
	}
	return c.JSON(auth)
}

// authenticate is the "POST credentials directly" path. Used for
// email_password (login/register) and as a non-browser entry point
// for OAuth (mobile apps passing the code in a body).
//
//	POST /auth/:providerId
func (h *AuthHandler) authenticate(c *fiber.Ctx) error {
	providerID := auth.ProviderID(c.Params("providerId"))
	var body map[string]any
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if len(body) == 0 {
		return errs.BadRequest("missing credentials")
	}
	result, err := h.svc.Authenticate(c.Context(), providerID, body)
	if err != nil {
		return mapAuthError(err)
	}
	// Resolve user + issue token. For OAuth flows the email_password
	// provider has already upserted the user via AuthService (TBD in
	// T8.1); for now we look up by email like the login flow.
	user, err := h.repo.GetUserByEmail(c.Context(), result.Identity.Profile.Email)
	if err != nil {
		return errs.Internal("resolve user: "+err.Error(), err)
	}
	pair, err := h.tokens.Issue(c.Context(), user.ID, user.Email, string(user.Role))
	if err != nil {
		return errs.Internal("issue tokens: "+err.Error(), err)
	}
	h.setRefreshCookie(c, pair.RefreshToken)
	return c.JSON(fiber.Map{
		"accessToken": pair.AccessToken,
		"user": fiber.Map{
			"id": user.ID, "email": user.Email, "name": user.Name, "role": string(user.Role),
		},
	})
}

// providerCallback is the OAuth / SAML callback. Reads { code, state }
// from the body (or query for SAML form posts) and calls Verify.
//
//	POST /auth/:providerId/callback
func (h *AuthHandler) providerCallback(c *fiber.Ctx) error {
	providerID := auth.ProviderID(c.Params("providerId"))
	creds := map[string]any{}
	if err := c.BodyParser(&creds); err != nil {
		// SAML can POST as application/x-www-form-urlencoded; try query.
		creds["code"] = c.Query("code")
		creds["state"] = c.Query("state")
	}
	if v, ok := creds["code"].(string); !ok || v == "" {
		creds["code"] = c.Query("code")
	}
	if v, ok := creds["state"].(string); !ok || v == "" {
		creds["state"] = c.Query("state")
	}
	result, err := h.svc.AuthenticateCallback(c.Context(), providerID, creds)
	if err != nil {
		return mapAuthError(err)
	}
	user, err := h.repo.GetUserByEmail(c.Context(), result.Identity.Profile.Email)
	if err != nil {
		return errs.Internal("resolve user: "+err.Error(), err)
	}
	pair, err := h.tokens.Issue(c.Context(), user.ID, user.Email, string(user.Role))
	if err != nil {
		return errs.Internal("issue tokens: "+err.Error(), err)
	}
	h.setRefreshCookie(c, pair.RefreshToken)
	return c.JSON(fiber.Map{
		"accessToken": pair.AccessToken,
		"user": fiber.Map{
			"id": user.ID, "email": user.Email, "name": user.Name, "role": string(user.Role),
		},
	})
}

// startLink begins a link flow for an already-authenticated user.
// Returns the IdP URL the user should be redirected to.
//
//	GET /auth/:providerId/link/start
func (h *AuthHandler) startLink(c *fiber.Ctx) error {
	claims, ok := c.Locals("auth_claims").(*auth.Claims)
	if !ok || claims == nil {
		return errs.Unauthorized("missing auth context")
	}
	providerID := auth.ProviderID(c.Params("providerId"))
	authz, err := h.svc.CreateLinkAuthorization(c.Context(), claims.UserID, providerID)
	if err != nil {
		return mapAuthError(err)
	}
	return c.JSON(authz)
}

// linkCallback completes the link flow: verifies the IdP response
// and records the new (user, provider) binding in
// user_provider_accounts.
//
//	POST /auth/:providerId/link/callback
func (h *AuthHandler) linkCallback(c *fiber.Ctx) error {
	claims, ok := c.Locals("auth_claims").(*auth.Claims)
	if !ok || claims == nil {
		return errs.Unauthorized("missing auth context")
	}
	providerID := auth.ProviderID(c.Params("providerId"))
	var body map[string]any
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if err := h.svc.LinkIdentity(c.Context(), claims.UserID, providerID, body); err != nil {
		return mapAuthError(err)
	}
	return c.JSON(fiber.Map{"ok": true})
}

// defaultRole is the role assigned to freshly registered users via the
// email_password flow. NestJS does the same (Role.student in Prisma enum).
const defaultRole = "student"
