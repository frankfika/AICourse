// Package handler — Fiber HTTP handlers for the hackathons module.
//
// Phase 2 T19: ports the 10 user-facing + admin endpoints of
// apps/api/src/modules/hackathons/hackathons.controller.ts. Teams /
// submissions / judges / sponsors endpoints are deferred to T19.1.
//
// Routes (mounted under /api/v1/hackathons):
//
//	GET    /                                  public list (OptionalAuth)
//	GET    /:id                               public detail (OptionalAuth)
//	GET    /:id/announcements                 public list
//	POST   /                                  admin create
//	PATCH  /:id                               admin update
//	DELETE /:id                               admin soft-delete (status='cancelled')
//	POST   /:id/announcements                 admin create
//	POST   /:id/register                      auth register
//	POST   /:id/cancel                        auth cancel
//	GET    /:id/my-registration               auth self-lookup
//
// Route ordering note (Fiber caveat): static paths (announcements) must
// be registered BEFORE the :id catch-all sub-routes that share the same
// prefix. Fiber matches in registration order, so the announcements
// routes are mounted first inside the group to avoid :id swallowing them.
package handler

import (
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/hackathons"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// HackathonsHandler bundles the service + JWT verifier.
type HackathonsHandler struct {
	svc    *hackathons.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewHackathonsHandler builds a handler.
func NewHackathonsHandler(svc *hackathons.Service, tokens auth.TokenIssuer, log *zap.Logger) *HackathonsHandler {
	return &HackathonsHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers all hackathons routes.
func (h *HackathonsHandler) Mount(router fiber.Router) {
	g := router.Group("/hackathons")

	// Public list + detail with OptionalAuth so admins can see drafts
	// (here: rows whose status would otherwise be hidden by the
	// effective-status filter; same pattern as courses).
	g.Get("/", middleware.OptionalAuth(h.tokens), h.list)
	g.Get("/:id", middleware.OptionalAuth(h.tokens), h.get)

	// Public announcements list.
	g.Get("/:id/announcements", h.listAnnouncements)

	// Public sub-resource lists.
	g.Get("/:id/teams", h.listTeams)
	g.Get("/:id/judges", h.listJudges)
	g.Get("/:id/sponsors", h.listSponsors)

	// Admin mutations.
	admin := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}
	g.Post("/", append(admin, h.create)...)
	g.Patch("/:id", append(admin, h.update)...)
	g.Delete("/:id", append(admin, h.delete)...)
	g.Post("/:id/announcements", append(admin, h.createAnnouncement)...)

	// Admin: judges + sponsors CRUD.
	g.Post("/:id/judges", append(admin, h.addJudge)...)
	g.Patch("/:id/judges/:judgeId", append(admin, h.updateJudge)...)
	g.Delete("/:id/judges/:judgeId", append(admin, h.removeJudge)...)
	g.Post("/:id/sponsors", append(admin, h.addSponsor)...)
	g.Patch("/:id/sponsors/:sponsorId", append(admin, h.updateSponsor)...)
	g.Delete("/:id/sponsors/:sponsorId", append(admin, h.removeSponsor)...)

	// Admin: submissions judge + all-list.
	g.Get("/:id/submissions/all", append(admin, h.listAllSubmissions)...)
	g.Post("/:id/submissions/:submissionId/judge", append(admin, h.judgeSubmission)...)

	// Authenticated user actions (registration lifecycle).
	authed := []fiber.Handler{middleware.RequireAuth(h.tokens)}
	g.Post("/:id/register", append(authed, h.register)...)
	g.Post("/:id/cancel", append(authed, h.cancel)...)
	g.Get("/:id/my-registration", append(authed, h.myRegistration)...)

	// Authenticated: teams create/join/leave.
	g.Post("/:id/teams", append(authed, h.createTeam)...)
	g.Post("/:id/teams/:teamId/join", append(authed, h.joinTeam)...)
	g.Post("/:id/teams/:teamId/leave", append(authed, h.leaveTeam)...)

	// Authenticated: my-submissions list + create + update.
	g.Get("/:id/submissions", append(authed, h.listMySubmissions)...)
	g.Post("/:id/submissions", append(authed, h.createSubmission)...)
	g.Patch("/:id/submissions/:submissionId", append(authed, h.updateSubmission)...)
}

// list returns the public hackathon list.
//
//	GET /api/v1/hackathons?status=&search=
func (h *HackathonsHandler) list(c *fiber.Ctx) error {
	userID := ""
	if claims := middleware.GetClaims(c); claims != nil {
		userID = claims.UserID
	}
	rows, err := h.svc.List(c.Context(), hackathons.ListParams{
		Status: c.Query("status", ""),
		Search: c.Query("search", ""),
		UserID: userID,
	})
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// get returns a single hackathon with its registration count.
//
//	GET /api/v1/hackathons/:id
func (h *HackathonsHandler) get(c *fiber.Ctx) error {
	userID := ""
	if claims := middleware.GetClaims(c); claims != nil {
		userID = claims.UserID
	}
	dto, err := h.svc.GetForUser(c.Context(), c.Params("id"), userID, true)
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// create inserts a new hackathon. Admin only.
//
//	POST /api/v1/hackathons
func (h *HackathonsHandler) create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	body, err := bindHackathonBody(c)
	if err != nil {
		return err
	}
	dto, err := h.svc.Create(c.Context(), body, claims.UserID)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// update applies a partial update. Admin only.
//
//	PATCH /api/v1/hackathons/:id
func (h *HackathonsHandler) update(c *fiber.Ctx) error {
	body, err := bindHackathonBody(c)
	if err != nil {
		return err
	}
	dto, err := h.svc.Update(c.Context(), c.Params("id"), body)
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// delete soft-deletes a hackathon (status='cancelled'). Admin only.
//
//	DELETE /api/v1/hackathons/:id
func (h *HackathonsHandler) delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"message": "Hackathon deleted"})
}

// register adds the caller to the hackathon's registration list.
//
//	POST /api/v1/hackathons/:id/register
func (h *HackathonsHandler) register(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	dto, err := h.svc.Register(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	// Always 201 (mirrors NestJS). Re-registration returns the existing
	// row, but the HTTP semantic stays "create or get".
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// cancel marks the caller's registration as cancelled.
//
//	POST /api/v1/hackathons/:id/cancel
func (h *HackathonsHandler) cancel(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	dto, err := h.svc.CancelRegistration(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// myRegistration returns the caller's current registration state, or
// null if they've never registered.
//
//	GET /api/v1/hackathons/:id/my-registration
func (h *HackathonsHandler) myRegistration(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	dto, err := h.svc.MyRegistration(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	if dto == nil {
		// Mirror NestJS: returns null on no-registration.
		return c.JSON(nil)
	}
	return c.JSON(dto)
}

// listAnnouncements returns the public announcement list for a hackathon.
//
//	GET /api/v1/hackathons/:id/announcements
func (h *HackathonsHandler) listAnnouncements(c *fiber.Ctx) error {
	rows, err := h.svc.ListAnnouncements(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// createAnnouncement inserts a new announcement. Admin only.
//
//	POST /api/v1/hackathons/:id/announcements
func (h *HackathonsHandler) createAnnouncement(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		IsPinned bool   `json:"isPinned"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.CreateAnnouncement(
		c.Context(),
		c.Params("id"),
		claims.UserID,
		body.Title,
		body.Content,
		body.IsPinned,
	)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// bindHackathonBody parses the request body into the hackathons.CreateInput
// shape. Used by both create and update. Returns 400 on malformed input.
//
// Dates are accepted as RFC3339 strings (e.g. "2026-12-31T00:00:00Z").
// Optional timestamps can be null/absent.
func bindHackathonBody(c *fiber.Ctx) (hackathons.CreateInput, error) {
	var raw struct {
		Title                  string     `json:"title"`
		Description            string     `json:"description"`
		BannerURL              string     `json:"bannerUrl"`
		Status                 string     `json:"status"`
		StartDate              *time.Time `json:"startDate"`
		EndDate                *time.Time `json:"endDate"`
		RegisterDeadline       *time.Time `json:"registerDeadline"`
		SubmissionDeadline     *time.Time `json:"submissionDeadline"`
		MaxTeamSize            int32      `json:"maxTeamSize"`
		MinTeamSize            int32      `json:"minTeamSize"`
		Location               string     `json:"location"`
		Rules                  string     `json:"rules"`
		SubmissionRequirements string     `json:"submissionRequirements"`
		Prizes                 string     `json:"prizes"`
		RegistrationURL        string     `json:"registrationUrl"`
		RegistrationLabel      string     `json:"registrationLabel"`
		OrganizerID            string     `json:"organizerId"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return hackathons.CreateInput{}, errs.BadRequest("invalid request body")
	}
	out := hackathons.CreateInput{
		Title:                  raw.Title,
		Description:            raw.Description,
		BannerURL:              raw.BannerURL,
		Status:                 raw.Status,
		MaxTeamSize:            raw.MaxTeamSize,
		MinTeamSize:            raw.MinTeamSize,
		Location:               raw.Location,
		Rules:                  raw.Rules,
		SubmissionRequirements: raw.SubmissionRequirements,
		Prizes:                 raw.Prizes,
		RegistrationURL:        raw.RegistrationURL,
		RegistrationLabel:      raw.RegistrationLabel,
		OrganizerID:            raw.OrganizerID,
	}
	if raw.StartDate != nil {
		out.StartDate = *raw.StartDate
	}
	if raw.EndDate != nil {
		out.EndDate = *raw.EndDate
	}
	if raw.RegisterDeadline != nil {
		t := *raw.RegisterDeadline
		out.RegisterDeadline = &t
	}
	if raw.SubmissionDeadline != nil {
		t := *raw.SubmissionDeadline
		out.SubmissionDeadline = &t
	}
	return out, nil
}
