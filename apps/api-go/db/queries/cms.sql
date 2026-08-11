-- ============================================================================
-- CMS module queries — Phase 2 T23.
--
-- 16 resource tables, ~80 admin endpoints (cms-admin.controller.ts) + 17
-- public endpoints (cms-config / cms-content / cms-enum / cms-i18n /
-- sitemap). All admin endpoints map 1:1 to {list, get, create, update,
-- delete} over a 16-resource set; the public endpoints are read-only.
--
-- Conventions:
--   - Composite-PK resources (enum_translations, date_format_templates,
--     page_settings, i18n_messages) use natural-key get/update/delete.
--   - The 12 "content" resources with a String @id (industries, …,
--     footer_columns) use plain :one and :exec queries.
--   - The 4 "config" resources (app_settings, site_settings, …) use
--     `key` as the natural primary key.
-- ============================================================================

-- =========================== app_settings ===========================

-- name: ListAppSettings :many
-- Public + admin: optionally filtered by scope.
SELECT * FROM app_settings
WHERE (sqlc.narg('scope') IS NULL OR scope = sqlc.narg('scope'))
ORDER BY `key` ASC;

-- name: GetAppSettingByKey :one
SELECT * FROM app_settings WHERE `key` = ?;

-- name: CreateAppSetting :execresult
INSERT INTO app_settings (`key`, value_json, scope, description, updated_at)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateAppSetting :exec
-- Full update by key. value_json / scope / description are coalesced so
-- the handler can read-then-merge before calling.
UPDATE app_settings
SET value_json = ?, scope = ?, description = ?, updated_at = ?
WHERE `key` = ?;

-- name: DeleteAppSetting :execresult
-- Returns sql.Result so the service can check rows affected and
-- surface 404 instead of 200 when the key doesn't exist.
DELETE FROM app_settings WHERE `key` = ?;

-- =========================== site_settings ===========================

-- name: ListSiteSettings :many
SELECT * FROM site_settings
WHERE (sqlc.narg('scope') IS NULL OR scope = sqlc.narg('scope'))
ORDER BY `key` ASC;

-- name: ListSiteSettingsByKeys :many
-- Public GET /site-settings?keys=a,b,c — batch fetch by key set.
SELECT `key`, value, scope, description, updated_at
FROM site_settings
WHERE `key` IN (sqlc.slice('keys'));

-- name: GetSiteSettingByKey :one
SELECT * FROM site_settings WHERE `key` = ?;

-- name: CreateSiteSetting :execresult
INSERT INTO site_settings (`key`, value, scope, description, updated_at)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateSiteSetting :exec
UPDATE site_settings
SET value = ?, scope = ?, description = ?, updated_at = ?
WHERE `key` = ?;

-- name: DeleteSiteSetting :execresult
DELETE FROM site_settings WHERE `key` = ?;

-- =========================== page_settings ===========================

-- name: ListPageSettings :many
SELECT * FROM page_settings
WHERE (sqlc.narg('page') IS NULL OR page = sqlc.narg('page'))
ORDER BY page ASC, `key` ASC;

-- name: ListPageSettingsByPages :many
-- Public GET /page-settings?page=home&page=courses — batch fetch.
SELECT page, `key`, value, description, updated_at
FROM page_settings
WHERE page IN (sqlc.slice('pages'));

-- name: GetPageSetting :one
SELECT * FROM page_settings WHERE page = ? AND `key` = ?;

-- name: CreatePageSetting :execresult
INSERT INTO page_settings (page, `key`, value, description, updated_at)
VALUES (?, ?, ?, ?, ?);

-- name: UpdatePageSetting :exec
UPDATE page_settings
SET value = ?, description = ?, updated_at = ?
WHERE page = ? AND `key` = ?;

-- name: DeletePageSetting :execresult
DELETE FROM page_settings WHERE page = ? AND `key` = ?;

-- =========================== enum_translations ===========================
-- Composite PK: (enum_type, enum_value, locale).
-- URL :id form is "enumType:enumValue:locale".

-- name: ListEnumTranslations :many
SELECT * FROM enum_translations
WHERE (sqlc.narg('enum_type') IS NULL OR enum_type = sqlc.narg('enum_type'))
  AND (sqlc.narg('locale') IS NULL OR locale = sqlc.narg('locale'))
ORDER BY enum_type ASC, sort_order ASC, enum_value ASC;

-- name: GetEnumTranslation :one
SELECT * FROM enum_translations
WHERE enum_type = ? AND enum_value = ? AND locale = ?;

-- name: CreateEnumTranslation :execresult
INSERT INTO enum_translations
  (enum_type, enum_value, locale, label, color_class, icon, sort_order)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateEnumTranslation :exec
UPDATE enum_translations
SET label = ?, color_class = ?, icon = ?, sort_order = ?
WHERE enum_type = ? AND enum_value = ? AND locale = ?;

-- name: DeleteEnumTranslation :execresult
DELETE FROM enum_translations
WHERE enum_type = ? AND enum_value = ? AND locale = ?;

-- =========================== date_format_templates ===========================
-- Composite PK: (scope, locale).
-- URL :id form is "scope:locale".

-- name: ListDateFormatTemplates :many
SELECT * FROM date_format_templates
WHERE (sqlc.narg('scope') IS NULL OR scope = sqlc.narg('scope'))
  AND (sqlc.narg('locale') IS NULL OR locale = sqlc.narg('locale'))
ORDER BY scope ASC, locale ASC;

-- name: GetDateFormatTemplate :one
SELECT * FROM date_format_templates WHERE scope = ? AND locale = ?;

-- name: CreateDateFormatTemplate :execresult
INSERT INTO date_format_templates (scope, locale, template) VALUES (?, ?, ?);

-- name: UpdateDateFormatTemplate :exec
UPDATE date_format_templates
SET template = ?
WHERE scope = ? AND locale = ?;

-- name: DeleteDateFormatTemplate :execresult
DELETE FROM date_format_templates WHERE scope = ? AND locale = ?;

-- =========================== industries ===========================

-- name: ListIndustries :many
SELECT * FROM industries
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetIndustryByID :one
SELECT * FROM industries WHERE id = ?;

-- name: CreateIndustry :execresult
-- Caller supplies id (cuid), created_at, updated_at.
INSERT INTO industries
  (id, `key`, label, description, icon, methodology, is_active, order_index, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateIndustry :exec
UPDATE industries
SET `key` = ?, label = ?, description = ?, icon = ?, methodology = ?,
    is_active = ?, order_index = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteIndustry :execresult
DELETE FROM industries WHERE id = ?;

-- =========================== enterprise_methods ===========================

-- name: ListEnterpriseMethods :many
SELECT * FROM enterprise_methods
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetEnterpriseMethodByID :one
SELECT * FROM enterprise_methods WHERE id = ?;

-- name: CreateEnterpriseMethod :execresult
INSERT INTO enterprise_methods
  (id, num, title, `desc`, bullets, is_active, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateEnterpriseMethod :exec
UPDATE enterprise_methods
SET num = ?, title = ?, `desc` = ?, bullets = ?,
    is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteEnterpriseMethod :execresult
DELETE FROM enterprise_methods WHERE id = ?;

-- =========================== testimonials ===========================

-- name: ListTestimonials :many
SELECT * FROM testimonials
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetTestimonialByID :one
SELECT * FROM testimonials WHERE id = ?;

-- name: CreateTestimonial :execresult
INSERT INTO testimonials
  (id, name, title, quote, avatar, is_active, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateTestimonial :exec
UPDATE testimonials
SET name = ?, title = ?, quote = ?, avatar = ?,
    is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteTestimonial :execresult
DELETE FROM testimonials WHERE id = ?;

-- =========================== quick_prompts ===========================

-- name: ListQuickPrompts :many
SELECT * FROM quick_prompts
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
  AND (sqlc.narg('scope') IS NULL OR scope = sqlc.narg('scope'))
ORDER BY order_index ASC, id ASC;

-- name: GetQuickPromptByID :one
SELECT * FROM quick_prompts WHERE id = ?;

-- name: CreateQuickPrompt :execresult
INSERT INTO quick_prompts
  (id, emoji, label, prompt_text, scope, is_active, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateQuickPrompt :exec
UPDATE quick_prompts
SET emoji = ?, label = ?, prompt_text = ?, scope = ?,
    is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteQuickPrompt :execresult
DELETE FROM quick_prompts WHERE id = ?;

-- =========================== course_categories ===========================

-- name: ListCourseCategories :many
SELECT * FROM course_categories
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetCourseCategoryByID :one
SELECT * FROM course_categories WHERE id = ?;

-- name: CreateCourseCategory :execresult
INSERT INTO course_categories
  (id, `key`, label, is_active, order_index)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateCourseCategory :exec
UPDATE course_categories
SET `key` = ?, label = ?, is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteCourseCategory :execresult
DELETE FROM course_categories WHERE id = ?;

-- =========================== popular_searches ===========================

-- name: ListPopularSearches :many
SELECT * FROM popular_searches
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetPopularSearchByID :one
SELECT * FROM popular_searches WHERE id = ?;

-- name: CreatePopularSearch :execresult
INSERT INTO popular_searches
  (id, keyword, click_count, is_active, order_index)
VALUES (?, ?, ?, ?, ?);

-- name: UpdatePopularSearch :exec
UPDATE popular_searches
SET keyword = ?, click_count = ?, is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeletePopularSearch :execresult
DELETE FROM popular_searches WHERE id = ?;

-- =========================== hot_keywords ===========================

-- name: ListHotKeywords :many
SELECT * FROM hot_keywords
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
  AND (sqlc.narg('scope') IS NULL OR scope = sqlc.narg('scope'))
ORDER BY order_index ASC, id ASC;

-- name: GetHotKeywordByID :one
SELECT * FROM hot_keywords WHERE id = ?;

-- name: CreateHotKeyword :execresult
INSERT INTO hot_keywords
  (id, keyword, scope, is_active, order_index)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateHotKeyword :exec
UPDATE hot_keywords
SET keyword = ?, scope = ?, is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteHotKeyword :execresult
DELETE FROM hot_keywords WHERE id = ?;

-- =========================== auth_providers ===========================

-- name: ListAuthProviders :many
-- Admin list (full rows, including `config` JSON).
SELECT * FROM auth_providers ORDER BY order_index ASC, id ASC;

-- name: ListAuthProvidersPublic :many
-- Public list — strips `config` to avoid leaking OAuth client_secret.
SELECT id, label, icon, is_active, order_index
FROM auth_providers
WHERE is_active = TRUE
ORDER BY order_index ASC, id ASC;

-- name: GetAuthProviderByID :one
SELECT * FROM auth_providers WHERE id = ?;

-- name: CreateAuthProvider :execresult
INSERT INTO auth_providers
  (id, label, icon, is_active, order_index, config)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateAuthProvider :exec
UPDATE auth_providers
SET label = ?, icon = ?, is_active = ?, order_index = ?, config = ?
WHERE id = ?;

-- name: DeleteAuthProvider :execresult
DELETE FROM auth_providers WHERE id = ?;

-- =========================== top_nav_items ===========================

-- name: ListTopNavItems :many
SELECT * FROM top_nav_items
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetTopNavItemByID :one
SELECT * FROM top_nav_items WHERE id = ?;

-- name: CreateTopNavItem :execresult
INSERT INTO top_nav_items
  (id, label, path, icon, is_active, order_index)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateTopNavItem :exec
UPDATE top_nav_items
SET label = ?, path = ?, icon = ?, is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteTopNavItem :execresult
DELETE FROM top_nav_items WHERE id = ?;

-- =========================== footer_columns ===========================

-- name: ListFooterColumns :many
SELECT * FROM footer_columns
WHERE (sqlc.narg('is_active') IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY order_index ASC, id ASC;

-- name: GetFooterColumnByID :one
SELECT * FROM footer_columns WHERE id = ?;

-- name: CreateFooterColumn :execresult
INSERT INTO footer_columns (id, title, links, is_active, order_index)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateFooterColumn :exec
UPDATE footer_columns
SET title = ?, links = ?, is_active = ?, order_index = ?
WHERE id = ?;

-- name: DeleteFooterColumn :execresult
DELETE FROM footer_columns WHERE id = ?;

-- =========================== i18n_messages ===========================
-- Composite PK: (key, locale).
-- URL :id form is "key:locale".

-- name: ListI18nMessages :many
SELECT * FROM i18n_messages
WHERE (sqlc.narg('locale') IS NULL OR locale = sqlc.narg('locale'))
  AND (sqlc.narg('category') IS NULL OR category = sqlc.narg('category'))
ORDER BY category ASC, `key` ASC;

-- name: GetI18nMessage :one
SELECT * FROM i18n_messages WHERE `key` = ? AND locale = ?;

-- name: CreateI18nMessage :execresult
INSERT INTO i18n_messages (`key`, locale, value, category) VALUES (?, ?, ?, ?);

-- name: UpdateI18nMessage :exec
UPDATE i18n_messages
SET value = ?, category = ?
WHERE `key` = ? AND locale = ?;

-- name: DeleteI18nMessage :execresult
DELETE FROM i18n_messages WHERE `key` = ? AND locale = ?;

-- =========================== sitemap ===========================
-- Sitemap is a public read-only endpoint over published courses /
-- degrees / hackathons. Lives in the same module so all "public CMS"
-- queries stay together.

-- name: ListPublishedCoursesForSitemap :many
SELECT id, updated_at FROM courses
WHERE status = 'published'
ORDER BY updated_at DESC
LIMIT 1000;

-- name: ListPublishedDegreesForSitemap :many
SELECT id, updated_at FROM nano_degrees
WHERE status = 'published'
ORDER BY updated_at DESC
LIMIT 500;

-- name: ListPublicHackathonsForSitemap :many
SELECT id, updated_at FROM hackathons
WHERE status IN ('upcoming', 'active', 'finished')
ORDER BY updated_at DESC
LIMIT 200;
