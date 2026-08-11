// Package handler — Fiber HTTP handlers for the users module.
//
// Phase 2 T11: ports the 11 endpoints of
// apps/api/src/modules/users/users.controller.ts to Fiber. The handler
// is intentionally thin — all business rules live in internal/users and
// all SQL lives in internal/repo/db (sqlc-generated). The handler maps
// HTTP <-> Go types and applies the NestJS-compatible error envelope.
package handler

import (
	"strconv"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/frankfika/ai-academy/api-go/internal/users"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// UsersHandler bundles the service + JWT verifier for the users routes.
type UsersHandler struct {
	svc    *users.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewUsersHandler builds a handler.
func NewUsersHandler(svc *users.Service, tokens auth.TokenIssuer, log *zap.Logger) *UsersHandler {
	return &UsersHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all /api/v1/users/* routes on the given Fiber app/group.
//
// The route set is the Phase 2 T11 critical path. NestJS has 11 users
// routes; we implement all 11 here, with role-based access for the
// admin-only ones.
func (h *UsersHandler) Mount(router fiber.Router) {
	g := router.Group("/users")

	// Authenticated (any role) routes.
	g.Get("/me", middleware.RequireAuth(h.tokens), h.getMe)
	g.Post("/me/change-password", middleware.RequireAuth(h.tokens), h.changePasswordOwn)

	// Admin-only routes.
	g.Get("/", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.list)
	g.Get("/:id", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.getOne)
	g.Post("/", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.create)
	g.Patch("/:id", middleware.RequireAuth(h.tokens), h.update) // self OR admin
	g.Post("/:id/reset-password", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.resetPassword)
	g.Delete("/:id", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.disable)
	g.Post("/:id/restore", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.restore)
	g.Post("/:id/grant-course", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.grantCourse)
	g.Post("/:id/grant-degree", middleware.RequireAuth(h.tokens), middleware.RequireRole("admin"), h.grantDegree)
}

// ============ /me ============

// getMe returns the current user's public profile (no passwordHash).
//
//	GET /api/v1/users/me
func (h *UsersHandler) getMe(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	d, err := h.svc.GetDetail(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(publicUserView(d.User))
}

// ============ admin: list / get ============

// list returns paginated users. Admin only.
//
//	GET /api/v1/users?role=student&search=foo&page=1&limit=20&status=active
func (h *UsersHandler) list(c *fiber.Ctx) error {
	p := users.ListParams{
		Role:   c.Query("role", ""),
		Search: c.Query("search", ""),
		Status: c.Query("status", "active"),
	}
	p.Page, _ = strconv.Atoi(c.Query("page", "1"))
	p.Limit, _ = strconv.Atoi(c.Query("limit", "20"))
	res, err := h.svc.List(c.Context(), p)
	if err != nil {
		return err
	}
	// Drop passwordHash from each row before sending.
	data := make([]fiber.Map, 0, len(res.Data))
	for _, u := range res.Data {
		data = append(data, publicUserView(u))
	}
	return c.JSON(fiber.Map{
		"data":  data,
		"total": res.Total,
		"page":  res.Page,
		"limit": res.Limit,
	})
}

// getOne returns a user with admin detail-drawer data. Admin only.
//
//	GET /api/v1/users/:id
func (h *UsersHandler) getOne(c *fiber.Ctx) error {
	id := c.Params("id")
	d, err := h.svc.GetDetail(c.Context(), id)
	if err != nil {
		return err
	}
	// NestJS returns the user with `enrollments/orders/...` as siblings
	// of the user fields. We mirror that by combining publicUserView
	// (without passwordHash) with the Detail wrapper.
	out := publicUserView(d.User)
	out["enrollments"] = d.Enrollments
	out["orders"] = d.Orders
	out["certificates"] = d.Certificates
	out["pointTransactions"] = d.PointTransactions
	out["_count"] = d.Counts
	return c.JSON(out)
}

// create inserts a new user. Admin only.
//
//	POST /api/v1/users
func (h *UsersHandler) create(c *fiber.Ctx) error {
	var in users.CreateInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	u, err := h.svc.Create(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicUserView(u))
}

// update applies a partial update. Self OR admin.
//
//	PATCH /api/v1/users/:id
func (h *UsersHandler) update(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	var body struct {
		Name      *string `json:"name"`
		AvatarURL *string `json:"avatarUrl"`
		Role      *string `json:"role"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	uc := users.UpdateContext{ActorUserID: claims.UserID, IsAdmin: claims.Role == "admin"}
	u, err := h.svc.Update(c.Context(), id, users.UpdateInput{
		Name: body.Name, AvatarURL: body.AvatarURL, Role: body.Role,
	}, uc)
	if err != nil {
		return err
	}
	return c.JSON(publicUserView(u))
}

// changePasswordOwn changes the current user's password.
//
//	POST /api/v1/users/me/change-password
func (h *UsersHandler) changePasswordOwn(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	if err := h.svc.ChangePassword(c.Context(), claims.UserID, users.ChangePasswordInput{
		CurrentPassword: body.CurrentPassword,
		NewPassword:     body.NewPassword,
	}); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"changed": true})
}

// resetPassword generates a one-time temporary password. Admin only.
//
//	POST /api/v1/users/:id/reset-password
func (h *UsersHandler) resetPassword(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	temp, err := h.svc.ResetPassword(c.Context(), id, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"temporaryPassword":     temp,
		"passwordResetRequired": true,
	})
}

// disable soft-deletes a user. Admin only.
//
//	DELETE /api/v1/users/:id
func (h *UsersHandler) disable(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	if err := h.svc.Disable(c.Context(), id, claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"id": id, "deletedAt": true})
}

// restore re-activates a soft-deleted user. Admin only.
//
//	POST /api/v1/users/:id/restore
func (h *UsersHandler) restore(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	u, err := h.svc.Restore(c.Context(), id, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(publicUserView(u))
}

// grantCourse grants course access. Admin only.
//
//	POST /api/v1/users/:id/grant-course
func (h *UsersHandler) grantCourse(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	var body struct {
		CourseIDs []string `json:"courseIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	n, err := h.svc.GrantCourseAccess(c.Context(), id, body.CourseIDs, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"granted": n})
}

// grantDegree grants degree access. Admin only.
//
//	POST /api/v1/users/:id/grant-degree
func (h *UsersHandler) grantDegree(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	id := c.Params("id")
	var body struct {
		DegreeIDs []string `json:"degreeIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	n, err := h.svc.GrantDegreeAccess(c.Context(), id, body.DegreeIDs, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"granted": n})
}

// publicUserView returns a fiber.Map with the user fields the frontend
// is allowed to see, dropping passwordHash. NestJS uses Prisma's
// `select` to do the same.
func publicUserView(u db.User) fiber.Map {
	avatar := ""
	if u.AvatarUrl.Valid {
		avatar = u.AvatarUrl.String
	}
	out := fiber.Map{
		"id":                    u.ID,
		"email":                 u.Email,
		"name":                  u.Name,
		"role":                  string(u.Role),
		"avatarUrl":             avatar,
		"passwordResetRequired": u.PasswordResetRequired,
		"points":                u.Points,
		"level":                 u.Level,
		"createdAt":             u.CreatedAt,
		"updatedAt":             u.UpdatedAt,
	}
	if u.LastLoginAt.Valid {
		out["lastLoginAt"] = u.LastLoginAt.Time
	} else {
		out["lastLoginAt"] = nil
	}
	if u.DeletedAt.Valid {
		out["deletedAt"] = u.DeletedAt.Time
	} else {
		out["deletedAt"] = nil
	}
	return out
}
