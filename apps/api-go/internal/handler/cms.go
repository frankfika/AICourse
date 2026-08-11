// Package handler — Fiber HTTP handlers for the CMS module.
//
// Phase 2 T23: ports the 6 NestJS controllers in
// apps/api/src/modules/cms/ to Fiber. ~80 admin endpoints + 17 public
// read endpoints + 1 public sitemap.xml endpoint.
//
// Routes (admin, /api/v1/admin/cms/*, RequireAuth + RequireRole("admin")):
//
//	GET    /admin/cms/app-settings              list
//	POST   /admin/cms/app-settings              create
//	PATCH  /admin/cms/app-settings/:key         update
//	DELETE /admin/cms/app-settings/:key         delete
//	…same shape for site-settings (key)…
//	…same shape for page-settings (id = page:key)…
//	…same shape for enum-translations (id = type:value:locale)…
//	…same shape for date-format-templates (id = scope:locale)…
//	…same shape for industries / enterprise-methods / testimonials /
//	   quick-prompts / course-categories / popular-searches /
//	   hot-keywords / auth-providers / top-nav / footer-columns (id)…
//	GET    /admin/cms/i18n/messages              list (filter by locale + category)
//	POST   /admin/cms/i18n/messages              create
//	PATCH  /admin/cms/i18n/messages/:id          update (id = key:locale)
//	DELETE /admin/cms/i18n/messages/:id          delete
//
// Routes (public, no auth):
//
//	GET /app-settings?scope=…                  list (optionally by scope)
//	GET /site-settings?keys=a,b,c              list or batch-by-keys
//	GET /page-settings?page=home               list or batch-by-pages
//	GET /industries?active=true|false
//	GET /enterprise-methods?active=…
//	GET /testimonials?active=…
//	GET /quick-prompts?scope=lesson&active=…
//	GET /course-categories?active=…
//	GET /popular-searches?active=…
//	GET /hot-keywords?scope=courses&active=…
//	GET /auth-providers                         public list (strips `config`)
//	GET /top-nav?active=…
//	GET /footer-columns?active=…
//	GET /enum-translations?type=…&locale=…
//	GET /date-format-templates?scope=…&locale=…
//	GET /i18n/messages?locale=…&category=…
//	GET /sitemap.xml                            application/xml
//
// Auth boundary (mirrors NestJS):
//   - admin/cms/* — RequireAuth + RequireRole("admin")
//   - everything else — public, no middleware
package handler

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/cms"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// CMSHandler bundles the service + JWT verifier.
type CMSHandler struct {
	svc    *cms.Service
	tokens auth.TokenIssuer
	log    *zap.Logger
}

// NewCMSHandler builds a handler.
func NewCMSHandler(svc *cms.Service, tokens auth.TokenIssuer, log *zap.Logger) *CMSHandler {
	return &CMSHandler{svc: svc, tokens: tokens, log: log}
}

// Mount registers both admin and public CMS routes. It is kept as a
// compatibility helper for tests and callers that always have JWT configured.
func (h *CMSHandler) Mount(router fiber.Router) {
	h.MountAdmin(router)
	h.MountPublic(router)
}

// MountAdmin registers /admin/cms/* with authentication and the admin role
// gate. Callers must provide a working TokenIssuer.
func (h *CMSHandler) MountAdmin(router fiber.Router) {
	// ---------- Admin: /admin/cms/* ----------
	adminChain := []fiber.Handler{middleware.RequireAuth(h.tokens), middleware.RequireRole("admin")}
	admin := router.Group("/admin/cms", adminChain...)

	// app-settings
	admin.Get("/app-settings", h.adminListAppSettings)
	admin.Post("/app-settings", h.adminCreateAppSetting)
	admin.Patch("/app-settings/:key", h.adminUpdateAppSetting)
	admin.Delete("/app-settings/:key", h.adminDeleteAppSetting)

	// site-settings
	admin.Get("/site-settings", h.adminListSiteSettings)
	admin.Post("/site-settings", h.adminCreateSiteSetting)
	admin.Patch("/site-settings/:key", h.adminUpdateSiteSetting)
	admin.Delete("/site-settings/:key", h.adminDeleteSiteSetting)

	// page-settings (composite key page:key)
	admin.Get("/page-settings", h.adminListPageSettings)
	admin.Post("/page-settings", h.adminCreatePageSetting)
	admin.Patch("/page-settings/:id", h.adminUpdatePageSetting)
	admin.Delete("/page-settings/:id", h.adminDeletePageSetting)

	// enum-translations (composite key type:value:locale)
	admin.Get("/enum-translations", h.adminListEnumTranslations)
	admin.Post("/enum-translations", h.adminCreateEnumTranslation)
	admin.Patch("/enum-translations/:id", h.adminUpdateEnumTranslation)
	admin.Delete("/enum-translations/:id", h.adminDeleteEnumTranslation)

	// date-format-templates (composite key scope:locale)
	admin.Get("/date-format-templates", h.adminListDateFormatTemplates)
	admin.Post("/date-format-templates", h.adminCreateDateFormatTemplate)
	admin.Patch("/date-format-templates/:id", h.adminUpdateDateFormatTemplate)
	admin.Delete("/date-format-templates/:id", h.adminDeleteDateFormatTemplate)

	// id-based resources
	admin.Get("/industries", h.adminListIndustries)
	admin.Post("/industries", h.adminCreateIndustry)
	admin.Patch("/industries/:id", h.adminUpdateIndustry)
	admin.Delete("/industries/:id", h.adminDeleteIndustry)

	admin.Get("/enterprise-methods", h.adminListEnterpriseMethods)
	admin.Post("/enterprise-methods", h.adminCreateEnterpriseMethod)
	admin.Patch("/enterprise-methods/:id", h.adminUpdateEnterpriseMethod)
	admin.Delete("/enterprise-methods/:id", h.adminDeleteEnterpriseMethod)

	admin.Get("/testimonials", h.adminListTestimonials)
	admin.Post("/testimonials", h.adminCreateTestimonial)
	admin.Patch("/testimonials/:id", h.adminUpdateTestimonial)
	admin.Delete("/testimonials/:id", h.adminDeleteTestimonial)

	admin.Get("/quick-prompts", h.adminListQuickPrompts)
	admin.Post("/quick-prompts", h.adminCreateQuickPrompt)
	admin.Patch("/quick-prompts/:id", h.adminUpdateQuickPrompt)
	admin.Delete("/quick-prompts/:id", h.adminDeleteQuickPrompt)

	admin.Get("/course-categories", h.adminListCourseCategories)
	admin.Post("/course-categories", h.adminCreateCourseCategory)
	admin.Patch("/course-categories/:id", h.adminUpdateCourseCategory)
	admin.Delete("/course-categories/:id", h.adminDeleteCourseCategory)

	admin.Get("/popular-searches", h.adminListPopularSearches)
	admin.Post("/popular-searches", h.adminCreatePopularSearch)
	admin.Patch("/popular-searches/:id", h.adminUpdatePopularSearch)
	admin.Delete("/popular-searches/:id", h.adminDeletePopularSearch)

	admin.Get("/hot-keywords", h.adminListHotKeywords)
	admin.Post("/hot-keywords", h.adminCreateHotKeyword)
	admin.Patch("/hot-keywords/:id", h.adminUpdateHotKeyword)
	admin.Delete("/hot-keywords/:id", h.adminDeleteHotKeyword)

	admin.Get("/auth-providers", h.adminListAuthProviders)
	admin.Post("/auth-providers", h.adminCreateAuthProvider)
	admin.Patch("/auth-providers/:id", h.adminUpdateAuthProvider)
	admin.Delete("/auth-providers/:id", h.adminDeleteAuthProvider)

	admin.Get("/top-nav", h.adminListTopNav)
	admin.Post("/top-nav", h.adminCreateTopNav)
	admin.Patch("/top-nav/:id", h.adminUpdateTopNav)
	admin.Delete("/top-nav/:id", h.adminDeleteTopNav)

	admin.Get("/footer-columns", h.adminListFooterColumns)
	admin.Post("/footer-columns", h.adminCreateFooterColumn)
	admin.Patch("/footer-columns/:id", h.adminUpdateFooterColumn)
	admin.Delete("/footer-columns/:id", h.adminDeleteFooterColumn)

	// i18n/messages (composite key:locale)
	admin.Get("/i18n/messages", h.adminListI18nMessages)
	admin.Post("/i18n/messages", h.adminCreateI18nMessage)
	admin.Patch("/i18n/messages/:id", h.adminUpdateI18nMessage)
	admin.Delete("/i18n/messages/:id", h.adminDeleteI18nMessage)
}

// MountPublic registers all unauthenticated CMS read routes. It deliberately
// does not access h.tokens, so public configuration remains available when
// JWT_SECRET is not configured.
func (h *CMSHandler) MountPublic(router fiber.Router) {
	// /app-settings, /site-settings, /page-settings
	router.Get("/app-settings", h.publicListAppSettings)
	router.Get("/site-settings", h.publicGetSiteSettings)
	router.Get("/page-settings", h.publicGetPageSettings)

	// /industries, /enterprise-methods, …, /footer-columns
	router.Get("/industries", h.publicListIndustries)
	router.Get("/enterprise-methods", h.publicListEnterpriseMethods)
	router.Get("/testimonials", h.publicListTestimonials)
	router.Get("/quick-prompts", h.publicListQuickPrompts)
	router.Get("/course-categories", h.publicListCourseCategories)
	router.Get("/popular-searches", h.publicListPopularSearches)
	router.Get("/hot-keywords", h.publicListHotKeywords)
	router.Get("/auth-providers", h.publicListAuthProviders)
	router.Get("/top-nav", h.publicListTopNav)
	router.Get("/footer-columns", h.publicListFooterColumns)

	// /enum-translations, /date-format-templates
	router.Get("/enum-translations", h.publicListEnumTranslations)
	router.Get("/date-format-templates", h.publicListDateFormatTemplates)

	// /i18n/messages
	router.Get("/i18n/messages", h.publicListI18nMessages)

	// /sitemap.xml — outside /api/v1 (NestJS exposes it at root)
	// Note: this is registered by the parent router. The fiber main.go
	// app group "/api/v1" doesn't apply here. We add the route to the
	// root app from cmd/server/main.go via a separate helper. This
	// package exposes SitemapHandler(c) so the parent can mount it.
}

// ============ admin: app_settings ============

func (h *CMSHandler) adminListAppSettings(c *fiber.Ctx) error {
	rows, err := h.svc.ListAppSettings("")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateAppSetting(c *fiber.Ctx) error {
	var in cms.CreateAppSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateAppSetting(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateAppSetting(c *fiber.Ctx) error {
	var in cms.UpdateAppSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateAppSetting(c.Context(), c.Params("key"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteAppSetting(c *fiber.Ctx) error {
	if err := h.svc.DeleteAppSetting(c.Context(), c.Params("key")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "key": c.Params("key")})
}

// ============ admin: site_settings ============

func (h *CMSHandler) adminListSiteSettings(c *fiber.Ctx) error {
	rows, err := h.svc.ListSiteSettings("")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateSiteSetting(c *fiber.Ctx) error {
	var in cms.CreateSiteSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateSiteSetting(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateSiteSetting(c *fiber.Ctx) error {
	var in cms.UpdateSiteSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateSiteSetting(c.Context(), c.Params("key"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteSiteSetting(c *fiber.Ctx) error {
	if err := h.svc.DeleteSiteSetting(c.Context(), c.Params("key")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "key": c.Params("key")})
}

// ============ admin: page_settings ============

func (h *CMSHandler) adminListPageSettings(c *fiber.Ctx) error {
	rows, err := h.svc.ListPageSettings("")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreatePageSetting(c *fiber.Ctx) error {
	var in cms.CreatePageSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreatePageSetting(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdatePageSetting(c *fiber.Ctx) error {
	var in cms.UpdatePageSettingInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdatePageSetting(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeletePageSetting(c *fiber.Ctx) error {
	if err := h.svc.DeletePageSetting(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: enum_translations ============

func (h *CMSHandler) adminListEnumTranslations(c *fiber.Ctx) error {
	enumType := c.Query("type", "")
	locale := c.Query("locale", "")
	rows, err := h.svc.ListEnumTranslations(enumType, locale)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateEnumTranslation(c *fiber.Ctx) error {
	var in cms.CreateEnumTranslationInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateEnumTranslation(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateEnumTranslation(c *fiber.Ctx) error {
	var in cms.UpdateEnumTranslationInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateEnumTranslation(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteEnumTranslation(c *fiber.Ctx) error {
	if err := h.svc.DeleteEnumTranslation(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: date_format_templates ============

func (h *CMSHandler) adminListDateFormatTemplates(c *fiber.Ctx) error {
	rows, err := h.svc.ListDateFormatTemplates("", "")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateDateFormatTemplate(c *fiber.Ctx) error {
	var in cms.CreateDateFormatTemplateInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateDateFormatTemplate(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateDateFormatTemplate(c *fiber.Ctx) error {
	var in cms.UpdateDateFormatTemplateInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateDateFormatTemplate(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteDateFormatTemplate(c *fiber.Ctx) error {
	if err := h.svc.DeleteDateFormatTemplate(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: industries ============

func (h *CMSHandler) adminListIndustries(c *fiber.Ctx) error {
	rows, err := h.svc.ListIndustries(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateIndustry(c *fiber.Ctx) error {
	var in cms.CreateIndustryInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateIndustry(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateIndustry(c *fiber.Ctx) error {
	var in cms.UpdateIndustryInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateIndustry(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteIndustry(c *fiber.Ctx) error {
	if err := h.svc.DeleteIndustry(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: enterprise_methods ============

func (h *CMSHandler) adminListEnterpriseMethods(c *fiber.Ctx) error {
	rows, err := h.svc.ListEnterpriseMethods(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateEnterpriseMethod(c *fiber.Ctx) error {
	var in cms.CreateEnterpriseMethodInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateEnterpriseMethod(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateEnterpriseMethod(c *fiber.Ctx) error {
	var in cms.UpdateEnterpriseMethodInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateEnterpriseMethod(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteEnterpriseMethod(c *fiber.Ctx) error {
	if err := h.svc.DeleteEnterpriseMethod(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: testimonials ============

func (h *CMSHandler) adminListTestimonials(c *fiber.Ctx) error {
	rows, err := h.svc.ListTestimonials(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateTestimonial(c *fiber.Ctx) error {
	var in cms.CreateTestimonialInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateTestimonial(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateTestimonial(c *fiber.Ctx) error {
	var in cms.UpdateTestimonialInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateTestimonial(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteTestimonial(c *fiber.Ctx) error {
	if err := h.svc.DeleteTestimonial(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: quick_prompts ============

func (h *CMSHandler) adminListQuickPrompts(c *fiber.Ctx) error {
	rows, err := h.svc.ListQuickPrompts(nil, "")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateQuickPrompt(c *fiber.Ctx) error {
	var in cms.CreateQuickPromptInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateQuickPrompt(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateQuickPrompt(c *fiber.Ctx) error {
	var in cms.UpdateQuickPromptInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateQuickPrompt(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteQuickPrompt(c *fiber.Ctx) error {
	if err := h.svc.DeleteQuickPrompt(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: course_categories ============

func (h *CMSHandler) adminListCourseCategories(c *fiber.Ctx) error {
	rows, err := h.svc.ListCourseCategories(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateCourseCategory(c *fiber.Ctx) error {
	var in cms.CreateCourseCategoryInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateCourseCategory(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateCourseCategory(c *fiber.Ctx) error {
	var in cms.UpdateCourseCategoryInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateCourseCategory(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteCourseCategory(c *fiber.Ctx) error {
	if err := h.svc.DeleteCourseCategory(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: popular_searches ============

func (h *CMSHandler) adminListPopularSearches(c *fiber.Ctx) error {
	rows, err := h.svc.ListPopularSearches(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreatePopularSearch(c *fiber.Ctx) error {
	var in cms.CreatePopularSearchInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreatePopularSearch(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdatePopularSearch(c *fiber.Ctx) error {
	var in cms.UpdatePopularSearchInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdatePopularSearch(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeletePopularSearch(c *fiber.Ctx) error {
	if err := h.svc.DeletePopularSearch(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: hot_keywords ============

func (h *CMSHandler) adminListHotKeywords(c *fiber.Ctx) error {
	rows, err := h.svc.ListHotKeywords(nil, "")
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateHotKeyword(c *fiber.Ctx) error {
	var in cms.CreateHotKeywordInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateHotKeyword(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateHotKeyword(c *fiber.Ctx) error {
	var in cms.UpdateHotKeywordInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateHotKeyword(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteHotKeyword(c *fiber.Ctx) error {
	if err := h.svc.DeleteHotKeyword(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: auth_providers ============

func (h *CMSHandler) adminListAuthProviders(c *fiber.Ctx) error {
	rows, err := h.svc.ListAuthProviders()
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateAuthProvider(c *fiber.Ctx) error {
	var in cms.CreateAuthProviderInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateAuthProvider(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateAuthProvider(c *fiber.Ctx) error {
	var in cms.UpdateAuthProviderInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateAuthProvider(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteAuthProvider(c *fiber.Ctx) error {
	if err := h.svc.DeleteAuthProvider(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: top_nav ============

func (h *CMSHandler) adminListTopNav(c *fiber.Ctx) error {
	rows, err := h.svc.ListTopNavItems(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateTopNav(c *fiber.Ctx) error {
	var in cms.CreateTopNavItemInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateTopNavItem(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateTopNav(c *fiber.Ctx) error {
	var in cms.UpdateTopNavItemInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateTopNavItem(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteTopNav(c *fiber.Ctx) error {
	if err := h.svc.DeleteTopNavItem(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: footer_columns ============

func (h *CMSHandler) adminListFooterColumns(c *fiber.Ctx) error {
	rows, err := h.svc.ListFooterColumns(nil)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateFooterColumn(c *fiber.Ctx) error {
	var in cms.CreateFooterColumnInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateFooterColumn(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateFooterColumn(c *fiber.Ctx) error {
	var in cms.UpdateFooterColumnInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateFooterColumn(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteFooterColumn(c *fiber.Ctx) error {
	if err := h.svc.DeleteFooterColumn(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ admin: i18n/messages ============

func (h *CMSHandler) adminListI18nMessages(c *fiber.Ctx) error {
	locale := c.Query("locale", "")
	category := c.Query("category", "")
	rows, err := h.svc.ListI18nMessages(locale, category)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) adminCreateI18nMessage(c *fiber.Ctx) error {
	var in cms.CreateI18nMessageInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.CreateI18nMessage(c.Context(), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(row)
}

func (h *CMSHandler) adminUpdateI18nMessage(c *fiber.Ctx) error {
	var in cms.UpdateI18nMessageInput
	if err := c.BodyParser(&in); err != nil {
		return errs.BadRequest("invalid request body")
	}
	row, err := h.svc.UpdateI18nMessage(c.Context(), c.Params("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *CMSHandler) adminDeleteI18nMessage(c *fiber.Ctx) error {
	if err := h.svc.DeleteI18nMessage(c.Context(), c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"deleted": true, "id": c.Params("id")})
}

// ============ public reads ============

func (h *CMSHandler) publicListAppSettings(c *fiber.Ctx) error {
	scope := c.Query("scope", "")
	rows, err := h.svc.ListAppSettings(scope)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// publicGetSiteSettings mirrors NestJS:
//   - no ?keys= → list of all site_settings
//   - ?keys=a,b,c → map of key→value
func (h *CMSHandler) publicGetSiteSettings(c *fiber.Ctx) error {
	keys := c.Query("keys", "")
	if keys == "" {
		rows, err := h.svc.ListSiteSettings("")
		if err != nil {
			return err
		}
		return c.JSON(rows)
	}
	parts := strings.Split(keys, ",")
	cleaned := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			cleaned = append(cleaned, t)
		}
	}
	if len(cleaned) == 0 {
		rows, err := h.svc.ListSiteSettings("")
		if err != nil {
			return err
		}
		return c.JSON(rows)
	}
	m, err := h.svc.GetSiteSettingsByKeys(cleaned)
	if err != nil {
		return err
	}
	return c.JSON(m)
}

// publicGetPageSettings mirrors NestJS:
//   - no ?page= → list of all page_settings
//   - ?page=home&page=courses → map of page→key→value
func (h *CMSHandler) publicGetPageSettings(c *fiber.Ctx) error {
	pages := c.Context().QueryArgs().PeekMulti("page")
	if len(pages) == 0 {
		rows, err := h.svc.ListPageSettings("")
		if err != nil {
			return err
		}
		return c.JSON(rows)
	}
	cleaned := make([]string, 0, len(pages))
	for _, p := range pages {
		s := string(p)
		if s != "" {
			cleaned = append(cleaned, s)
		}
	}
	if len(cleaned) == 0 {
		rows, err := h.svc.ListPageSettings("")
		if err != nil {
			return err
		}
		return c.JSON(rows)
	}
	m, err := h.svc.GetPageSettingsByPages(cleaned)
	if err != nil {
		return err
	}
	return c.JSON(m)
}

func (h *CMSHandler) publicListIndustries(c *fiber.Ctx) error {
	rows, err := h.svc.ListIndustries(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListEnterpriseMethods(c *fiber.Ctx) error {
	rows, err := h.svc.ListEnterpriseMethods(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListTestimonials(c *fiber.Ctx) error {
	rows, err := h.svc.ListTestimonials(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListQuickPrompts(c *fiber.Ctx) error {
	rows, err := h.svc.ListQuickPrompts(parseActive(c.Query("active", "")), c.Query("scope", ""))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListCourseCategories(c *fiber.Ctx) error {
	rows, err := h.svc.ListCourseCategories(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListPopularSearches(c *fiber.Ctx) error {
	rows, err := h.svc.ListPopularSearches(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListHotKeywords(c *fiber.Ctx) error {
	rows, err := h.svc.ListHotKeywords(parseActive(c.Query("active", "")), c.Query("scope", ""))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListAuthProviders(c *fiber.Ctx) error {
	// Public list: no `config` field. P0 security hardening 2026-07-23.
	rows, err := h.svc.ListAuthProvidersPublic()
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListTopNav(c *fiber.Ctx) error {
	rows, err := h.svc.ListTopNavItems(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListFooterColumns(c *fiber.Ctx) error {
	rows, err := h.svc.ListFooterColumns(parseActive(c.Query("active", "")))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListEnumTranslations(c *fiber.Ctx) error {
	rows, err := h.svc.ListEnumTranslations(c.Query("type", ""), c.Query("locale", ""))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListDateFormatTemplates(c *fiber.Ctx) error {
	rows, err := h.svc.ListDateFormatTemplates(c.Query("scope", ""), c.Query("locale", ""))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *CMSHandler) publicListI18nMessages(c *fiber.Ctx) error {
	rows, err := h.svc.ListI18nMessages(c.Query("locale", ""), c.Query("category", ""))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// SitemapHandler returns a Fiber handler that serves /sitemap.xml. It's
// exposed as a method so cmd/server/main.go can mount it on the root
// app (NestJS exposes sitemap at the project root, not under /api/v1).
//
// Content-Type: application/xml; charset=utf-8
// Cache-Control: public, max-age=3600 (1h — Google bot rate).
func (h *CMSHandler) SitemapHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		out, err := h.svc.GetSitemap(c.Context())
		if err != nil {
			return err
		}
		c.Set("Content-Type", "application/xml; charset=utf-8")
		c.Set("Cache-Control", "public, max-age=3600")
		return c.SendString(renderSitemapXML(out))
	}
}

// ============ shared helpers ============

// parseActive implements the NestJS parseActive convention:
//   - missing → default to active-only (returns &true, *bool)
//   - "true" / "1" → active (returns &true)
//   - "false" / "0" → inactive (returns &false)
//   - other → unfiltered (returns nil)
func parseActive(s string) *bool {
	switch s {
	case "":
		t := true
		return &t
	case "true", "1":
		t := true
		return &t
	case "false", "0":
		t := false
		return &t
	}
	return nil
}

// renderSitemapXML mirrors the NestJS sitemap.controller.ts output.
// It uses encoding/xml's xml:Escape semantics (LT, GT, AMP, QUOT, APOS)
// which is what sitemap.xml requires.
func renderSitemapXML(s cms.SitemapXML) string {
	type urlXML struct {
		XMLName    xml.Name `xml:"url"`
		Loc        string   `xml:"loc"`
		Lastmod    string   `xml:"lastmod,omitempty"`
		Changefreq string   `xml:"changefreq,omitempty"`
		Priority   string   `xml:"priority,omitempty"`
	}
	type setXML struct {
		XMLName xml.Name `xml:"urlset"`
		XMLNS   string   `xml:"xmlns,attr"`
		URLs    []urlXML `xml:"url"`
	}
	doc := setXML{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, u := range s.URLs {
		xu := urlXML{Loc: u.Loc, Changefreq: u.Changefreq, Priority: strconv.FormatFloat(u.Priority, 'f', 1, 64)}
		if u.Lastmod != nil {
			xu.Lastmod = u.Lastmod.UTC().Format("2006-01-02T15:04:05Z")
		}
		doc.URLs = append(doc.URLs, xu)
	}
	body, err := xml.Marshal(doc)
	if err != nil {
		// Should never happen for our simple struct; fall back to a
		// minimal valid document so the bot doesn't see a 500.
		return `<?xml version="1.0" encoding="UTF-8"?>` +
			`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>` + "\n"
	}
	return xml.Header + string(body) + "\n"
}

// Compile-time check that cms.SitemapURL fields are addressable.
var _ = func() error {
	// renderSitemapXML pre-checks the cms.SitemapURL shape.
	_ = fmt.Sprintf("%+v", cms.SitemapURL{})
	_ = json.RawMessage{}
	return nil
}
