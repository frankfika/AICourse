// Package cms — CMS (content management) module.
//
// Phase 2 T23: ports the 6 NestJS controllers in
// apps/api/src/modules/cms/ — cms-admin, cms-config, cms-content,
// cms-enum, cms-i18n, and sitemap — totalling ~80 admin endpoints +
// 17 public read endpoints across 16 resource tables.
//
// Layout:
//   - one Repo wrapping *db.Queries
//   - one Service per major NestJS service (config / content / enum /
//     i18n / sitemap). We keep them inside this single package file
//     to mirror the site.go pattern (one file per package).
//   - 16 resource sub-services collapsed into a small set of generic
//     CRUD helpers because the bodies are 95% identical (NestJS uses
//     16 near-identical Prisma wrappers in cms-config / cms-content).
//
// Auth boundary (mirrors NestJS):
//   - admin/cms/* — RequireAuth + RequireRole("admin")
//   - /app-settings, /site-settings, /page-settings,
//     /industries, /enterprise-methods, /testimonials, /quick-prompts,
//     /course-categories, /popular-searches, /hot-keywords,
//     /auth-providers, /top-nav, /footer-columns, /enum-translations,
//     /date-format-templates, /i18n/messages — public, no auth
//   - /sitemap.xml — public, returns application/xml
//
// Conventions follow the T20 (instructors) + T22 (urlimport) modules:
//   - DTOs use *string / *int32 for nullable
//   - DTO JSON keys are camelCase to match the NestJS Prisma contract
//   - composite-PK resources (enum_translations, date_format_templates,
//     page_settings, i18n_messages) use "triple:colon" path IDs
//   - "list auth-providers public" intentionally strips `config` to
//     avoid leaking OAuth client_secret (P0 security hardening 2026-07-23)
package cms

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// =============================================================
// Repo + Service scaffolding
// =============================================================

// Repo wraps the sqlc-generated *db.Queries for the 16 CMS tables.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo builds a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Service is the CMS business logic. It holds a *Repo + logger.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// =============================================================
// Composite-PK helpers (3 resources)
// =============================================================
//
// enum_translations uses (enumType, enumValue, locale) — path id is
//   "<enumType>:<enumValue>:<locale>"
// date_format_templates uses (scope, locale) — path id is "<scope>:<locale>"
// i18n_messages uses (key, locale) — path id is "<key>:<locale>"
// page_settings uses (page, key) — path id is "<page>:<key>"

// splitCompositeID splits a "a:b[:c]" path id. Returns 2 or 3 components.
// The trailing component may not be empty (NestJS throws BadRequest).
func splitCompositeID(id string, want int) ([]string, error) {
	parts := strings.SplitN(id, ":", want)
	if len(parts) != want {
		return nil, errs.BadRequest(fmt.Sprintf("id must be %d colon-separated parts, got %q", want, id))
	}
	for _, p := range parts {
		if p == "" {
			return nil, errs.BadRequest("id contains empty component")
		}
	}
	return parts, nil
}

// =============================================================
// Generic CRUD helpers for the 12 "id" resources
// =============================================================
//
// The 12 "content" resources (industries, enterprise_methods,
// testimonials, quick_prompts, course_categories, popular_searches,
// hot_keywords, auth_providers, top_nav_items, footer_columns) all
// follow the same shape:
//
//   - list: optional isActive filter, order by order_index ASC
//   - get: by id
//   - create: id (cuid) + payload + created_at
//   - update: full update by id (NestJS sends complete payload)
//   - delete: hard delete by id
//
// We can't use sqlc queries with the same name across tables, so we
// inline the SQL in a small set of helpers that take the table name.
// This keeps the package file compact (one file, ~1400 LOC) without
// sacrificing the 1:1 port guarantee.

// idResource describes one of the 12 String-PK CMS resources.
type idResource struct {
	table           string // SQL table name
	hasCreatedAt    bool   // whether the table has a created_at column
	defaultIcon     string // authProviders icon default ('KeyRound')
	defaultIsActive bool   // default for create
	defaultOrderIdx int32  // default for create
	hasClickCount   bool   // popular_searches
	hasMethodology  bool   // industries
	hasBullets      bool   // industries + enterprise_methods (different field name in industry)
	hasKeyField     bool   // industries / course_categories
	hasLabelField   bool   // many
	hasTitleField   bool   // testimonials + top_nav_items + footer_columns
	hasQuoteField   bool   // testimonials
	hasDescField    bool   // industries / enterprise_methods
	hasNumField     bool   // enterprise_methods
	hasPathField    bool   // top_nav_items
	hasLinksField   bool   // footer_columns
	hasPromptField  bool   // quick_prompts (prompt_text)
	hasScopeField   bool   // quick_prompts / hot_keywords
	hasKeywordField bool   // popular_searches / hot_keywords
	hasNameField    bool   // testimonials / quick_prompts
	hasAvatarField  bool   // testimonials
	hasConfigField  bool   // auth_providers
	hasIconField    bool   // many
}

// allIDResources is the source of truth for the 12 id-based tables.
func allIDResources() map[string]idResource {
	return map[string]idResource{
		"industries":         {table: "industries", hasCreatedAt: true, defaultIsActive: true, hasKeyField: true, hasLabelField: true, hasDescField: true, hasMethodology: true, hasIconField: true},
		"enterprise_methods": {table: "enterprise_methods", defaultIsActive: true, hasNumField: true, hasTitleField: true, hasDescField: true, hasBullets: true},
		"testimonials":       {table: "testimonials", defaultIsActive: true, hasNameField: true, hasTitleField: true, hasQuoteField: true, hasAvatarField: true},
		"quick_prompts":      {table: "quick_prompts", defaultIsActive: true, hasIconField: true, hasLabelField: true, hasPromptField: true, hasScopeField: true, defaultIcon: "💡"},
		"course_categories":  {table: "course_categories", defaultIsActive: true, hasKeyField: true, hasLabelField: true},
		"popular_searches":   {table: "popular_searches", defaultIsActive: true, hasKeywordField: true, hasClickCount: true},
		"hot_keywords":       {table: "hot_keywords", defaultIsActive: true, hasKeywordField: true, hasScopeField: true},
		"auth_providers":     {table: "auth_providers", defaultIsActive: false, hasLabelField: true, hasIconField: true, hasConfigField: true, defaultIcon: "KeyRound"},
		"top_nav_items":      {table: "top_nav_items", defaultIsActive: true, hasLabelField: true, hasPathField: true, hasIconField: true},
		"footer_columns":     {table: "footer_columns", defaultIsActive: true, hasTitleField: true, hasLinksField: true},
	}
}

// =============================================================
// Public DTOs (returned to clients — camelCase JSON keys)
// =============================================================

// AppSettingView is the public shape of one app_settings row.
type AppSettingView struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"valueJson"`
	Scope       string          `json:"scope"`
	Description *string         `json:"description"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// SiteSettingView mirrors the public SiteSetting shape. Value is the raw
// JSON so the frontend can decode it without a server roundtrip.
type SiteSettingView struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Scope       string          `json:"scope"`
	Description *string         `json:"description"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// PageSettingView is the public shape of one page_settings row.
type PageSettingView struct {
	Page        string          `json:"page"`
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Description *string         `json:"description"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// EnumTranslationView is the public shape of an enum_translations row.
type EnumTranslationView struct {
	EnumType   string  `json:"enumType"`
	EnumValue  string  `json:"enumValue"`
	Locale     string  `json:"locale"`
	Label      string  `json:"label"`
	ColorClass *string `json:"colorClass"`
	Icon       *string `json:"icon"`
	SortOrder  int32   `json:"sortOrder"`
}

// DateFormatTemplateView is the public shape of a date_format_templates row.
type DateFormatTemplateView struct {
	Scope    string `json:"scope"`
	Locale   string `json:"locale"`
	Template string `json:"template"`
}

// IndustryView is the public shape of an industries row.
type IndustryView struct {
	ID          string          `json:"id"`
	Key         string          `json:"key"`
	Label       string          `json:"label"`
	Description *string         `json:"description"`
	Icon        *string         `json:"icon"`
	Methodology json.RawMessage `json:"methodology"`
	IsActive    bool            `json:"isActive"`
	OrderIndex  int32           `json:"orderIndex"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// EnterpriseMethodView is the public shape of an enterprise_methods row.
type EnterpriseMethodView struct {
	ID         string          `json:"id"`
	Num        string          `json:"num"`
	Title      string          `json:"title"`
	Desc       string          `json:"desc"`
	Bullets    json.RawMessage `json:"bullets"`
	IsActive   bool            `json:"isActive"`
	OrderIndex int32           `json:"orderIndex"`
}

// TestimonialView is the public shape of a testimonials row.
type TestimonialView struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Title      string  `json:"title"`
	Quote      string  `json:"quote"`
	Avatar     *string `json:"avatar"`
	IsActive   bool    `json:"isActive"`
	OrderIndex int32   `json:"orderIndex"`
}

// QuickPromptView is the public shape of a quick_prompts row.
type QuickPromptView struct {
	ID         string `json:"id"`
	Emoji      string `json:"emoji"`
	Label      string `json:"label"`
	PromptText string `json:"promptText"`
	Scope      string `json:"scope"`
	IsActive   bool   `json:"isActive"`
	OrderIndex int32  `json:"orderIndex"`
}

// CourseCategoryView is the public shape of a course_categories row.
type CourseCategoryView struct {
	ID         string `json:"id"`
	Key        string `json:"key"`
	Label      string `json:"label"`
	IsActive   bool   `json:"isActive"`
	OrderIndex int32  `json:"orderIndex"`
}

// PopularSearchView is the public shape of a popular_searches row.
type PopularSearchView struct {
	ID         string `json:"id"`
	Keyword    string `json:"keyword"`
	ClickCount int32  `json:"clickCount"`
	IsActive   bool   `json:"isActive"`
	OrderIndex int32  `json:"orderIndex"`
}

// HotKeywordView is the public shape of a hot_keywords row.
type HotKeywordView struct {
	ID         string `json:"id"`
	Keyword    string `json:"keyword"`
	Scope      string `json:"scope"`
	IsActive   bool   `json:"isActive"`
	OrderIndex int32  `json:"orderIndex"`
}

// AuthProviderView is the full admin shape (includes `config`).
type AuthProviderView struct {
	ID         string          `json:"id"`
	Label      string          `json:"label"`
	Icon       string          `json:"icon"`
	IsActive   bool            `json:"isActive"`
	OrderIndex int32           `json:"orderIndex"`
	Config     json.RawMessage `json:"config"`
}

// AuthProviderPublicView is the public shape — `config` is omitted.
type AuthProviderPublicView struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Icon       string `json:"icon"`
	IsActive   bool   `json:"isActive"`
	OrderIndex int32  `json:"orderIndex"`
}

// TopNavItemView is the public shape of a top_nav_items row.
type TopNavItemView struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Path       string  `json:"path"`
	Icon       *string `json:"icon"`
	IsActive   bool    `json:"isActive"`
	OrderIndex int32   `json:"orderIndex"`
}

// FooterColumnView is the public shape of a footer_columns row.
type FooterColumnView struct {
	ID         string          `json:"id"`
	Title      string          `json:"title"`
	Links      json.RawMessage `json:"links"`
	IsActive   bool            `json:"isActive"`
	OrderIndex int32           `json:"orderIndex"`
}

// I18nMessageView is the public shape of an i18n_messages row.
type I18nMessageView struct {
	Key      string `json:"key"`
	Locale   string `json:"locale"`
	Value    string `json:"value"`
	Category string `json:"category"`
}

// =============================================================
// Input DTOs (used by the handler for create/update bodies)
// =============================================================
//
// These are API-shaped (camelCase JSON keys) so the handler binds
// directly into them. Nullable fields are *string / *int32 / *bool
// so the service can distinguish "not supplied" from "zero value".

// CreateAppSettingInput is the admin create payload.
type CreateAppSettingInput struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"valueJson"`
	Scope       *string         `json:"scope,omitempty"`
	Description *string         `json:"description,omitempty"`
}

// UpdateAppSettingInput is the admin update payload.
type UpdateAppSettingInput struct {
	Value       *json.RawMessage `json:"valueJson,omitempty"`
	Scope       *string          `json:"scope,omitempty"`
	Description *string          `json:"description,omitempty"`
}

// CreateSiteSettingInput is the admin create payload.
type CreateSiteSettingInput struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"valueJson"`
	Scope       *string         `json:"scope,omitempty"`
	Description *string         `json:"description,omitempty"`
}

// UpdateSiteSettingInput is the admin update payload.
type UpdateSiteSettingInput struct {
	Value       *json.RawMessage `json:"valueJson,omitempty"`
	Scope       *string          `json:"scope,omitempty"`
	Description *string          `json:"description,omitempty"`
}

// CreatePageSettingInput is the admin create payload.
type CreatePageSettingInput struct {
	Page        string          `json:"page"`
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"valueJson"`
	Description *string         `json:"description,omitempty"`
}

// UpdatePageSettingInput is the admin update payload.
type UpdatePageSettingInput struct {
	Value       *json.RawMessage `json:"valueJson,omitempty"`
	Description *string          `json:"description,omitempty"`
}

// CreateEnumTranslationInput is the admin create payload.
type CreateEnumTranslationInput struct {
	EnumType   string  `json:"enumType"`
	EnumValue  string  `json:"enumValue"`
	Locale     string  `json:"locale"`
	Label      string  `json:"label"`
	ColorClass *string `json:"colorClass,omitempty"`
	Icon       *string `json:"icon,omitempty"`
	SortOrder  *int32  `json:"sortOrder,omitempty"`
}

// UpdateEnumTranslationInput is the admin update payload.
type UpdateEnumTranslationInput struct {
	Label      *string `json:"label,omitempty"`
	ColorClass *string `json:"colorClass,omitempty"`
	Icon       *string `json:"icon,omitempty"`
	SortOrder  *int32  `json:"sortOrder,omitempty"`
}

// CreateDateFormatTemplateInput is the admin create payload.
type CreateDateFormatTemplateInput struct {
	Scope    string `json:"scope"`
	Locale   string `json:"locale"`
	Template string `json:"template"`
}

// UpdateDateFormatTemplateInput is the admin update payload.
type UpdateDateFormatTemplateInput struct {
	Template string `json:"template"`
}

// CreateIndustryInput is the admin create payload.
type CreateIndustryInput struct {
	Key         string          `json:"key"`
	Label       string          `json:"label"`
	Description *string         `json:"description,omitempty"`
	Icon        *string         `json:"icon,omitempty"`
	Methodology json.RawMessage `json:"methodology,omitempty"`
	IsActive    *bool           `json:"isActive,omitempty"`
	OrderIndex  *int32          `json:"orderIndex,omitempty"`
}

// UpdateIndustryInput is the admin update payload.
type UpdateIndustryInput struct {
	Key         *string          `json:"key,omitempty"`
	Label       *string          `json:"label,omitempty"`
	Description *string          `json:"description,omitempty"`
	Icon        *string          `json:"icon,omitempty"`
	Methodology *json.RawMessage `json:"methodology,omitempty"`
	IsActive    *bool            `json:"isActive,omitempty"`
	OrderIndex  *int32           `json:"orderIndex,omitempty"`
}

// CreateEnterpriseMethodInput is the admin create payload.
type CreateEnterpriseMethodInput struct {
	Num        string          `json:"num"`
	Title      string          `json:"title"`
	Desc       *string         `json:"desc,omitempty"`
	Bullets    json.RawMessage `json:"bullets"`
	IsActive   *bool           `json:"isActive,omitempty"`
	OrderIndex *int32          `json:"orderIndex,omitempty"`
}

// UpdateEnterpriseMethodInput is the admin update payload.
type UpdateEnterpriseMethodInput struct {
	Num        *string          `json:"num,omitempty"`
	Title      *string          `json:"title,omitempty"`
	Desc       *string          `json:"desc,omitempty"`
	Bullets    *json.RawMessage `json:"bullets,omitempty"`
	IsActive   *bool            `json:"isActive,omitempty"`
	OrderIndex *int32           `json:"orderIndex,omitempty"`
}

// CreateTestimonialInput is the admin create payload.
type CreateTestimonialInput struct {
	Name       string  `json:"name"`
	Title      *string `json:"title,omitempty"`
	Quote      string  `json:"quote"`
	Avatar     *string `json:"avatar,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// UpdateTestimonialInput is the admin update payload.
type UpdateTestimonialInput struct {
	Name       *string `json:"name,omitempty"`
	Title      *string `json:"title,omitempty"`
	Quote      *string `json:"quote,omitempty"`
	Avatar     *string `json:"avatar,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreateQuickPromptInput is the admin create payload.
type CreateQuickPromptInput struct {
	Emoji      *string `json:"emoji,omitempty"`
	Label      string  `json:"label"`
	PromptText string  `json:"promptText"`
	Scope      *string `json:"scope,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// UpdateQuickPromptInput is the admin update payload.
type UpdateQuickPromptInput struct {
	Emoji      *string `json:"emoji,omitempty"`
	Label      *string `json:"label,omitempty"`
	PromptText *string `json:"promptText,omitempty"`
	Scope      *string `json:"scope,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreateCourseCategoryInput is the admin create payload.
type CreateCourseCategoryInput struct {
	Key        string `json:"key"`
	Label      string `json:"label"`
	IsActive   *bool  `json:"isActive,omitempty"`
	OrderIndex *int32 `json:"orderIndex,omitempty"`
}

// UpdateCourseCategoryInput is the admin update payload.
type UpdateCourseCategoryInput struct {
	Key        *string `json:"key,omitempty"`
	Label      *string `json:"label,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreatePopularSearchInput is the admin create payload.
type CreatePopularSearchInput struct {
	Keyword    string `json:"keyword"`
	IsActive   *bool  `json:"isActive,omitempty"`
	OrderIndex *int32 `json:"orderIndex,omitempty"`
}

// UpdatePopularSearchInput is the admin update payload.
type UpdatePopularSearchInput struct {
	Keyword    *string `json:"keyword,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreateHotKeywordInput is the admin create payload.
type CreateHotKeywordInput struct {
	Keyword    string  `json:"keyword"`
	Scope      *string `json:"scope,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// UpdateHotKeywordInput is the admin update payload.
type UpdateHotKeywordInput struct {
	Keyword    *string `json:"keyword,omitempty"`
	Scope      *string `json:"scope,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreateAuthProviderInput is the admin create payload.
type CreateAuthProviderInput struct {
	ID         string          `json:"id"`
	Label      string          `json:"label"`
	Icon       *string         `json:"icon,omitempty"`
	Config     json.RawMessage `json:"config"`
	IsActive   *bool           `json:"isActive,omitempty"`
	OrderIndex *int32          `json:"orderIndex,omitempty"`
}

// UpdateAuthProviderInput is the admin update payload.
type UpdateAuthProviderInput struct {
	Label      *string          `json:"label,omitempty"`
	Icon       *string          `json:"icon,omitempty"`
	Config     *json.RawMessage `json:"config,omitempty"`
	IsActive   *bool            `json:"isActive,omitempty"`
	OrderIndex *int32           `json:"orderIndex,omitempty"`
}

// CreateTopNavItemInput is the admin create payload.
type CreateTopNavItemInput struct {
	Label      string  `json:"label"`
	Path       string  `json:"path"`
	Icon       *string `json:"icon,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// UpdateTopNavItemInput is the admin update payload.
type UpdateTopNavItemInput struct {
	Label      *string `json:"label,omitempty"`
	Path       *string `json:"path,omitempty"`
	Icon       *string `json:"icon,omitempty"`
	IsActive   *bool   `json:"isActive,omitempty"`
	OrderIndex *int32  `json:"orderIndex,omitempty"`
}

// CreateFooterColumnInput is the admin create payload.
type CreateFooterColumnInput struct {
	Title      string          `json:"title"`
	Links      json.RawMessage `json:"links"`
	IsActive   *bool           `json:"isActive,omitempty"`
	OrderIndex *int32          `json:"orderIndex,omitempty"`
}

// UpdateFooterColumnInput is the admin update payload.
type UpdateFooterColumnInput struct {
	Title      *string          `json:"title,omitempty"`
	Links      *json.RawMessage `json:"links,omitempty"`
	IsActive   *bool            `json:"isActive,omitempty"`
	OrderIndex *int32           `json:"orderIndex,omitempty"`
}

// CreateI18nMessageInput is the admin create payload.
type CreateI18nMessageInput struct {
	Key      string  `json:"key"`
	Locale   string  `json:"locale"`
	Value    string  `json:"value"`
	Category *string `json:"category,omitempty"`
}

// UpdateI18nMessageInput is the admin update payload.
type UpdateI18nMessageInput struct {
	Value    *string `json:"value,omitempty"`
	Category *string `json:"category,omitempty"`
}

// =============================================================
// Service methods: app_settings
// =============================================================

// ListAppSettings returns all app_settings, optionally filtered by scope.
func (s *Service) ListAppSettings(scope string) ([]AppSettingView, error) {
	var arg db.ListAppSettingsParams
	if scope != "" {
		arg.Scope = db.NullAppSettingsScope{AppSettingsScope: db.AppSettingsScope(scope), Valid: true}
	}
	rows, err := s.repo.q.ListAppSettings(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list app_settings", err)
	}
	out := make([]AppSettingView, 0, len(rows))
	for _, r := range rows {
		out = append(out, AppSettingView{
			Key:         r.Key,
			Value:       r.ValueJson,
			Scope:       string(r.Scope),
			Description: nullStrPtr(r.Description),
			UpdatedAt:   r.UpdatedAt,
		})
	}
	return out, nil
}

// CreateAppSetting inserts a new app_settings row.
func (s *Service) CreateAppSetting(ctx context.Context, in CreateAppSettingInput) (AppSettingView, error) {
	if strings.TrimSpace(in.Key) == "" {
		return AppSettingView{}, errs.BadRequest("key is required")
	}
	if len(in.Value) == 0 {
		return AppSettingView{}, errs.BadRequest("valueJson is required")
	}
	scope := "global"
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	now := time.Now().UTC()
	_, err := s.repo.q.CreateAppSetting(ctx, db.CreateAppSettingParams{
		Key:         in.Key,
		ValueJson:   in.Value,
		Scope:       db.AppSettingsScope(scope),
		Description: nullStrFromPtr(in.Description),
		UpdatedAt:   now,
	})
	if err != nil {
		return AppSettingView{}, writeError("create app_setting", err)
	}
	return s.getAppSettingByKey(ctx, in.Key)
}

// UpdateAppSetting updates an app_settings row by key.
func (s *Service) UpdateAppSetting(ctx context.Context, key string, in UpdateAppSettingInput) (AppSettingView, error) {
	before, err := s.getAppSettingByKeyRaw(ctx, key)
	if err != nil {
		return AppSettingView{}, err
	}
	value := before.ValueJson
	if in.Value != nil {
		value = *in.Value
	}
	scope := string(before.Scope)
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	description := before.Description
	if in.Description != nil {
		if *in.Description == "" {
			description = sql.NullString{}
		} else {
			description = sql.NullString{String: *in.Description, Valid: true}
		}
	}
	now := time.Now().UTC()
	if err := s.repo.q.UpdateAppSetting(ctx, db.UpdateAppSettingParams{
		ValueJson:   value,
		Scope:       db.AppSettingsScope(scope),
		Description: description,
		UpdatedAt:   now,
		Key:         key,
	}); err != nil {
		return AppSettingView{}, writeError("update app_setting", err)
	}
	return s.getAppSettingByKey(ctx, key)
}

// DeleteAppSetting removes an app_settings row by key.
func (s *Service) DeleteAppSetting(ctx context.Context, key string) error {
	res, err := s.repo.q.DeleteAppSetting(ctx, key)
	if err != nil {
		return errs.Internal("delete app_setting", err)
	}
	if err := rowsAffectedErr(res, "App setting not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getAppSettingByKeyRaw(ctx context.Context, key string) (db.AppSetting, error) {
	row, err := s.repo.q.GetAppSettingByKey(ctx, key)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.AppSetting{}, errs.NotFound("App setting not found")
		}
		return db.AppSetting{}, errs.Internal("get app_setting", err)
	}
	return row, nil
}

func (s *Service) getAppSettingByKey(ctx context.Context, key string) (AppSettingView, error) {
	row, err := s.getAppSettingByKeyRaw(ctx, key)
	if err != nil {
		return AppSettingView{}, err
	}
	return AppSettingView{
		Key:         row.Key,
		Value:       row.ValueJson,
		Scope:       string(row.Scope),
		Description: nullStrPtr(row.Description),
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

// =============================================================
// Service methods: site_settings (public + admin)
// =============================================================

// ListSiteSettings returns site_settings, optionally filtered by scope.
func (s *Service) ListSiteSettings(scope string) ([]SiteSettingView, error) {
	var arg db.ListSiteSettingsParams
	if scope != "" {
		arg.Scope = db.NullSiteSettingsScope{SiteSettingsScope: db.SiteSettingsScope(scope), Valid: true}
	}
	rows, err := s.repo.q.ListSiteSettings(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list site_settings", err)
	}
	return mapSiteSettings(rows), nil
}

// GetSiteSettingsByKeys returns site_settings keyed by `key`. The NestJS
// service returns a `Record<key, value>` map (no metadata). For our
// Go response we return []SiteSettingView so the frontend can see the
// `scope` + `description` too — this is a 1:1 port in the array shape.
//
// Note: the NestJS public route actually returns either a list (no
// `?keys=`) or a key→value map (`?keys=a,b,c`). We mirror that by
// returning a list when no keys are supplied and a map when keys
// are supplied (the handler switches on `keys`).
func (s *Service) GetSiteSettingsByKeys(keys []string) (map[string]json.RawMessage, error) {
	rows, err := s.repo.q.ListSiteSettingsByKeys(context.Background(), keys)
	if err != nil {
		return nil, errs.Internal("list site_settings by keys", err)
	}
	out := make(map[string]json.RawMessage, len(rows))
	for _, r := range rows {
		out[r.Key] = r.Value
	}
	return out, nil
}

// CreateSiteSetting inserts a new site_settings row.
func (s *Service) CreateSiteSetting(ctx context.Context, in CreateSiteSettingInput) (SiteSettingView, error) {
	if strings.TrimSpace(in.Key) == "" {
		return SiteSettingView{}, errs.BadRequest("key is required")
	}
	if len(in.Value) == 0 {
		return SiteSettingView{}, errs.BadRequest("valueJson is required")
	}
	scope := "global"
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	now := time.Now().UTC()
	_, err := s.repo.q.CreateSiteSetting(ctx, db.CreateSiteSettingParams{
		Key:         in.Key,
		Value:       in.Value,
		Scope:       db.SiteSettingsScope(scope),
		Description: nullStrFromPtr(in.Description),
		UpdatedAt:   now,
	})
	if err != nil {
		return SiteSettingView{}, writeError("create site_setting", err)
	}
	return s.getSiteSettingByKey(ctx, in.Key)
}

// UpdateSiteSetting updates a site_settings row by key.
func (s *Service) UpdateSiteSetting(ctx context.Context, key string, in UpdateSiteSettingInput) (SiteSettingView, error) {
	before, err := s.getSiteSettingByKeyRaw(ctx, key)
	if err != nil {
		return SiteSettingView{}, err
	}
	value := before.Value
	if in.Value != nil {
		value = *in.Value
	}
	scope := string(before.Scope)
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	description := before.Description
	if in.Description != nil {
		if *in.Description == "" {
			description = sql.NullString{}
		} else {
			description = sql.NullString{String: *in.Description, Valid: true}
		}
	}
	now := time.Now().UTC()
	if err := s.repo.q.UpdateSiteSetting(ctx, db.UpdateSiteSettingParams{
		Value:       value,
		Scope:       db.SiteSettingsScope(scope),
		Description: description,
		UpdatedAt:   now,
		Key:         key,
	}); err != nil {
		return SiteSettingView{}, writeError("update site_setting", err)
	}
	return s.getSiteSettingByKey(ctx, key)
}

// DeleteSiteSetting removes a site_settings row by key.
func (s *Service) DeleteSiteSetting(ctx context.Context, key string) error {
	res, err := s.repo.q.DeleteSiteSetting(ctx, key)
	if err != nil {
		return errs.Internal("delete site_setting", err)
	}
	if err := rowsAffectedErr(res, "Site setting not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getSiteSettingByKeyRaw(ctx context.Context, key string) (db.SiteSetting, error) {
	row, err := s.repo.q.GetSiteSettingByKey(ctx, key)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.SiteSetting{}, errs.NotFound("Site setting not found")
		}
		return db.SiteSetting{}, errs.Internal("get site_setting", err)
	}
	return row, nil
}

func (s *Service) getSiteSettingByKey(ctx context.Context, key string) (SiteSettingView, error) {
	row, err := s.getSiteSettingByKeyRaw(ctx, key)
	if err != nil {
		return SiteSettingView{}, err
	}
	return SiteSettingView{
		Key:         row.Key,
		Value:       row.Value,
		Scope:       string(row.Scope),
		Description: nullStrPtr(row.Description),
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

// =============================================================
// Service methods: page_settings
// =============================================================

// ListPageSettings returns all page_settings, optionally filtered by page.
func (s *Service) ListPageSettings(page string) ([]PageSettingView, error) {
	var arg db.ListPageSettingsParams
	if page != "" {
		arg.Page = sql.NullString{String: page, Valid: true}
	}
	rows, err := s.repo.q.ListPageSettings(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list page_settings", err)
	}
	return mapPageSettings(rows), nil
}

// GetPageSettingsByPages returns a map of page -> key -> value. Mirrors
// NestJS getPageSettingsByPages.
func (s *Service) GetPageSettingsByPages(pages []string) (map[string]map[string]json.RawMessage, error) {
	rows, err := s.repo.q.ListPageSettingsByPages(context.Background(), pages)
	if err != nil {
		return nil, errs.Internal("list page_settings by pages", err)
	}
	out := make(map[string]map[string]json.RawMessage, len(pages))
	for _, p := range pages {
		out[p] = map[string]json.RawMessage{}
	}
	for _, r := range rows {
		m, ok := out[r.Page]
		if !ok {
			m = map[string]json.RawMessage{}
			out[r.Page] = m
		}
		m[r.Key] = r.Value
	}
	return out, nil
}

// CreatePageSetting inserts a new page_settings row.
func (s *Service) CreatePageSetting(ctx context.Context, in CreatePageSettingInput) (PageSettingView, error) {
	if strings.TrimSpace(in.Page) == "" || strings.TrimSpace(in.Key) == "" {
		return PageSettingView{}, errs.BadRequest("page and key are required")
	}
	if len(in.Value) == 0 {
		return PageSettingView{}, errs.BadRequest("valueJson is required")
	}
	now := time.Now().UTC()
	_, err := s.repo.q.CreatePageSetting(ctx, db.CreatePageSettingParams{
		Page:        in.Page,
		Key:         in.Key,
		Value:       in.Value,
		Description: nullStrFromPtr(in.Description),
		UpdatedAt:   now,
	})
	if err != nil {
		return PageSettingView{}, writeError("create page_setting", err)
	}
	return s.getPageSetting(ctx, in.Page, in.Key)
}

// UpdatePageSetting updates a page_settings row by (page, key).
func (s *Service) UpdatePageSetting(ctx context.Context, id string, in UpdatePageSettingInput) (PageSettingView, error) {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return PageSettingView{}, err
	}
	page, key := parts[0], parts[1]
	before, err := s.getPageSettingRaw(ctx, page, key)
	if err != nil {
		return PageSettingView{}, err
	}
	value := before.Value
	if in.Value != nil {
		value = *in.Value
	}
	description := before.Description
	if in.Description != nil {
		if *in.Description == "" {
			description = sql.NullString{}
		} else {
			description = sql.NullString{String: *in.Description, Valid: true}
		}
	}
	now := time.Now().UTC()
	if err := s.repo.q.UpdatePageSetting(ctx, db.UpdatePageSettingParams{
		Value:       value,
		Description: description,
		UpdatedAt:   now,
		Page:        page,
		Key:         key,
	}); err != nil {
		return PageSettingView{}, writeError("update page_setting", err)
	}
	return s.getPageSetting(ctx, page, key)
}

// DeletePageSetting removes a page_settings row by (page, key).
func (s *Service) DeletePageSetting(ctx context.Context, id string) error {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return err
	}
	res, err := s.repo.q.DeletePageSetting(ctx, db.DeletePageSettingParams{
		Page: parts[0], Key: parts[1],
	})
	if err != nil {
		return errs.Internal("delete page_setting", err)
	}
	if err := rowsAffectedErr(res, "Page setting not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getPageSettingRaw(ctx context.Context, page, key string) (db.PageSetting, error) {
	row, err := s.repo.q.GetPageSetting(ctx, db.GetPageSettingParams{Page: page, Key: key})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.PageSetting{}, errs.NotFound("Page setting not found")
		}
		return db.PageSetting{}, errs.Internal("get page_setting", err)
	}
	return row, nil
}

func (s *Service) getPageSetting(ctx context.Context, page, key string) (PageSettingView, error) {
	row, err := s.getPageSettingRaw(ctx, page, key)
	if err != nil {
		return PageSettingView{}, err
	}
	return PageSettingView{
		Page:        row.Page,
		Key:         row.Key,
		Value:       row.Value,
		Description: nullStrPtr(row.Description),
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

// =============================================================
// Service methods: enum_translations
// =============================================================

// ListEnumTranslations returns enum_translations filtered by type + locale.
func (s *Service) ListEnumTranslations(enumType, locale string) ([]EnumTranslationView, error) {
	arg := db.ListEnumTranslationsParams{}
	if enumType != "" {
		arg.EnumType = sql.NullString{String: enumType, Valid: true}
	}
	if locale != "" {
		arg.Locale = sql.NullString{String: locale, Valid: true}
	}
	rows, err := s.repo.q.ListEnumTranslations(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list enum_translations", err)
	}
	out := make([]EnumTranslationView, 0, len(rows))
	for _, r := range rows {
		out = append(out, EnumTranslationView{
			EnumType: r.EnumType, EnumValue: r.EnumValue, Locale: r.Locale,
			Label: r.Label, ColorClass: nullStrPtr(r.ColorClass),
			Icon: nullStrPtr(r.Icon), SortOrder: r.SortOrder,
		})
	}
	return out, nil
}

// CreateEnumTranslation inserts a new enum_translation row.
func (s *Service) CreateEnumTranslation(ctx context.Context, in CreateEnumTranslationInput) (EnumTranslationView, error) {
	if strings.TrimSpace(in.EnumType) == "" || strings.TrimSpace(in.EnumValue) == "" || strings.TrimSpace(in.Locale) == "" {
		return EnumTranslationView{}, errs.BadRequest("enumType, enumValue, and locale are required")
	}
	if strings.TrimSpace(in.Label) == "" {
		return EnumTranslationView{}, errs.BadRequest("label is required")
	}
	sortOrder := int32(0)
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}
	_, err := s.repo.q.CreateEnumTranslation(ctx, db.CreateEnumTranslationParams{
		EnumType:   in.EnumType,
		EnumValue:  in.EnumValue,
		Locale:     in.Locale,
		Label:      in.Label,
		ColorClass: nullStrFromPtr(in.ColorClass),
		Icon:       nullStrFromPtr(in.Icon),
		SortOrder:  sortOrder,
	})
	if err != nil {
		return EnumTranslationView{}, writeError("create enum_translation", err)
	}
	return s.getEnumTranslation(ctx, in.EnumType, in.EnumValue, in.Locale)
}

// UpdateEnumTranslation updates an enum_translation row by composite id.
func (s *Service) UpdateEnumTranslation(ctx context.Context, id string, in UpdateEnumTranslationInput) (EnumTranslationView, error) {
	parts, err := splitCompositeID(id, 3)
	if err != nil {
		return EnumTranslationView{}, err
	}
	enumType, enumValue, locale := parts[0], parts[1], parts[2]
	before, err := s.getEnumTranslationRaw(ctx, enumType, enumValue, locale)
	if err != nil {
		return EnumTranslationView{}, err
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return EnumTranslationView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	colorClass := before.ColorClass
	if in.ColorClass != nil {
		if *in.ColorClass == "" {
			colorClass = sql.NullString{}
		} else {
			colorClass = sql.NullString{String: *in.ColorClass, Valid: true}
		}
	}
	icon := before.Icon
	if in.Icon != nil {
		if *in.Icon == "" {
			icon = sql.NullString{}
		} else {
			icon = sql.NullString{String: *in.Icon, Valid: true}
		}
	}
	sortOrder := before.SortOrder
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}
	if err := s.repo.q.UpdateEnumTranslation(ctx, db.UpdateEnumTranslationParams{
		Label:      label,
		ColorClass: colorClass,
		Icon:       icon,
		SortOrder:  sortOrder,
		EnumType:   enumType,
		EnumValue:  enumValue,
		Locale:     locale,
	}); err != nil {
		return EnumTranslationView{}, writeError("update enum_translation", err)
	}
	return s.getEnumTranslation(ctx, enumType, enumValue, locale)
}

// DeleteEnumTranslation removes an enum_translation row by composite id.
func (s *Service) DeleteEnumTranslation(ctx context.Context, id string) error {
	parts, err := splitCompositeID(id, 3)
	if err != nil {
		return err
	}
	res, err := s.repo.q.DeleteEnumTranslation(ctx, db.DeleteEnumTranslationParams{
		EnumType: parts[0], EnumValue: parts[1], Locale: parts[2],
	})
	if err != nil {
		return errs.Internal("delete enum_translation", err)
	}
	if err := rowsAffectedErr(res, "Enum translation not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getEnumTranslationRaw(ctx context.Context, enumType, enumValue, locale string) (db.EnumTranslation, error) {
	row, err := s.repo.q.GetEnumTranslation(ctx, db.GetEnumTranslationParams{
		EnumType: enumType, EnumValue: enumValue, Locale: locale,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.EnumTranslation{}, errs.NotFound("Enum translation not found")
		}
		return db.EnumTranslation{}, errs.Internal("get enum_translation", err)
	}
	return row, nil
}

func (s *Service) getEnumTranslation(ctx context.Context, enumType, enumValue, locale string) (EnumTranslationView, error) {
	row, err := s.getEnumTranslationRaw(ctx, enumType, enumValue, locale)
	if err != nil {
		return EnumTranslationView{}, err
	}
	return EnumTranslationView{
		EnumType: row.EnumType, EnumValue: row.EnumValue, Locale: row.Locale,
		Label: row.Label, ColorClass: nullStrPtr(row.ColorClass),
		Icon: nullStrPtr(row.Icon), SortOrder: row.SortOrder,
	}, nil
}

// =============================================================
// Service methods: date_format_templates
// =============================================================

// ListDateFormatTemplates returns date_format_templates filtered by scope + locale.
func (s *Service) ListDateFormatTemplates(scope, locale string) ([]DateFormatTemplateView, error) {
	arg := db.ListDateFormatTemplatesParams{}
	if scope != "" {
		arg.Scope = db.NullDateFormatTemplatesScope{DateFormatTemplatesScope: db.DateFormatTemplatesScope(scope), Valid: true}
	}
	if locale != "" {
		arg.Locale = sql.NullString{String: locale, Valid: true}
	}
	rows, err := s.repo.q.ListDateFormatTemplates(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list date_format_templates", err)
	}
	out := make([]DateFormatTemplateView, 0, len(rows))
	for _, r := range rows {
		out = append(out, DateFormatTemplateView{Scope: string(r.Scope), Locale: r.Locale, Template: r.Template})
	}
	return out, nil
}

// CreateDateFormatTemplate inserts a new date_format_template row.
func (s *Service) CreateDateFormatTemplate(ctx context.Context, in CreateDateFormatTemplateInput) (DateFormatTemplateView, error) {
	if strings.TrimSpace(in.Scope) == "" || strings.TrimSpace(in.Locale) == "" {
		return DateFormatTemplateView{}, errs.BadRequest("scope and locale are required")
	}
	if strings.TrimSpace(in.Template) == "" {
		return DateFormatTemplateView{}, errs.BadRequest("template is required")
	}
	_, err := s.repo.q.CreateDateFormatTemplate(ctx, db.CreateDateFormatTemplateParams{
		Scope:    db.DateFormatTemplatesScope(in.Scope),
		Locale:   in.Locale,
		Template: in.Template,
	})
	if err != nil {
		return DateFormatTemplateView{}, writeError("create date_format_template", err)
	}
	return s.getDateFormatTemplate(ctx, in.Scope, in.Locale)
}

// UpdateDateFormatTemplate updates a date_format_template by composite id.
func (s *Service) UpdateDateFormatTemplate(ctx context.Context, id string, in UpdateDateFormatTemplateInput) (DateFormatTemplateView, error) {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return DateFormatTemplateView{}, err
	}
	scope, locale := parts[0], parts[1]
	if strings.TrimSpace(in.Template) == "" {
		return DateFormatTemplateView{}, errs.BadRequest("template is required")
	}
	if err := s.repo.q.UpdateDateFormatTemplate(ctx, db.UpdateDateFormatTemplateParams{
		Template: in.Template,
		Scope:    db.DateFormatTemplatesScope(scope),
		Locale:   locale,
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DateFormatTemplateView{}, errs.NotFound("Date format template not found")
		}
		return DateFormatTemplateView{}, writeError("update date_format_template", err)
	}
	return s.getDateFormatTemplate(ctx, scope, locale)
}

// DeleteDateFormatTemplate removes a date_format_template by composite id.
func (s *Service) DeleteDateFormatTemplate(ctx context.Context, id string) error {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return err
	}
	res, err := s.repo.q.DeleteDateFormatTemplate(ctx, db.DeleteDateFormatTemplateParams{
		Scope: db.DateFormatTemplatesScope(parts[0]), Locale: parts[1],
	})
	if err != nil {
		return errs.Internal("delete date_format_template", err)
	}
	if err := rowsAffectedErr(res, "Date format template not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getDateFormatTemplate(ctx context.Context, scope, locale string) (DateFormatTemplateView, error) {
	row, err := s.repo.q.GetDateFormatTemplate(ctx, db.GetDateFormatTemplateParams{
		Scope: db.DateFormatTemplatesScope(scope), Locale: locale,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DateFormatTemplateView{}, errs.NotFound("Date format template not found")
		}
		return DateFormatTemplateView{}, errs.Internal("get date_format_template", err)
	}
	return DateFormatTemplateView{Scope: string(row.Scope), Locale: row.Locale, Template: row.Template}, nil
}

// =============================================================
// Service methods: i18n_messages
// =============================================================

// ListI18nMessages returns i18n_messages filtered by locale + category.
func (s *Service) ListI18nMessages(locale, category string) ([]I18nMessageView, error) {
	arg := db.ListI18nMessagesParams{}
	if locale != "" {
		arg.Locale = sql.NullString{String: locale, Valid: true}
	}
	if category != "" {
		arg.Category = db.NullI18nMessagesCategory{I18nMessagesCategory: db.I18nMessagesCategory(category), Valid: true}
	}
	rows, err := s.repo.q.ListI18nMessages(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list i18n_messages", err)
	}
	out := make([]I18nMessageView, 0, len(rows))
	for _, r := range rows {
		out = append(out, I18nMessageView{
			Key: r.Key, Locale: r.Locale, Value: r.Value, Category: string(r.Category),
		})
	}
	return out, nil
}

// CreateI18nMessage inserts a new i18n_message row.
func (s *Service) CreateI18nMessage(ctx context.Context, in CreateI18nMessageInput) (I18nMessageView, error) {
	if strings.TrimSpace(in.Key) == "" || strings.TrimSpace(in.Locale) == "" {
		return I18nMessageView{}, errs.BadRequest("key and locale are required")
	}
	if strings.TrimSpace(in.Value) == "" {
		return I18nMessageView{}, errs.BadRequest("value is required")
	}
	category := "common"
	if in.Category != nil && *in.Category != "" {
		category = *in.Category
	}
	_, err := s.repo.q.CreateI18nMessage(ctx, db.CreateI18nMessageParams{
		Key: in.Key, Locale: in.Locale, Value: in.Value,
		Category: db.I18nMessagesCategory(category),
	})
	if err != nil {
		return I18nMessageView{}, writeError("create i18n_message", err)
	}
	return s.getI18nMessage(ctx, in.Key, in.Locale)
}

// UpdateI18nMessage updates an i18n_message by composite id.
func (s *Service) UpdateI18nMessage(ctx context.Context, id string, in UpdateI18nMessageInput) (I18nMessageView, error) {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return I18nMessageView{}, err
	}
	key, locale := parts[0], parts[1]
	before, err := s.getI18nMessageRaw(ctx, key, locale)
	if err != nil {
		return I18nMessageView{}, err
	}
	value := before.Value
	if in.Value != nil {
		if strings.TrimSpace(*in.Value) == "" {
			return I18nMessageView{}, errs.BadRequest("value cannot be empty")
		}
		value = *in.Value
	}
	category := string(before.Category)
	if in.Category != nil && *in.Category != "" {
		category = *in.Category
	}
	if err := s.repo.q.UpdateI18nMessage(ctx, db.UpdateI18nMessageParams{
		Value:    value,
		Category: db.I18nMessagesCategory(category),
		Key:      key,
		Locale:   locale,
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return I18nMessageView{}, errs.NotFound("I18n message not found")
		}
		return I18nMessageView{}, writeError("update i18n_message", err)
	}
	return s.getI18nMessage(ctx, key, locale)
}

// DeleteI18nMessage removes an i18n_message by composite id.
func (s *Service) DeleteI18nMessage(ctx context.Context, id string) error {
	parts, err := splitCompositeID(id, 2)
	if err != nil {
		return err
	}
	res, err := s.repo.q.DeleteI18nMessage(ctx, db.DeleteI18nMessageParams{
		Key: parts[0], Locale: parts[1],
	})
	if err != nil {
		return errs.Internal("delete i18n_message", err)
	}
	if err := rowsAffectedErr(res, "I18n message not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getI18nMessageRaw(ctx context.Context, key, locale string) (db.I18nMessage, error) {
	row, err := s.repo.q.GetI18nMessage(ctx, db.GetI18nMessageParams{Key: key, Locale: locale})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.I18nMessage{}, errs.NotFound("I18n message not found")
		}
		return db.I18nMessage{}, errs.Internal("get i18n_message", err)
	}
	return row, nil
}

func (s *Service) getI18nMessage(ctx context.Context, key, locale string) (I18nMessageView, error) {
	row, err := s.getI18nMessageRaw(ctx, key, locale)
	if err != nil {
		return I18nMessageView{}, err
	}
	return I18nMessageView{
		Key: row.Key, Locale: row.Locale, Value: row.Value, Category: string(row.Category),
	}, nil
}

// =============================================================
// Generic id-resource CRUD (12 resources)
// =============================================================
//
// For the 12 String-PK tables we use direct SQL so each helper stays
// under ~30 lines and we can add new resources without writing 4 more
// query files. The sqlc-generated queries are still used for the
// select-only "list with filter" path because that's where the dynamic
// IS NULL OR x = ? pattern matters most.

// (Resource-specific list/get/create/update/delete live below in the
// "Resource-specific service methods" section. The idResource type
// above is kept as documentation of which table has which fields.)

// =============================================================
// Public DTO mappers (sqlc row -> JSON-safe view)
// =============================================================

func mapSiteSettings(rows []db.SiteSetting) []SiteSettingView {
	out := make([]SiteSettingView, 0, len(rows))
	for _, r := range rows {
		out = append(out, SiteSettingView{
			Key:         r.Key,
			Value:       r.Value,
			Scope:       string(r.Scope),
			Description: nullStrPtr(r.Description),
			UpdatedAt:   r.UpdatedAt,
		})
	}
	return out
}

func mapPageSettings(rows []db.PageSetting) []PageSettingView {
	out := make([]PageSettingView, 0, len(rows))
	for _, r := range rows {
		out = append(out, PageSettingView{
			Page:        r.Page,
			Key:         r.Key,
			Value:       r.Value,
			Description: nullStrPtr(r.Description),
			UpdatedAt:   r.UpdatedAt,
		})
	}
	return out
}

// =============================================================
// Resource-specific service methods (12 id resources)
// =============================================================

// ---------- industries ----------

func (s *Service) ListIndustries(active *bool) ([]IndustryView, error) {
	rows, err := s.repo.q.ListIndustries(context.Background(), activeToIndustriesParams(active))
	if err != nil {
		return nil, errs.Internal("list industries", err)
	}
	out := make([]IndustryView, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapIndustry(r))
	}
	return out, nil
}

func (s *Service) CreateIndustry(ctx context.Context, in CreateIndustryInput) (IndustryView, error) {
	if strings.TrimSpace(in.Key) == "" {
		return IndustryView{}, errs.BadRequest("key is required")
	}
	if strings.TrimSpace(in.Label) == "" {
		return IndustryView{}, errs.BadRequest("label is required")
	}
	now := time.Now().UTC()
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	methodology := in.Methodology
	if len(methodology) == 0 {
		methodology = json.RawMessage("null")
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateIndustry(ctx, db.CreateIndustryParams{
		ID:          id,
		Key:         in.Key,
		Label:       in.Label,
		Description: nullStrFromPtr(in.Description),
		Icon:        nullStrFromPtr(in.Icon),
		Methodology: methodology,
		IsActive:    isActive,
		OrderIndex:  orderIdx,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		return IndustryView{}, writeError("create industry", err)
	}
	return s.getIndustryByID(ctx, id)
}

func (s *Service) UpdateIndustry(ctx context.Context, id string, in UpdateIndustryInput) (IndustryView, error) {
	before, err := s.repo.q.GetIndustryByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IndustryView{}, errs.NotFound("Industry not found")
		}
		return IndustryView{}, errs.Internal("get industry", err)
	}
	key := before.Key
	if in.Key != nil && *in.Key != "" {
		key = *in.Key
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return IndustryView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	description := before.Description
	if in.Description != nil {
		if *in.Description == "" {
			description = sql.NullString{}
		} else {
			description = sql.NullString{String: *in.Description, Valid: true}
		}
	}
	icon := before.Icon
	if in.Icon != nil {
		if *in.Icon == "" {
			icon = sql.NullString{}
		} else {
			icon = sql.NullString{String: *in.Icon, Valid: true}
		}
	}
	methodology := before.Methodology
	if in.Methodology != nil {
		methodology = *in.Methodology
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateIndustry(ctx, db.UpdateIndustryParams{
		Key:         key,
		Label:       label,
		Description: description,
		Icon:        icon,
		Methodology: methodology,
		IsActive:    isActive,
		OrderIndex:  orderIdx,
		UpdatedAt:   time.Now().UTC(),
		ID:          id,
	}); err != nil {
		return IndustryView{}, writeError("update industry", err)
	}
	return s.getIndustryByID(ctx, id)
}

func (s *Service) DeleteIndustry(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteIndustry(ctx, id)
	if err != nil {
		return errs.Internal("delete industry", err)
	}
	if err := rowsAffectedErr(res, "Industry not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getIndustryByID(ctx context.Context, id string) (IndustryView, error) {
	row, err := s.repo.q.GetIndustryByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IndustryView{}, errs.NotFound("Industry not found")
		}
		return IndustryView{}, errs.Internal("get industry", err)
	}
	return mapIndustry(row), nil
}

func mapIndustry(r db.Industry) IndustryView {
	return IndustryView{
		ID:          r.ID,
		Key:         r.Key,
		Label:       r.Label,
		Description: nullStrPtr(r.Description),
		Icon:        nullStrPtr(r.Icon),
		Methodology: r.Methodology,
		IsActive:    r.IsActive,
		OrderIndex:  r.OrderIndex,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// ---------- enterprise_methods ----------

func (s *Service) ListEnterpriseMethods(active *bool) ([]EnterpriseMethodView, error) {
	rows, err := s.repo.q.ListEnterpriseMethods(context.Background(), activeToEnterpriseMethodsParams(active))
	if err != nil {
		return nil, errs.Internal("list enterprise_methods", err)
	}
	out := make([]EnterpriseMethodView, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapEnterpriseMethod(r))
	}
	return out, nil
}

func (s *Service) CreateEnterpriseMethod(ctx context.Context, in CreateEnterpriseMethodInput) (EnterpriseMethodView, error) {
	if strings.TrimSpace(in.Num) == "" {
		return EnterpriseMethodView{}, errs.BadRequest("num is required")
	}
	if strings.TrimSpace(in.Title) == "" {
		return EnterpriseMethodView{}, errs.BadRequest("title is required")
	}
	if len(in.Bullets) == 0 {
		return EnterpriseMethodView{}, errs.BadRequest("bullets is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateEnterpriseMethod(ctx, db.CreateEnterpriseMethodParams{
		ID:         id,
		Num:        in.Num,
		Title:      in.Title,
		Desc:       strDeref(in.Desc),
		Bullets:    in.Bullets,
		IsActive:   isActive,
		OrderIndex: orderIdx,
	})
	if err != nil {
		return EnterpriseMethodView{}, writeError("create enterprise_method", err)
	}
	return s.getEnterpriseMethodByID(ctx, id)
}

func (s *Service) UpdateEnterpriseMethod(ctx context.Context, id string, in UpdateEnterpriseMethodInput) (EnterpriseMethodView, error) {
	before, err := s.repo.q.GetEnterpriseMethodByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return EnterpriseMethodView{}, errs.NotFound("Enterprise method not found")
		}
		return EnterpriseMethodView{}, errs.Internal("get enterprise_method", err)
	}
	num := before.Num
	if in.Num != nil && *in.Num != "" {
		num = *in.Num
	}
	title := before.Title
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			return EnterpriseMethodView{}, errs.BadRequest("title cannot be empty")
		}
		title = *in.Title
	}
	desc := before.Desc
	if in.Desc != nil {
		desc = *in.Desc
	}
	bullets := before.Bullets
	if in.Bullets != nil {
		bullets = *in.Bullets
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateEnterpriseMethod(ctx, db.UpdateEnterpriseMethodParams{
		Num:        num,
		Title:      title,
		Desc:       desc,
		Bullets:    bullets,
		IsActive:   isActive,
		OrderIndex: orderIdx,
		ID:         id,
	}); err != nil {
		return EnterpriseMethodView{}, writeError("update enterprise_method", err)
	}
	return s.getEnterpriseMethodByID(ctx, id)
}

func (s *Service) DeleteEnterpriseMethod(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteEnterpriseMethod(ctx, id)
	if err != nil {
		return errs.Internal("delete enterprise_method", err)
	}
	if err := rowsAffectedErr(res, "Enterprise method not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getEnterpriseMethodByID(ctx context.Context, id string) (EnterpriseMethodView, error) {
	row, err := s.repo.q.GetEnterpriseMethodByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return EnterpriseMethodView{}, errs.NotFound("Enterprise method not found")
		}
		return EnterpriseMethodView{}, errs.Internal("get enterprise_method", err)
	}
	return mapEnterpriseMethod(row), nil
}

func mapEnterpriseMethod(r db.EnterpriseMethod) EnterpriseMethodView {
	return EnterpriseMethodView{
		ID:         r.ID,
		Num:        r.Num,
		Title:      r.Title,
		Desc:       r.Desc,
		Bullets:    r.Bullets,
		IsActive:   r.IsActive,
		OrderIndex: r.OrderIndex,
	}
}

// ---------- testimonials ----------

func (s *Service) ListTestimonials(active *bool) ([]TestimonialView, error) {
	rows, err := s.repo.q.ListTestimonials(context.Background(), activeToTestimonialsParams(active))
	if err != nil {
		return nil, errs.Internal("list testimonials", err)
	}
	out := make([]TestimonialView, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapTestimonial(r))
	}
	return out, nil
}

func (s *Service) CreateTestimonial(ctx context.Context, in CreateTestimonialInput) (TestimonialView, error) {
	if strings.TrimSpace(in.Name) == "" {
		return TestimonialView{}, errs.BadRequest("name is required")
	}
	if strings.TrimSpace(in.Quote) == "" {
		return TestimonialView{}, errs.BadRequest("quote is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateTestimonial(ctx, db.CreateTestimonialParams{
		ID:         id,
		Name:       in.Name,
		Title:      strDeref(in.Title),
		Quote:      in.Quote,
		Avatar:     nullStrFromPtr(in.Avatar),
		IsActive:   isActive,
		OrderIndex: orderIdx,
	})
	if err != nil {
		return TestimonialView{}, writeError("create testimonial", err)
	}
	return s.getTestimonialByID(ctx, id)
}

func (s *Service) UpdateTestimonial(ctx context.Context, id string, in UpdateTestimonialInput) (TestimonialView, error) {
	before, err := s.repo.q.GetTestimonialByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TestimonialView{}, errs.NotFound("Testimonial not found")
		}
		return TestimonialView{}, errs.Internal("get testimonial", err)
	}
	name := before.Name
	if in.Name != nil {
		if strings.TrimSpace(*in.Name) == "" {
			return TestimonialView{}, errs.BadRequest("name cannot be empty")
		}
		name = *in.Name
	}
	title := before.Title
	if in.Title != nil {
		title = *in.Title
	}
	quote := before.Quote
	if in.Quote != nil {
		if strings.TrimSpace(*in.Quote) == "" {
			return TestimonialView{}, errs.BadRequest("quote cannot be empty")
		}
		quote = *in.Quote
	}
	avatar := before.Avatar
	if in.Avatar != nil {
		if *in.Avatar == "" {
			avatar = sql.NullString{}
		} else {
			avatar = sql.NullString{String: *in.Avatar, Valid: true}
		}
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateTestimonial(ctx, db.UpdateTestimonialParams{
		Name:       name,
		Title:      title,
		Quote:      quote,
		Avatar:     avatar,
		IsActive:   isActive,
		OrderIndex: orderIdx,
		ID:         id,
	}); err != nil {
		return TestimonialView{}, writeError("update testimonial", err)
	}
	return s.getTestimonialByID(ctx, id)
}

func (s *Service) DeleteTestimonial(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteTestimonial(ctx, id)
	if err != nil {
		return errs.Internal("delete testimonial", err)
	}
	if err := rowsAffectedErr(res, "Testimonial not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getTestimonialByID(ctx context.Context, id string) (TestimonialView, error) {
	row, err := s.repo.q.GetTestimonialByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TestimonialView{}, errs.NotFound("Testimonial not found")
		}
		return TestimonialView{}, errs.Internal("get testimonial", err)
	}
	return mapTestimonial(row), nil
}

func mapTestimonial(r db.Testimonial) TestimonialView {
	return TestimonialView{
		ID:         r.ID,
		Name:       r.Name,
		Title:      r.Title,
		Quote:      r.Quote,
		Avatar:     nullStrPtr(r.Avatar),
		IsActive:   r.IsActive,
		OrderIndex: r.OrderIndex,
	}
}

// ---------- quick_prompts ----------

func (s *Service) ListQuickPrompts(active *bool, scope string) ([]QuickPromptView, error) {
	arg := db.ListQuickPromptsParams{}
	if active != nil {
		arg.IsActive = sql.NullBool{Bool: *active, Valid: true}
	}
	if scope != "" {
		arg.Scope = db.NullQuickPromptsScope{QuickPromptsScope: db.QuickPromptsScope(scope), Valid: true}
	}
	rows, err := s.repo.q.ListQuickPrompts(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list quick_prompts", err)
	}
	out := make([]QuickPromptView, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapQuickPrompt(r))
	}
	return out, nil
}

func (s *Service) CreateQuickPrompt(ctx context.Context, in CreateQuickPromptInput) (QuickPromptView, error) {
	if strings.TrimSpace(in.Label) == "" {
		return QuickPromptView{}, errs.BadRequest("label is required")
	}
	if strings.TrimSpace(in.PromptText) == "" {
		return QuickPromptView{}, errs.BadRequest("promptText is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	emoji := "💡"
	if in.Emoji != nil && *in.Emoji != "" {
		emoji = *in.Emoji
	}
	scope := "lesson"
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateQuickPrompt(ctx, db.CreateQuickPromptParams{
		ID:         id,
		Emoji:      emoji,
		Label:      in.Label,
		PromptText: in.PromptText,
		Scope:      db.QuickPromptsScope(scope),
		IsActive:   isActive,
		OrderIndex: orderIdx,
	})
	if err != nil {
		return QuickPromptView{}, writeError("create quick_prompt", err)
	}
	return s.getQuickPromptByID(ctx, id)
}

func (s *Service) UpdateQuickPrompt(ctx context.Context, id string, in UpdateQuickPromptInput) (QuickPromptView, error) {
	before, err := s.repo.q.GetQuickPromptByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return QuickPromptView{}, errs.NotFound("Quick prompt not found")
		}
		return QuickPromptView{}, errs.Internal("get quick_prompt", err)
	}
	emoji := before.Emoji
	if in.Emoji != nil && *in.Emoji != "" {
		emoji = *in.Emoji
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return QuickPromptView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	promptText := before.PromptText
	if in.PromptText != nil {
		if strings.TrimSpace(*in.PromptText) == "" {
			return QuickPromptView{}, errs.BadRequest("promptText cannot be empty")
		}
		promptText = *in.PromptText
	}
	scope := string(before.Scope)
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateQuickPrompt(ctx, db.UpdateQuickPromptParams{
		Emoji:      emoji,
		Label:      label,
		PromptText: promptText,
		Scope:      db.QuickPromptsScope(scope),
		IsActive:   isActive,
		OrderIndex: orderIdx,
		ID:         id,
	}); err != nil {
		return QuickPromptView{}, writeError("update quick_prompt", err)
	}
	return s.getQuickPromptByID(ctx, id)
}

func (s *Service) DeleteQuickPrompt(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteQuickPrompt(ctx, id)
	if err != nil {
		return errs.Internal("delete quick_prompt", err)
	}
	if err := rowsAffectedErr(res, "Quick prompt not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getQuickPromptByID(ctx context.Context, id string) (QuickPromptView, error) {
	row, err := s.repo.q.GetQuickPromptByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return QuickPromptView{}, errs.NotFound("Quick prompt not found")
		}
		return QuickPromptView{}, errs.Internal("get quick_prompt", err)
	}
	return mapQuickPrompt(row), nil
}

func mapQuickPrompt(r db.QuickPrompt) QuickPromptView {
	return QuickPromptView{
		ID:         r.ID,
		Emoji:      r.Emoji,
		Label:      r.Label,
		PromptText: r.PromptText,
		Scope:      string(r.Scope),
		IsActive:   r.IsActive,
		OrderIndex: r.OrderIndex,
	}
}

// ---------- course_categories ----------

func (s *Service) ListCourseCategories(active *bool) ([]CourseCategoryView, error) {
	rows, err := s.repo.q.ListCourseCategories(context.Background(), activeToCourseCategoriesParams(active))
	if err != nil {
		return nil, errs.Internal("list course_categories", err)
	}
	out := make([]CourseCategoryView, 0, len(rows))
	for _, r := range rows {
		out = append(out, CourseCategoryView{
			ID: r.ID, Key: r.Key, Label: r.Label, IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreateCourseCategory(ctx context.Context, in CreateCourseCategoryInput) (CourseCategoryView, error) {
	if strings.TrimSpace(in.Key) == "" {
		return CourseCategoryView{}, errs.BadRequest("key is required")
	}
	if strings.TrimSpace(in.Label) == "" {
		return CourseCategoryView{}, errs.BadRequest("label is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateCourseCategory(ctx, db.CreateCourseCategoryParams{
		ID: id, Key: in.Key, Label: in.Label, IsActive: isActive, OrderIndex: orderIdx,
	})
	if err != nil {
		return CourseCategoryView{}, writeError("create course_category", err)
	}
	return s.getCourseCategoryByID(ctx, id)
}

func (s *Service) UpdateCourseCategory(ctx context.Context, id string, in UpdateCourseCategoryInput) (CourseCategoryView, error) {
	before, err := s.repo.q.GetCourseCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CourseCategoryView{}, errs.NotFound("Course category not found")
		}
		return CourseCategoryView{}, errs.Internal("get course_category", err)
	}
	key := before.Key
	if in.Key != nil && *in.Key != "" {
		key = *in.Key
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return CourseCategoryView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateCourseCategory(ctx, db.UpdateCourseCategoryParams{
		Key: key, Label: label, IsActive: isActive, OrderIndex: orderIdx, ID: id,
	}); err != nil {
		return CourseCategoryView{}, writeError("update course_category", err)
	}
	return s.getCourseCategoryByID(ctx, id)
}

func (s *Service) DeleteCourseCategory(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteCourseCategory(ctx, id)
	if err != nil {
		return errs.Internal("delete course_category", err)
	}
	if err := rowsAffectedErr(res, "Course category not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getCourseCategoryByID(ctx context.Context, id string) (CourseCategoryView, error) {
	row, err := s.repo.q.GetCourseCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CourseCategoryView{}, errs.NotFound("Course category not found")
		}
		return CourseCategoryView{}, errs.Internal("get course_category", err)
	}
	return CourseCategoryView{
		ID: row.ID, Key: row.Key, Label: row.Label, IsActive: row.IsActive, OrderIndex: row.OrderIndex,
	}, nil
}

// ---------- popular_searches ----------

func (s *Service) ListPopularSearches(active *bool) ([]PopularSearchView, error) {
	rows, err := s.repo.q.ListPopularSearches(context.Background(), activeToPopularSearchesParams(active))
	if err != nil {
		return nil, errs.Internal("list popular_searches", err)
	}
	out := make([]PopularSearchView, 0, len(rows))
	for _, r := range rows {
		out = append(out, PopularSearchView{
			ID: r.ID, Keyword: r.Keyword, ClickCount: r.ClickCount, IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreatePopularSearch(ctx context.Context, in CreatePopularSearchInput) (PopularSearchView, error) {
	if strings.TrimSpace(in.Keyword) == "" {
		return PopularSearchView{}, errs.BadRequest("keyword is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreatePopularSearch(ctx, db.CreatePopularSearchParams{
		ID: id, Keyword: in.Keyword, ClickCount: 0, IsActive: isActive, OrderIndex: orderIdx,
	})
	if err != nil {
		return PopularSearchView{}, writeError("create popular_search", err)
	}
	return s.getPopularSearchByID(ctx, id)
}

func (s *Service) UpdatePopularSearch(ctx context.Context, id string, in UpdatePopularSearchInput) (PopularSearchView, error) {
	before, err := s.repo.q.GetPopularSearchByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return PopularSearchView{}, errs.NotFound("Popular search not found")
		}
		return PopularSearchView{}, errs.Internal("get popular_search", err)
	}
	keyword := before.Keyword
	if in.Keyword != nil {
		if strings.TrimSpace(*in.Keyword) == "" {
			return PopularSearchView{}, errs.BadRequest("keyword cannot be empty")
		}
		keyword = *in.Keyword
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdatePopularSearch(ctx, db.UpdatePopularSearchParams{
		Keyword: keyword, ClickCount: before.ClickCount,
		IsActive: isActive, OrderIndex: orderIdx, ID: id,
	}); err != nil {
		return PopularSearchView{}, writeError("update popular_search", err)
	}
	return s.getPopularSearchByID(ctx, id)
}

func (s *Service) DeletePopularSearch(ctx context.Context, id string) error {
	res, err := s.repo.q.DeletePopularSearch(ctx, id)
	if err != nil {
		return errs.Internal("delete popular_search", err)
	}
	if err := rowsAffectedErr(res, "Popular search not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getPopularSearchByID(ctx context.Context, id string) (PopularSearchView, error) {
	row, err := s.repo.q.GetPopularSearchByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return PopularSearchView{}, errs.NotFound("Popular search not found")
		}
		return PopularSearchView{}, errs.Internal("get popular_search", err)
	}
	return PopularSearchView{
		ID: row.ID, Keyword: row.Keyword, ClickCount: row.ClickCount, IsActive: row.IsActive, OrderIndex: row.OrderIndex,
	}, nil
}

// ---------- hot_keywords ----------

func (s *Service) ListHotKeywords(active *bool, scope string) ([]HotKeywordView, error) {
	arg := db.ListHotKeywordsParams{}
	if active != nil {
		arg.IsActive = sql.NullBool{Bool: *active, Valid: true}
	}
	if scope != "" {
		arg.Scope = db.NullHotKeywordsScope{HotKeywordsScope: db.HotKeywordsScope(scope), Valid: true}
	}
	rows, err := s.repo.q.ListHotKeywords(context.Background(), arg)
	if err != nil {
		return nil, errs.Internal("list hot_keywords", err)
	}
	out := make([]HotKeywordView, 0, len(rows))
	for _, r := range rows {
		out = append(out, HotKeywordView{
			ID: r.ID, Keyword: r.Keyword, Scope: string(r.Scope), IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreateHotKeyword(ctx context.Context, in CreateHotKeywordInput) (HotKeywordView, error) {
	if strings.TrimSpace(in.Keyword) == "" {
		return HotKeywordView{}, errs.BadRequest("keyword is required")
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	scope := "courses"
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateHotKeyword(ctx, db.CreateHotKeywordParams{
		ID: id, Keyword: in.Keyword, Scope: db.HotKeywordsScope(scope),
		IsActive: isActive, OrderIndex: orderIdx,
	})
	if err != nil {
		return HotKeywordView{}, writeError("create hot_keyword", err)
	}
	return s.getHotKeywordByID(ctx, id)
}

func (s *Service) UpdateHotKeyword(ctx context.Context, id string, in UpdateHotKeywordInput) (HotKeywordView, error) {
	before, err := s.repo.q.GetHotKeywordByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return HotKeywordView{}, errs.NotFound("Hot keyword not found")
		}
		return HotKeywordView{}, errs.Internal("get hot_keyword", err)
	}
	keyword := before.Keyword
	if in.Keyword != nil {
		if strings.TrimSpace(*in.Keyword) == "" {
			return HotKeywordView{}, errs.BadRequest("keyword cannot be empty")
		}
		keyword = *in.Keyword
	}
	scope := string(before.Scope)
	if in.Scope != nil && *in.Scope != "" {
		scope = *in.Scope
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateHotKeyword(ctx, db.UpdateHotKeywordParams{
		Keyword: keyword, Scope: db.HotKeywordsScope(scope),
		IsActive: isActive, OrderIndex: orderIdx, ID: id,
	}); err != nil {
		return HotKeywordView{}, writeError("update hot_keyword", err)
	}
	return s.getHotKeywordByID(ctx, id)
}

func (s *Service) DeleteHotKeyword(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteHotKeyword(ctx, id)
	if err != nil {
		return errs.Internal("delete hot_keyword", err)
	}
	if err := rowsAffectedErr(res, "Hot keyword not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getHotKeywordByID(ctx context.Context, id string) (HotKeywordView, error) {
	row, err := s.repo.q.GetHotKeywordByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return HotKeywordView{}, errs.NotFound("Hot keyword not found")
		}
		return HotKeywordView{}, errs.Internal("get hot_keyword", err)
	}
	return HotKeywordView{
		ID: row.ID, Keyword: row.Keyword, Scope: string(row.Scope), IsActive: row.IsActive, OrderIndex: row.OrderIndex,
	}, nil
}

// ---------- auth_providers ----------

// ListAuthProviders returns the full admin view (with `config`).
func (s *Service) ListAuthProviders() ([]AuthProviderView, error) {
	rows, err := s.repo.q.ListAuthProviders(context.Background())
	if err != nil {
		return nil, errs.Internal("list auth_providers", err)
	}
	out := make([]AuthProviderView, 0, len(rows))
	for _, r := range rows {
		out = append(out, AuthProviderView{
			ID: r.ID, Label: r.Label, Icon: r.Icon, IsActive: r.IsActive,
			OrderIndex: r.OrderIndex, Config: r.Config,
		})
	}
	return out, nil
}

// ListAuthProvidersPublic returns the public view (no `config`).
func (s *Service) ListAuthProvidersPublic() ([]AuthProviderPublicView, error) {
	rows, err := s.repo.q.ListAuthProvidersPublic(context.Background())
	if err != nil {
		return nil, errs.Internal("list auth_providers public", err)
	}
	out := make([]AuthProviderPublicView, 0, len(rows))
	for _, r := range rows {
		out = append(out, AuthProviderPublicView{
			ID: r.ID, Label: r.Label, Icon: r.Icon, IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreateAuthProvider(ctx context.Context, in CreateAuthProviderInput) (AuthProviderView, error) {
	if strings.TrimSpace(in.ID) == "" {
		return AuthProviderView{}, errs.BadRequest("id is required")
	}
	if strings.TrimSpace(in.Label) == "" {
		return AuthProviderView{}, errs.BadRequest("label is required")
	}
	icon := "KeyRound"
	if in.Icon != nil && *in.Icon != "" {
		icon = *in.Icon
	}
	isActive := false
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateAuthProvider(ctx, db.CreateAuthProviderParams{
		ID: in.ID, Label: in.Label, Icon: icon, IsActive: isActive,
		OrderIndex: orderIdx, Config: in.Config,
	})
	if err != nil {
		return AuthProviderView{}, writeError("create auth_provider", err)
	}
	return s.getAuthProviderByID(ctx, in.ID)
}

func (s *Service) UpdateAuthProvider(ctx context.Context, id string, in UpdateAuthProviderInput) (AuthProviderView, error) {
	before, err := s.repo.q.GetAuthProviderByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthProviderView{}, errs.NotFound("Auth provider not found")
		}
		return AuthProviderView{}, errs.Internal("get auth_provider", err)
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return AuthProviderView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	icon := before.Icon
	if in.Icon != nil && *in.Icon != "" {
		icon = *in.Icon
	}
	config := before.Config
	if in.Config != nil {
		config = *in.Config
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateAuthProvider(ctx, db.UpdateAuthProviderParams{
		Label: label, Icon: icon, IsActive: isActive,
		OrderIndex: orderIdx, Config: config, ID: id,
	}); err != nil {
		return AuthProviderView{}, writeError("update auth_provider", err)
	}
	return s.getAuthProviderByID(ctx, id)
}

func (s *Service) DeleteAuthProvider(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteAuthProvider(ctx, id)
	if err != nil {
		return errs.Internal("delete auth_provider", err)
	}
	if err := rowsAffectedErr(res, "Auth provider not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getAuthProviderByID(ctx context.Context, id string) (AuthProviderView, error) {
	row, err := s.repo.q.GetAuthProviderByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthProviderView{}, errs.NotFound("Auth provider not found")
		}
		return AuthProviderView{}, errs.Internal("get auth_provider", err)
	}
	return AuthProviderView{
		ID: row.ID, Label: row.Label, Icon: row.Icon, IsActive: row.IsActive,
		OrderIndex: row.OrderIndex, Config: row.Config,
	}, nil
}

// ---------- top_nav_items ----------

func (s *Service) ListTopNavItems(active *bool) ([]TopNavItemView, error) {
	rows, err := s.repo.q.ListTopNavItems(context.Background(), activeToTopNavItemsParams(active))
	if err != nil {
		return nil, errs.Internal("list top_nav_items", err)
	}
	out := make([]TopNavItemView, 0, len(rows))
	for _, r := range rows {
		out = append(out, TopNavItemView{
			ID: r.ID, Label: r.Label, Path: r.Path, Icon: nullStrPtr(r.Icon),
			IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreateTopNavItem(ctx context.Context, in CreateTopNavItemInput) (TopNavItemView, error) {
	if strings.TrimSpace(in.Label) == "" {
		return TopNavItemView{}, errs.BadRequest("label is required")
	}
	if err := assertSafeNavPath(in.Path); err != nil {
		return TopNavItemView{}, err
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateTopNavItem(ctx, db.CreateTopNavItemParams{
		ID: id, Label: in.Label, Path: in.Path,
		Icon: nullStrFromPtr(in.Icon), IsActive: isActive, OrderIndex: orderIdx,
	})
	if err != nil {
		return TopNavItemView{}, writeError("create top_nav_item", err)
	}
	return s.getTopNavItemByID(ctx, id)
}

func (s *Service) UpdateTopNavItem(ctx context.Context, id string, in UpdateTopNavItemInput) (TopNavItemView, error) {
	before, err := s.repo.q.GetTopNavItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TopNavItemView{}, errs.NotFound("Top nav item not found")
		}
		return TopNavItemView{}, errs.Internal("get top_nav_item", err)
	}
	label := before.Label
	if in.Label != nil {
		if strings.TrimSpace(*in.Label) == "" {
			return TopNavItemView{}, errs.BadRequest("label cannot be empty")
		}
		label = *in.Label
	}
	path := before.Path
	if in.Path != nil {
		if err := assertSafeNavPath(*in.Path); err != nil {
			return TopNavItemView{}, err
		}
		path = *in.Path
	}
	icon := before.Icon
	if in.Icon != nil {
		if *in.Icon == "" {
			icon = sql.NullString{}
		} else {
			icon = sql.NullString{String: *in.Icon, Valid: true}
		}
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateTopNavItem(ctx, db.UpdateTopNavItemParams{
		Label: label, Path: path, Icon: icon, IsActive: isActive, OrderIndex: orderIdx, ID: id,
	}); err != nil {
		return TopNavItemView{}, writeError("update top_nav_item", err)
	}
	return s.getTopNavItemByID(ctx, id)
}

func (s *Service) DeleteTopNavItem(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteTopNavItem(ctx, id)
	if err != nil {
		return errs.Internal("delete top_nav_item", err)
	}
	if err := rowsAffectedErr(res, "Top nav item not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getTopNavItemByID(ctx context.Context, id string) (TopNavItemView, error) {
	row, err := s.repo.q.GetTopNavItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TopNavItemView{}, errs.NotFound("Top nav item not found")
		}
		return TopNavItemView{}, errs.Internal("get top_nav_item", err)
	}
	return TopNavItemView{
		ID: row.ID, Label: row.Label, Path: row.Path, Icon: nullStrPtr(row.Icon),
		IsActive: row.IsActive, OrderIndex: row.OrderIndex,
	}, nil
}

// ---------- footer_columns ----------

func (s *Service) ListFooterColumns(active *bool) ([]FooterColumnView, error) {
	rows, err := s.repo.q.ListFooterColumns(context.Background(), activeToFooterColumnsParams(active))
	if err != nil {
		return nil, errs.Internal("list footer_columns", err)
	}
	out := make([]FooterColumnView, 0, len(rows))
	for _, r := range rows {
		out = append(out, FooterColumnView{
			ID: r.ID, Title: r.Title, Links: r.Links, IsActive: r.IsActive, OrderIndex: r.OrderIndex,
		})
	}
	return out, nil
}

func (s *Service) CreateFooterColumn(ctx context.Context, in CreateFooterColumnInput) (FooterColumnView, error) {
	if strings.TrimSpace(in.Title) == "" {
		return FooterColumnView{}, errs.BadRequest("title is required")
	}
	if err := assertSafeNavPathArray(in.Links); err != nil {
		return FooterColumnView{}, err
	}
	id := "c" + strings.ReplaceAll(uuid.NewString(), "-", "")[:24]
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := int32(0)
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	_, err := s.repo.q.CreateFooterColumn(ctx, db.CreateFooterColumnParams{
		ID: id, Title: in.Title, Links: in.Links, IsActive: isActive, OrderIndex: orderIdx,
	})
	if err != nil {
		return FooterColumnView{}, writeError("create footer_column", err)
	}
	return s.getFooterColumnByID(ctx, id)
}

func (s *Service) UpdateFooterColumn(ctx context.Context, id string, in UpdateFooterColumnInput) (FooterColumnView, error) {
	before, err := s.repo.q.GetFooterColumnByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return FooterColumnView{}, errs.NotFound("Footer column not found")
		}
		return FooterColumnView{}, errs.Internal("get footer_column", err)
	}
	title := before.Title
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			return FooterColumnView{}, errs.BadRequest("title cannot be empty")
		}
		title = *in.Title
	}
	links := before.Links
	if in.Links != nil {
		if err := assertSafeNavPathArray(*in.Links); err != nil {
			return FooterColumnView{}, err
		}
		links = *in.Links
	}
	isActive := before.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	orderIdx := before.OrderIndex
	if in.OrderIndex != nil {
		orderIdx = *in.OrderIndex
	}
	if err := s.repo.q.UpdateFooterColumn(ctx, db.UpdateFooterColumnParams{
		Title: title, Links: links, IsActive: isActive, OrderIndex: orderIdx, ID: id,
	}); err != nil {
		return FooterColumnView{}, writeError("update footer_column", err)
	}
	return s.getFooterColumnByID(ctx, id)
}

func (s *Service) DeleteFooterColumn(ctx context.Context, id string) error {
	res, err := s.repo.q.DeleteFooterColumn(ctx, id)
	if err != nil {
		return errs.Internal("delete footer_column", err)
	}
	if err := rowsAffectedErr(res, "Footer column not found"); err != nil {
		return err
	}
	return nil
}

func (s *Service) getFooterColumnByID(ctx context.Context, id string) (FooterColumnView, error) {
	row, err := s.repo.q.GetFooterColumnByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return FooterColumnView{}, errs.NotFound("Footer column not found")
		}
		return FooterColumnView{}, errs.Internal("get footer_column", err)
	}
	return FooterColumnView{
		ID: row.ID, Title: row.Title, Links: row.Links, IsActive: row.IsActive, OrderIndex: row.OrderIndex,
	}, nil
}

// =============================================================
// Sitemap service method
// =============================================================

// SitemapURL is a single <url> entry in the XML output.
type SitemapURL struct {
	Loc        string
	Lastmod    *time.Time
	Changefreq string
	Priority   float64
}

// SitemapXML is the rendered XML document.
type SitemapXML struct {
	BaseURL string
	URLs    []SitemapURL
}

// GetSitemap returns the sitemap URL set + base URL for the renderer.
//
// baseURL is read from SITE_URL / PUBLIC_URL env (mirrors the NestJS
// behavior). If neither is set we default to http://localhost so the
// dev / e2e harness produces a valid (but absolute-anchored) document.
func (s *Service) GetSitemap(ctx context.Context) (SitemapXML, error) {
	base := strings.TrimRight(envOr("SITE_URL", envOr("PUBLIC_URL", "http://localhost")), "/")

	staticPages := []SitemapURL{
		{Loc: base + "/", Priority: 1.0, Changefreq: "daily"},
		{Loc: base + "/courses", Priority: 0.9, Changefreq: "daily"},
		{Loc: base + "/degrees", Priority: 0.9, Changefreq: "daily"},
		{Loc: base + "/hackathons", Priority: 0.9, Changefreq: "daily"},
		{Loc: base + "/enterprise", Priority: 0.8, Changefreq: "weekly"},
		{Loc: base + "/search", Priority: 0.5, Changefreq: "monthly"},
	}

	urls := make([]SitemapURL, 0, len(staticPages)+1700)
	urls = append(urls, staticPages...)

	// Courses.
	crs, err := s.repo.q.ListPublishedCoursesForSitemap(ctx)
	if err != nil {
		return SitemapXML{}, errs.Internal("list courses sitemap", err)
	}
	for _, r := range crs {
		t := r.UpdatedAt
		urls = append(urls, SitemapURL{
			Loc: base + "/courses/" + r.ID, Lastmod: &t,
			Changefreq: "weekly", Priority: 0.8,
		})
	}

	// Degrees.
	dgs, err := s.repo.q.ListPublishedDegreesForSitemap(ctx)
	if err != nil {
		return SitemapXML{}, errs.Internal("list degrees sitemap", err)
	}
	for _, r := range dgs {
		t := r.UpdatedAt
		urls = append(urls, SitemapURL{
			Loc: base + "/degrees/" + r.ID, Lastmod: &t,
			Changefreq: "weekly", Priority: 0.8,
		})
	}

	// Hackathons.
	hks, err := s.repo.q.ListPublicHackathonsForSitemap(ctx)
	if err != nil {
		return SitemapXML{}, errs.Internal("list hackathons sitemap", err)
	}
	for _, r := range hks {
		t := r.UpdatedAt
		urls = append(urls, SitemapURL{
			Loc: base + "/hackathons/" + r.ID, Lastmod: &t,
			Changefreq: "daily", Priority: 0.7,
		})
	}

	return SitemapXML{BaseURL: base, URLs: urls}, nil
}

// =============================================================
// Tiny helpers
// =============================================================

func activeToIndustriesParams(active *bool) db.ListIndustriesParams {
	if active == nil {
		return db.ListIndustriesParams{}
	}
	return db.ListIndustriesParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToEnterpriseMethodsParams(active *bool) db.ListEnterpriseMethodsParams {
	if active == nil {
		return db.ListEnterpriseMethodsParams{}
	}
	return db.ListEnterpriseMethodsParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToTestimonialsParams(active *bool) db.ListTestimonialsParams {
	if active == nil {
		return db.ListTestimonialsParams{}
	}
	return db.ListTestimonialsParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToCourseCategoriesParams(active *bool) db.ListCourseCategoriesParams {
	if active == nil {
		return db.ListCourseCategoriesParams{}
	}
	return db.ListCourseCategoriesParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToPopularSearchesParams(active *bool) db.ListPopularSearchesParams {
	if active == nil {
		return db.ListPopularSearchesParams{}
	}
	return db.ListPopularSearchesParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToTopNavItemsParams(active *bool) db.ListTopNavItemsParams {
	if active == nil {
		return db.ListTopNavItemsParams{}
	}
	return db.ListTopNavItemsParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func activeToFooterColumnsParams(active *bool) db.ListFooterColumnsParams {
	if active == nil {
		return db.ListFooterColumnsParams{}
	}
	return db.ListFooterColumnsParams{IsActive: sql.NullBool{Bool: *active, Valid: true}}
}

func nullStrPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func nullStrFromPtr(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

func strDeref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// rowsAffectedErr returns a 404 errs.AppError when the sql.Result
// reports zero rows were affected. MySQL drivers don't surface
// sql.ErrNoRows on a no-op DELETE / UPDATE, so we have to inspect
// RowsAffected() ourselves to keep the API contract honest.
func rowsAffectedErr(res sql.Result, notFoundMsg string) error {
	if res == nil {
		return errs.Internal("nil sql.Result", nil)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return errs.Internal("rows affected", err)
	}
	if n == 0 {
		return errs.NotFound(notFoundMsg)
	}
	return nil
}

// writeError preserves the NestJS Prisma error contract for CMS mutations.
// MySQL error 1062 is the equivalent of Prisma P2002 and must be exposed as
// HTTP 409 rather than an opaque 500. errors.As also handles driver errors
// wrapped by database or tracing layers.
func writeError(action string, err error) error {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		return errs.Conflict("Resource already exists")
	}
	return errs.Internal(action, err)
}

// assertSafeNavPath mirrors the NestJS cms-admin.dto.ts:46-61 check.
// Internal routes (start with "/") are always allowed. External URLs
// must use http/https. Anchors (#), mailto:, tel: are allowed.
// Protocol-relative ("//evil.com") is rejected.
func assertSafeNavPath(value string) error {
	if strings.TrimSpace(value) == "" {
		return errs.BadRequest("path must be a non-empty string")
	}
	p := strings.TrimSpace(value)
	if strings.HasPrefix(p, "//") {
		return errs.BadRequest("path must not be a protocol-relative URL")
	}
	if strings.HasPrefix(p, "/") {
		return nil
	}
	if matched, _ := regexpMatchHTTP(p); matched {
		return nil
	}
	if strings.HasPrefix(p, "#") {
		return nil
	}
	if strings.HasPrefix(strings.ToLower(p), "mailto:") || strings.HasPrefix(strings.ToLower(p), "tel:") {
		return nil
	}
	return errs.BadRequest(`path must start with "/", "http(s)://", "#", "mailto:", or "tel:"`)
}

// assertSafeNavPathArray is the per-link variant of assertSafeNavPath
// for footer_columns.links[].path.
func assertSafeNavPathArray(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	var links []struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(raw, &links); err != nil {
		return errs.BadRequest("links must be a JSON array of {label, path}")
	}
	for i, l := range links {
		if err := assertSafeNavPath(l.Path); err != nil {
			return errs.BadRequest(fmt.Sprintf("links[%d].%s", i, err.Error()))
		}
	}
	return nil
}

// regexpMatchHTTP is a tiny helper to avoid pulling in the regexp
// package at the top of the file just for one prefix check.
func regexpMatchHTTP(s string) (bool, error) {
	low := strings.ToLower(s)
	return strings.HasPrefix(low, "http://") || strings.HasPrefix(low, "https://"), nil
}
