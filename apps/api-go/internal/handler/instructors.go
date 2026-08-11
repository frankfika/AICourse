// Package handler — Fiber HTTP handlers for the instructors module.
//
// Phase 2 T20: ports the 12 endpoints of
// apps/api/src/modules/instructors/instructors.controller.ts. The
// NestJS source uses three controllers
// (InstructorsPublicController / InstructorsAdminController /
// CourseInstructorsAdminController); we collapse them into one handler
// to keep the wiring compact and to honor Frank's T20 spec
// (instructor-centric course-link URLs).
//
// Phase 2 T24: also ports the 5 endpoints of
// apps/api/src/modules/instructors/expertises.controller.ts. The
// NestJS source uses two controllers (ExpertisesPublicController +
// ExpertisesAdminController); we collapse them into the same handler
// since they share the same JWT verifier and concern (instructor
// taxonomy).
//
// Public routes (3):
//
//	GET  /api/v1/instructors                  list (published only)
//	GET  /api/v1/instructors/:slug            detail by slug (published only)
//	GET  /api/v1/instructors/expertises       list all expertises
//
// Admin routes (14):
//
//	GET    /api/v1/admin/instructors                    list (any status)
//	GET    /api/v1/admin/instructors/:id                detail by id
//	POST   /api/v1/admin/instructors                    create
//	PATCH  /api/v1/admin/instructors/:id                partial update
//	DELETE /api/v1/admin/instructors/:id                soft delete
//	POST   /api/v1/admin/instructors/reorder            drag-sort
//	GET    /api/v1/admin/instructors/:id/course-links   list instructor's links
//	POST   /api/v1/admin/instructors/:id/course-links   add a link
//	PUT    /api/v1/admin/instructors/:id/course-links   bulk-replace links
//	DELETE /api/v1/admin/instructors/course-links/:linkId  remove a link
//	GET    /api/v1/admin/instructors/expertises         list expertises (admin view)
//	POST   /api/v1/admin/instructors/expertises         create expertise
//	PATCH  /api/v1/admin/instructors/expertises/:id     update expertise
//	DELETE /api/v1/admin/instructors/expertises/:id     delete expertise
package handler

import (
	"strconv"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/instructors"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// InstructorsHandler bundles the service + JWT verifier + the
// expertise service (T24). The two services share the same underlying
// *sql.DB / sqlc handle, so this is just method-level delegation.
type InstructorsHandler struct {
	svc        *instructors.Service
	expertiseS *instructors.ExpertiseService
	tokens     auth.TokenIssuer
	log        *zap.Logger
}

// NewInstructorsHandler builds a handler.
func NewInstructorsHandler(svc *instructors.Service, expertiseSvc *instructors.ExpertiseService, tokens auth.TokenIssuer, log *zap.Logger) *InstructorsHandler {
	return &InstructorsHandler{svc: svc, expertiseS: expertiseSvc, tokens: tokens, log: log}
}

// Mount wires public + admin routes.
//
// We mount the public group on /instructors and the admin group on
// /admin/instructors. They share the same service + handler; only
// the auth middleware differs.
func (h *InstructorsHandler) Mount(router fiber.Router) {
	// Public surface — no auth.
	pub := router.Group("/instructors")
	// T24: register /expertises BEFORE /:slug so the literal path
	// wins over the wildcard — Fiber matches in registration order.
	pub.Get("/expertises", h.publicListExpertises)
	pub.Get("/", h.publicList)
	pub.Get("/:slug", h.publicBySlug)

	// Admin surface — RequireAuth + RequireRole("admin").
	adminChain := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}
	admin := router.Group("/admin/instructors", adminChain...)

	admin.Get("/", h.adminList)
	admin.Get("/reorder", h.adminReorderReadStub) // unused, see below
	admin.Post("/reorder", h.adminReorder)

	// T24: expertise sub-routes (admin). The NestJS controller
	// exposes these under /admin/instructors/expertises; we mirror
	// that path so the admin UI doesn't need URL updates. Register
	// these BEFORE the /:id wildcard so the literal path wins.
	admin.Get("/expertises", h.adminListExpertises)
	admin.Post("/expertises", h.adminCreateExpertise)
	admin.Patch("/expertises/:id", h.adminUpdateExpertise)
	admin.Delete("/expertises/:id", h.adminDeleteExpertise)

	admin.Get("/:id", h.adminByID)
	admin.Post("/", h.adminCreate)
	admin.Patch("/:id", h.adminUpdate)
	admin.Delete("/:id", h.adminSoftDelete)

	// Course-link sub-routes (instructor-centric per T20).
	admin.Get("/:id/course-links", h.adminListCourseLinks)
	admin.Post("/:id/course-links", h.adminAddCourseLink)
	admin.Put("/:id/course-links", h.adminSyncCourseLinks)
	admin.Delete("/course-links/:linkId", h.adminRemoveCourseLink)
}

// adminReorderReadStub swallows GET /admin/instructors/reorder so it
// doesn't 404 — clients sometimes probe routes before POST. Returns
// the same 405 a strict REST framework would emit.
func (h *InstructorsHandler) adminReorderReadStub(c *fiber.Ctx) error {
	return fiber.NewError(fiber.StatusMethodNotAllowed, "use POST")
}

// ============ public ============

// publicList is the public catalog of published instructors.
//
//	GET /api/v1/instructors?search=&sort=&page=&limit=
func (h *InstructorsHandler) publicList(c *fiber.Ctx) error {
	p := instructors.ListParams{
		Search: c.Query("search", ""),
		Sort:   c.Query("sort", ""),
	}
	p.Page, _ = strconv.Atoi(c.Query("page", "1"))
	p.Limit, _ = strconv.Atoi(c.Query("limit", "24"))
	res, err := h.svc.List(c.Context(), p, true /* publishedOnly */)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"items":      res.Data,
		"total":      res.Total,
		"page":       res.Page,
		"limit":      res.Limit,
		"totalPages": res.TotalPages,
	})
}

// publicBySlug returns a single published instructor by slug.
//
//	GET /api/v1/instructors/:slug
func (h *InstructorsHandler) publicBySlug(c *fiber.Ctx) error {
	view, err := h.svc.GetBySlug(c.Context(), c.Params("slug"), true)
	if err != nil {
		return err
	}
	return c.JSON(view)
}

// ============ admin list / detail ============

// adminList is the admin catalog (any status, no published filter).
//
//	GET /api/v1/admin/instructors?search=&sort=&page=&limit=
func (h *InstructorsHandler) adminList(c *fiber.Ctx) error {
	p := instructors.ListParams{
		Search: c.Query("search", ""),
		Sort:   c.Query("sort", ""),
	}
	p.Page, _ = strconv.Atoi(c.Query("page", "1"))
	p.Limit, _ = strconv.Atoi(c.Query("limit", "24"))
	res, err := h.svc.List(c.Context(), p, false)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"items":      res.Data,
		"total":      res.Total,
		"page":       res.Page,
		"limit":      res.Limit,
		"totalPages": res.TotalPages,
	})
}

// adminByID returns a single instructor by id (admin / internal).
//
//	GET /api/v1/admin/instructors/:id
func (h *InstructorsHandler) adminByID(c *fiber.Ctx) error {
	view, err := h.svc.GetByID(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(view)
}

// ============ admin mutations ============

// adminCreate inserts a new instructor.
//
//	POST /api/v1/admin/instructors
func (h *InstructorsHandler) adminCreate(c *fiber.Ctx) error {
	in, err := bindInstructorCreateInput(c)
	if err != nil {
		return err
	}
	view, err := h.svc.Create(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(view)
}

// adminUpdate applies a partial update.
//
//	PATCH /api/v1/admin/instructors/:id
func (h *InstructorsHandler) adminUpdate(c *fiber.Ctx) error {
	in, err := bindInstructorUpdateInput(c)
	if err != nil {
		return err
	}
	view, err := h.svc.Update(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(view)
}

// adminSoftDelete sets published_at = NULL and unlinks all courses.
//
//	DELETE /api/v1/admin/instructors/:id
func (h *InstructorsHandler) adminSoftDelete(c *fiber.Ctx) error {
	view, err := h.svc.SoftDelete(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(view)
}

// adminReorder updates orderIndex for each id in the supplied list.
//
//	POST /api/v1/admin/instructors/reorder
//	body: { "orderedIds": ["c...", "c...", ...] }
func (h *InstructorsHandler) adminReorder(c *fiber.Ctx) error {
	var body struct {
		OrderedIDs []string `json:"orderedIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	n, err := h.svc.Reorder(c.Context(), body.OrderedIDs)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"reordered": n})
}

// ============ admin course links ============

// adminListCourseLinks returns the links for an instructor.
//
//	GET /api/v1/admin/instructors/:id/course-links
func (h *InstructorsHandler) adminListCourseLinks(c *fiber.Ctx) error {
	rows, err := h.svc.ListCourseLinks(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// adminAddCourseLink attaches one (course, instructor, role) link.
//
//	POST /api/v1/admin/instructors/:id/course-links
func (h *InstructorsHandler) adminAddCourseLink(c *fiber.Ctx) error {
	var body struct {
		CourseID   string `json:"courseId"`
		Role       string `json:"role"`
		IsPrimary  bool   `json:"isPrimary"`
		OrderIndex int32  `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	view, err := h.svc.AddCourseLink(c.Context(), c.Params("id"), instructors.LinkCourseInput{
		CourseID:   body.CourseID,
		Role:       body.Role,
		IsPrimary:  body.IsPrimary,
		OrderIndex: body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(view)
}

// adminSyncCourseLinks replaces the entire link set for an instructor.
//
//	PUT /api/v1/admin/instructors/:id/course-links
//	body: { "links": [{courseId, role, isPrimary, orderIndex}, ...] }
func (h *InstructorsHandler) adminSyncCourseLinks(c *fiber.Ctx) error {
	var body struct {
		Links []struct {
			CourseID   string `json:"courseId"`
			Role       string `json:"role"`
			IsPrimary  bool   `json:"isPrimary"`
			OrderIndex int32  `json:"orderIndex"`
		} `json:"links"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	links := make([]instructors.LinkCourseInput, 0, len(body.Links))
	for _, l := range body.Links {
		links = append(links, instructors.LinkCourseInput{
			CourseID:   l.CourseID,
			Role:       l.Role,
			IsPrimary:  l.IsPrimary,
			OrderIndex: l.OrderIndex,
		})
	}
	rows, err := h.svc.SyncCourseLinks(c.Context(), c.Params("id"), instructors.SyncLinksInput{Links: links})
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"instructorId": c.Params("id"),
		"links":        rows,
	})
}

// adminRemoveCourseLink deletes a single link by id.
//
//	DELETE /api/v1/admin/instructors/course-links/:linkId
func (h *InstructorsHandler) adminRemoveCourseLink(c *fiber.Ctx) error {
	if err := h.svc.RemoveCourseLink(c.Context(), c.Params("linkId")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("linkId")})
}

// ============ request body binders ============

// bindInstructorCreateInput parses a create-instructor request body.
// We use json.Number-style flexible ints (yearsOfExperience) and
// bool pointers (published) so we can distinguish "not supplied"
// from "supplied as zero value".
func bindInstructorCreateInput(c *fiber.Ctx) (instructors.CreateInput, error) {
	var raw struct {
		Slug              *string  `json:"slug"`
		Name              string   `json:"name"`
		NameEn            *string  `json:"nameEn"`
		Title             *string  `json:"title"`
		TitleEn           *string  `json:"titleEn"`
		Headline          *string  `json:"headline"`
		HeadlineEn        *string  `json:"headlineEn"`
		Bio               *string  `json:"bio"`
		BioEn             *string  `json:"bioEn"`
		AvatarURL         *string  `json:"avatarUrl"`
		Company           *string  `json:"company"`
		YearsOfExperience *int32   `json:"yearsOfExperience"`
		LinkedinURL       *string  `json:"linkedinUrl"`
		GithubURL         *string  `json:"githubUrl"`
		TwitterURL        *string  `json:"twitterUrl"`
		WebsiteURL        *string  `json:"websiteUrl"`
		ContactEmail      *string  `json:"contactEmail"`
		Notes             *string  `json:"notes"`
		OrderIndex        *int32   `json:"orderIndex"`
		Published         *bool    `json:"published"`
		CourseIDs         []string `json:"courseIds"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return instructors.CreateInput{}, errs.BadRequest("invalid request body")
	}
	return instructors.CreateInput{
		Slug: raw.Slug, Name: raw.Name,
		NameEn: raw.NameEn, Title: raw.Title, TitleEn: raw.TitleEn,
		Headline: raw.Headline, HeadlineEn: raw.HeadlineEn,
		Bio: raw.Bio, BioEn: raw.BioEn,
		AvatarURL: raw.AvatarURL, Company: raw.Company,
		YearsOfExperience: raw.YearsOfExperience,
		LinkedinURL:       raw.LinkedinURL, GithubURL: raw.GithubURL,
		TwitterURL: raw.TwitterURL, WebsiteURL: raw.WebsiteURL,
		ContactEmail: raw.ContactEmail, Notes: raw.Notes,
		OrderIndex: raw.OrderIndex, Published: raw.Published,
		CourseIDs: raw.CourseIDs,
	}, nil
}

// bindInstructorUpdateInput parses a partial-update body. Every field
// is a pointer so the service can distinguish "not supplied" (keep
// existing value) from "supplied as zero" (clear it).
func bindInstructorUpdateInput(c *fiber.Ctx) (instructors.UpdateInput, error) {
	var raw struct {
		Slug              *string `json:"slug"`
		Name              *string `json:"name"`
		NameEn            *string `json:"nameEn"`
		Title             *string `json:"title"`
		TitleEn           *string `json:"titleEn"`
		Headline          *string `json:"headline"`
		HeadlineEn        *string `json:"headlineEn"`
		Bio               *string `json:"bio"`
		BioEn             *string `json:"bioEn"`
		AvatarURL         *string `json:"avatarUrl"`
		Company           *string `json:"company"`
		YearsOfExperience *int32  `json:"yearsOfExperience"`
		LinkedinURL       *string `json:"linkedinUrl"`
		GithubURL         *string `json:"githubUrl"`
		TwitterURL        *string `json:"twitterUrl"`
		WebsiteURL        *string `json:"websiteUrl"`
		ContactEmail      *string `json:"contactEmail"`
		Notes             *string `json:"notes"`
		OrderIndex        *int32  `json:"orderIndex"`
		Published         *bool   `json:"published"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return instructors.UpdateInput{}, errs.BadRequest("invalid request body")
	}
	return instructors.UpdateInput{
		Slug: raw.Slug, Name: raw.Name,
		NameEn: raw.NameEn, Title: raw.Title, TitleEn: raw.TitleEn,
		Headline: raw.Headline, HeadlineEn: raw.HeadlineEn,
		Bio: raw.Bio, BioEn: raw.BioEn,
		AvatarURL: raw.AvatarURL, Company: raw.Company,
		YearsOfExperience: raw.YearsOfExperience,
		LinkedinURL:       raw.LinkedinURL, GithubURL: raw.GithubURL,
		TwitterURL: raw.TwitterURL, WebsiteURL: raw.WebsiteURL,
		ContactEmail: raw.ContactEmail, Notes: raw.Notes,
		OrderIndex: raw.OrderIndex, Published: raw.Published,
	}, nil
}

// ============ expertises (T24) ============
//
// The NestJS source uses two controllers (ExpertisesPublicController
// at /instructors/expertises and ExpertisesAdminController at
// /admin/instructors/expertises). We mirror both into this handler
// since they share the JWT verifier and underlying *sql.DB.

// publicListExpertises returns the full list (active + inactive).
//
//	GET /api/v1/instructors/expertises
func (h *InstructorsHandler) publicListExpertises(c *fiber.Ctx) error {
	rows, err := h.expertiseS.List(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"items": rows})
}

// adminListExpertises is the admin list view (same shape as public).
//
//	GET /api/v1/admin/instructors/expertises
func (h *InstructorsHandler) adminListExpertises(c *fiber.Ctx) error {
	rows, err := h.expertiseS.List(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"items": rows})
}

// adminCreateExpertise inserts a new expertise.
//
//	POST /api/v1/admin/instructors/expertises
//	body: { key, label, labelEn?, isActive?, orderIndex? }
func (h *InstructorsHandler) adminCreateExpertise(c *fiber.Ctx) error {
	var body struct {
		Key        string  `json:"key"`
		Label      string  `json:"label"`
		LabelEn    *string `json:"labelEn"`
		IsActive   *bool   `json:"isActive"`
		OrderIndex *int32  `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.expertiseS.Create(c.Context(), instructors.CreateExpertiseInput{
		Key:        body.Key,
		Label:      body.Label,
		LabelEn:    body.LabelEn,
		IsActive:   body.IsActive,
		OrderIndex: body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

// adminUpdateExpertise applies a partial update.
//
//	PATCH /api/v1/admin/instructors/expertises/:id
//	body: { key?, label?, labelEn?, isActive?, orderIndex? }
func (h *InstructorsHandler) adminUpdateExpertise(c *fiber.Ctx) error {
	var body struct {
		Key        *string `json:"key"`
		Label      *string `json:"label"`
		LabelEn    *string `json:"labelEn"`
		IsActive   *bool   `json:"isActive"`
		OrderIndex *int32  `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.expertiseS.Update(c.Context(), c.Params("id"), instructors.UpdateExpertiseInput{
		Key:        body.Key,
		Label:      body.Label,
		LabelEn:    body.LabelEn,
		IsActive:   body.IsActive,
		OrderIndex: body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.JSON(row)
}

// adminDeleteExpertise hard-deletes the row.
//
//	DELETE /api/v1/admin/instructors/expertises/:id
func (h *InstructorsHandler) adminDeleteExpertise(c *fiber.Ctx) error {
	if err := h.expertiseS.Delete(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}
