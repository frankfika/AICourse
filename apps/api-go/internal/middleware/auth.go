// Package middleware — Fiber middlewares shared by the Go API.
//
// Phase 2 T11: extracted from internal/handler/auth.go so the users
// handler and identities handler can reuse the JWT verification path.
// The auth handler still calls NewAuth (which builds requireAuth + the
// "me" handler around it), but requireAuth itself now lives here.
package middleware

import (
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/gofiber/fiber/v2"
)

// AuthClaims is the key under which requireAuth stores the verified JWT
// claims in c.Locals. Handlers read it with GetClaims(c).
const AuthClaims = "auth_claims"

// RequireAuth returns a Fiber middleware that:
//  1. Reads the Authorization: Bearer <token> header.
//  2. Verifies the token via the auth.TokenIssuer (HS256 by default).
//  3. On success, stores the verified *auth.Claims in c.Locals(AuthClaims).
//  4. On failure, returns 401 with the NestJS error envelope.
//
// Mirrors JwtAuthGuard in apps/api/src/common/guards/jwt-auth.guard.ts.
func RequireAuth(tokens auth.TokenIssuer) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authz := c.Get("Authorization")
		if !strings.HasPrefix(authz, "Bearer ") {
			return errs.Unauthorized("missing or invalid Authorization header")
		}
		raw := strings.TrimPrefix(authz, "Bearer ")
		claims, err := tokens.Verify(c.Context(), raw)
		if err != nil {
			return errs.Unauthorized("invalid or expired access token")
		}
		c.Locals(AuthClaims, &claims)
		return c.Next()
	}
}

// GetClaims fetches the verified claims from c.Locals. Returns nil if
// requireAuth didn't run (e.g. the route wasn't gated).
func GetClaims(c *fiber.Ctx) *auth.Claims {
	v := c.Locals(AuthClaims)
	if v == nil {
		return nil
	}
	claims, _ := v.(*auth.Claims)
	return claims
}

// RequireRole is a middleware that runs after RequireAuth and rejects
// callers whose role isn't in the allowed set. Mirrors RolesGuard in
// apps/api/src/common/guards/roles.guard.ts.
func RequireRole(allowed ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		claims := GetClaims(c)
		if claims == nil {
			return errs.Unauthorized("missing auth claims")
		}
		for _, r := range allowed {
			if claims.Role == r {
				return c.Next()
			}
		}
		return errs.Forbidden("insufficient role")
	}
}

// OptionalAuth runs RequireAuth if an Authorization header is present,
// and is otherwise a no-op. Mirrors NestJS's OptionalJwtAuthGuard in
// apps/api/src/common/guards/optional-jwt-auth.guard.ts — used on
// public routes that want to personalize the response when the caller
// is signed in (e.g. show draft courses only to admins) but don't
// otherwise require auth.
func OptionalAuth(tokens auth.TokenIssuer) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authz := c.Get("Authorization")
		if authz == "" {
			return c.Next()
		}
		if !strings.HasPrefix(authz, "Bearer ") {
			return c.Next() // bad header — ignore, let downstream guard reject if needed
		}
		raw := strings.TrimPrefix(authz, "Bearer ")
		claims, err := tokens.Verify(c.Context(), raw)
		if err != nil {
			return c.Next() // invalid token — ignore, same reasoning
		}
		c.Locals(AuthClaims, &claims)
		return c.Next()
	}
}
