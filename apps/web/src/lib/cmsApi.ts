/**
 * cmsApi — CMS content read API (frontend)
 *
 * 与 review/cms-design.md §2.1 / §2.2 对应。
 * 所有调用都返回原 shape,失败/404 → throw(由 hook 层 fallback)。
 *
 * 14 个公开 GET + 1 个 admin 用 GET:
 *   - site-settings  (批量 brand copy)
 *   - page-settings  (页面级 hero/empty/eyebrow)
 *   - app-settings   (业务规则 key-value, admin 用)
 *   - enum-translations
 *   - date-format-templates
 *   - industries, enterprise-methods, testimonials,
 *     quick-prompts, course-categories, popular-searches,
 *     hot-keywords, auth-providers, top-nav, footer-columns
 *   - i18n/messages  (key 模式 t() 翻译)
 */
import api from './api';

// =============================================================
// 类型定义(跟 prisma schema 1:1 对齐,前端不引 shared-types 避免循环)
// =============================================================

export interface SiteSetting {
  key: string;
  value: any;
  scope?: string;
  description?: string | null;
  updatedAt?: string;
}

export interface PageSetting {
  page: string;
  key: string;
  value: any;
  description?: string | null;
  updatedAt?: string;
}

export interface AppSetting {
  key: string;
  valueJson: any;
  scope?: string;
  description?: string | null;
  updatedAt?: string;
}

export interface Industry {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  methodology?: any;
  isActive: boolean;
  orderIndex: number;
}

export interface EnterpriseMethod {
  id: string;
  num: string;
  title: string;
  desc: string;
  bullets: string[];
  isActive: boolean;
  orderIndex: number;
}

export interface Testimonial {
  id: string;
  name: string;
  title: string;
  quote: string;
  avatar?: string | null;
  isActive: boolean;
  orderIndex: number;
}

export interface QuickPrompt {
  id: string;
  emoji: string;
  label: string;
  promptText: string;
  scope: string;
  isActive: boolean;
  orderIndex: number;
}

export interface CourseCategory {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  orderIndex: number;
}

export interface PopularSearch {
  id: string;
  keyword: string;
  clickCount: number;
  isActive: boolean;
  orderIndex: number;
}

export interface HotKeyword {
  id: string;
  keyword: string;
  scope: string;
  isActive: boolean;
  orderIndex: number;
}

export interface AuthProvider {
  id: string;
  label: string;
  icon: string;
  isActive: boolean;
  orderIndex: number;
  config?: any;
}

export interface TopNavItem {
  id: string;
  label: string;
  path: string;
  icon?: string | null;
  isActive: boolean;
  orderIndex: number;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: Array<{ label: string; path: string }>;
  isActive: boolean;
  orderIndex: number;
}

export interface I18nMessage {
  key: string;
  locale: string;
  value: string;
  category: string;
}

export interface EnumTranslation {
  enumType: string;
  enumValue: string;
  locale: string;
  label: string;
  colorClass?: string | null;
  icon?: string | null;
  sortOrder: number;
}

/** Sub-agent B AdminSettingsPage 用的轻量 item 形态 */
export interface EnumTranslationItem {
  value: string;
  label: string;
  colorClass?: string;
  icon?: string;
  sortOrder?: number;
}

export interface DateFormatTemplate {
  scope: string;
  locale: string;
  template: string;
}

// =============================================================
// 公共读 — site-settings
// =============================================================
export async function getSiteSettings(keys: string[]): Promise<Record<string, any>> {
  const { data } = await api.get<SiteSetting[] | Record<string, any>>(
    '/api/v1/site-settings',
    { params: keys.length > 0 ? { keys: keys.join(',') } : {} },
  );
  if (Array.isArray(data)) {
    const out: Record<string, any> = {};
    for (const s of data) out[s.key] = s.value;
    return out;
  }
  return (data as Record<string, any>) ?? {};
}

// =============================================================
// 公共读 — page-settings
// =============================================================
export async function getPageSettings(
  page: string,
  keys?: string[],
): Promise<Record<string, any>> {
  const params: Record<string, string> = { page };
  if (keys && keys.length > 0) params.keys = keys.join(',');
  const { data } = await api.get<PageSetting[] | Record<string, any>>(
    '/api/v1/page-settings',
    { params },
  );
  if (Array.isArray(data)) {
    const out: Record<string, any> = {};
    for (const s of data) out[s.key] = s.value;
    return out;
  }
  return (data as Record<string, any>) ?? {};
}

// =============================================================
// 公共读 — app-settings (业务规则 key-value)
// =============================================================
export async function getAppSettings(scope: string = 'global'): Promise<Record<string, any>> {
  const { data } = await api.get<AppSetting[] | { data: AppSetting[] } | Record<string, any>>(
    '/api/v1/app-settings',
    { params: { scope } },
  );
  if (Array.isArray(data)) {
    const out: Record<string, any> = {};
    for (const s of data) out[s.key] = s.valueJson;
    return out;
  }
  if (data && Array.isArray((data as any).data)) {
    const out: Record<string, any> = {};
    for (const s of (data as { data: AppSetting[] }).data) out[s.key] = s.valueJson;
    return out;
  }
  if (data && typeof data === 'object') {
    return data as Record<string, any>;
  }
  return {};
}

// =============================================================
// 公共读 — enum-translations
// =============================================================
export async function getEnumTranslations(
  type: string,
  locale: string = 'zh-CN',
): Promise<EnumTranslationItem[]> {
  const { data } = await api.get<EnumTranslation[] | { data: EnumTranslation[] } | EnumTranslationItem[]>(
    '/api/v1/enum-translations',
    { params: { type, locale } },
  );
  if (Array.isArray(data)) {
    return data.map((it: any) => ({
      value: it.enumValue ?? it.value,
      label: it.label,
      colorClass: it.colorClass ?? undefined,
      icon: it.icon ?? undefined,
      sortOrder: it.sortOrder,
    }));
  }
  if (data && Array.isArray((data as any).data)) {
    return (data as { data: EnumTranslation[] }).data.map((it: any) => ({
      value: it.enumValue ?? it.value,
      label: it.label,
      colorClass: it.colorClass ?? undefined,
      icon: it.icon ?? undefined,
      sortOrder: it.sortOrder,
    }));
  }
  return [];
}

// =============================================================
// 公共读 — date-format-templates
// =============================================================
export async function getDateFormats(
  scope: string,
  locale: string = 'zh-CN',
): Promise<string> {
  const { data } = await api.get<DateFormatTemplate[] | { data: DateFormatTemplate[] }>(
    '/api/v1/date-format-templates',
    { params: { scope, locale } },
  );
  const list = Array.isArray(data) ? data : (data as { data?: DateFormatTemplate[] })?.data ?? [];
  const hit = list.find((t) => t.scope === scope && t.locale === locale);
  return hit?.template ?? '';
}

// =============================================================
// 公共读 — 10 个 list resource
// =============================================================

const LIST_ENDPOINTS: Record<string, string> = {
  industries: '/api/v1/industries',
  'enterprise-methods': '/api/v1/enterprise-methods',
  testimonials: '/api/v1/testimonials',
  'quick-prompts': '/api/v1/quick-prompts',
  'course-categories': '/api/v1/course-categories',
  'popular-searches': '/api/v1/popular-searches',
  'hot-keywords': '/api/v1/hot-keywords',
  'auth-providers': '/api/v1/auth-providers',
  'top-nav': '/api/v1/top-nav',
  'footer-columns': '/api/v1/footer-columns',
  'team-sizes': '/api/v1/team-sizes',
};

export type ListResource = keyof typeof LIST_ENDPOINTS;

export async function getList<T = any>(resource: ListResource, params?: Record<string, any>): Promise<T[]> {
  const url = LIST_ENDPOINTS[resource];
  if (!url) throw new Error(`Unknown CMS list resource: ${resource}`);
  const { data } = await api.get<T[] | { data: T[] }>(url, { params });
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as { data: T[] }).data;
  return [];
}

// =============================================================
// 公共读 — i18n messages (key → value 翻译表)
// =============================================================
export interface I18nMessagesResponse {
  locale: string;
  messages: Record<string, string>;
}

export async function getI18nMessages(locale: string = 'zh-CN'): Promise<Record<string, string>> {
  const { data } = await api.get<I18nMessagesResponse | Record<string, string>>(
    '/api/v1/i18n/messages',
    { params: { locale } },
  );
  if (data && typeof data === 'object' && 'messages' in data) {
    return (data as I18nMessagesResponse).messages ?? {};
  }
  return (data as Record<string, string>) ?? {};
}
