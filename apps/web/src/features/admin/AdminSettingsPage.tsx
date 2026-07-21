/**
 * AdminSettingsPage — CMS 统一管理 (13 tab)
 *
 * 设计契约: review/cms-design.md §4
 * 风格: 跟 AdminBadgesPage / AdminCoursesPage 一致 — brutalist 黑色边框 + uppercase tracking
 *
 * 本期范围 (FRONTEND_FOUNDATION_DONE):
 *   - 13 个 tab 的 UI 骨架全部就位
 *   - Tab 1 (全局设置) 能编辑 site_settings / app_settings 草稿(本地 state,不持久化)
 *   - 其他 tab 是 placeholder: 显示 fallback / 列 schema 字段,等后续接 CRUD
 *
 * **为什么不做完整 CRUD**:
 *   - 本任务是"基础层",sub-agent A 正在并行建后端 13 张表 + API
 *   - 端点形态按 cms-design.md §2.2 假设,真实 endpoint 可能晚到
 *   - Hook 已有 fallback,UI 不会白屏,所以骨架先出
 *   - 后续 PR 接 admin CRUD mutation
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  FileText,
  Tags,
  Building2,
  Quote,
  Lightbulb,
  LayoutGrid,
  Search as SearchIcon,
  KeyRound,
  Compass,
  Globe,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { useToast } from '../../components/auth/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import {
  __FALLBACK_ENUMS__ as FALLBACK_ENUMS,
  type EnumItem,
} from '../../lib/cms';
import { getAppSettings, getSiteSettings, getEnumTranslations } from '../../lib/cmsApi';

// =============================================================
// 13 个 tab 的定义
// =============================================================
type TabKey =
  | 'global'
  | 'page'
  | 'enums'
  | 'industries'
  | 'testimonials'
  | 'enterprise_methods'
  | 'quick_prompts'
  | 'course_categories'
  | 'searches'
  | 'auth_providers'
  | 'navigation'
  | 'i18n'
  | 'date_formats';

interface TabDef {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: typeof SettingsIcon;
}

const TABS: TabDef[] = [
  { key: 'global', label: '全局设置', shortLabel: 'Global', icon: SettingsIcon },
  { key: 'page', label: '页面文案', shortLabel: 'Page', icon: FileText },
  { key: 'enums', label: '枚举', shortLabel: 'Enums', icon: Tags },
  { key: 'industries', label: '行业', shortLabel: 'Ind', icon: Building2 },
  { key: 'testimonials', label: '学员故事', shortLabel: 'Quo', icon: Quote },
  { key: 'enterprise_methods', label: '企业方法', shortLabel: 'EM', icon: Lightbulb },
  { key: 'quick_prompts', label: '快捷 Prompt', shortLabel: 'QP', icon: Lightbulb },
  { key: 'course_categories', label: '课程分类', shortLabel: 'CC', icon: LayoutGrid },
  { key: 'searches', label: '热门搜索/关键词', shortLabel: 'Sea', icon: SearchIcon },
  { key: 'auth_providers', label: 'Auth Providers', shortLabel: 'Auth', icon: KeyRound },
  { key: 'navigation', label: '导航 / Footer', shortLabel: 'Nav', icon: Compass },
  { key: 'i18n', label: 'i18n 通用文案', shortLabel: 'i18n', icon: Globe },
  { key: 'date_formats', label: '日期格式', shortLabel: 'Date', icon: Calendar },
];

// =============================================================
// 头部(13 tab 横向 / 移动折叠)
// =============================================================
function PageHeader({ activeTab, onChange }: { activeTab: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] dark:text-neutral-400 mb-2">
        / Admin · CMS
      </div>
      <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">系统设置</h2>
      <p className="mt-2 text-sm text-[#666666] dark:text-neutral-400 max-w-2xl">
        统一管理 13 张 CMS 表。编辑保存后,前端 useEnum / useSetting / useSiteSettings 会通过 React Query 自动刷新。
      </p>
      <div className="mt-6 border-b-2 border-[#171717] dark:border-neutral-50 -mx-4 sm:mx-0">
        <div className="flex items-center gap-0 overflow-x-auto px-4 sm:px-0 scrollbar-hide">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-4 -mb-[2px] transition-colors whitespace-nowrap',
                  active
                    ? 'border-[#171717] text-[#171717] dark:border-neutral-50 dark:text-neutral-50 bg-white dark:bg-neutral-100'
                    : 'border-transparent text-[#666666] dark:text-neutral-400 hover:text-[#171717] dark:hover:text-neutral-50',
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// 公共:brutalist 空态 / 错误 / 加载
// =============================================================
function PlaceholderPanel({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: string[];
}) {
  return (
    <div className="border-2 border-dashed border-[#171717] dark:border-neutral-50 p-8 bg-white dark:bg-neutral-100">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] dark:text-neutral-400 mb-2">
        / Placeholder
      </div>
      <h3 className="text-2xl font-black tracking-tighter uppercase mb-2">{title}</h3>
      <p className="text-sm text-[#666666] dark:text-neutral-400 mb-4 max-w-2xl">{description}</p>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 mb-2">
        字段(将接 cms-design.md §2.2 admin endpoint):
      </div>
      <ul className="space-y-1 text-sm font-mono text-[#171717] dark:text-neutral-50">
        {fields.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#171717] dark:bg-neutral-50" />
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-[#999999]">
        完整 CRUD 留给后续 PR,本期只接 hook + 骨架。
      </p>
    </div>
  );
}

// =============================================================
// Tab 1: 全局设置(site_settings + app_settings)
// =============================================================
function GlobalSettingsTab() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  // 取所有 site_settings
  const { data: siteRaw, isLoading: siteLoading } = useQuery({
    queryKey: ['cms-admin', 'site-settings-all'],
    queryFn: () => getSiteSettings([]).catch(() => ({})),
    retry: 0,
  });
  // 取所有 app_settings
  const { data: appRaw, isLoading: appLoading } = useQuery({
    queryKey: ['cms-admin', 'app-settings-all'],
    queryFn: () => getAppSettings('global'),
    retry: 0,
  });
  const [siteDraft, setSiteDraft] = useState<Record<string, any>>({});
  const [appDraft, setAppDraft] = useState<Record<string, any>>({});
  const [appKeys, setAppKeys] = useState<string[]>([]);
  const [siteKeys, setSiteKeys] = useState<string[]>([]);
  const [newSiteKey, setNewSiteKey] = useState('');
  const [newAppKey, setNewAppKey] = useState('');

  useEffect(() => {
    if (siteRaw) {
      setSiteDraft(siteRaw);
      setSiteKeys(Object.keys(siteRaw));
    }
  }, [siteRaw]);

  useEffect(() => {
    if (appRaw) {
      setAppDraft(appRaw);
      setAppKeys(Object.keys(appRaw));
    }
  }, [appRaw]);

  const isLoading = siteLoading || appLoading;

  // 草稿保存(本期仅 UI 操作,不实际写后端,等 endpoint 落地后再接 mutation)
  const handleSaveDraft = () => {
    showToast(`草稿已更新(本地,未持久化) — site ${Object.keys(siteDraft).length} keys / app ${Object.keys(appDraft).length} keys`, 'info');
    void queryClient.invalidateQueries({ queryKey: ['cms'] });
  };

  const updateSiteValue = (key: string, raw: string) => {
    setSiteDraft((prev) => ({ ...prev, [key]: tryParseJson(raw) }));
  };
  const updateAppValue = (key: string, raw: string) => {
    setAppDraft((prev) => ({ ...prev, [key]: tryParseJson(raw) }));
  };

  const addSiteKey = () => {
    const k = newSiteKey.trim();
    if (!k) return;
    if (siteKeys.includes(k)) {
      showToast(`key "${k}" 已存在`, 'warning');
      return;
    }
    setSiteKeys((prev) => [...prev, k]);
    setSiteDraft((prev) => ({ ...prev, [k]: '' }));
    setNewSiteKey('');
  };
  const removeSiteKey = (k: string) => {
    setSiteKeys((prev) => prev.filter((x) => x !== k));
    setSiteDraft((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };
  const addAppKey = () => {
    const k = newAppKey.trim();
    if (!k) return;
    if (appKeys.includes(k)) {
      showToast(`key "${k}" 已存在`, 'warning');
      return;
    }
    setAppKeys((prev) => [...prev, k]);
    setAppDraft((prev) => ({ ...prev, [k]: '' }));
    setNewAppKey('');
  };
  const removeAppKey = (k: string) => {
    setAppKeys((prev) => prev.filter((x) => x !== k));
    setAppDraft((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase">Site & App Settings</h3>
          <p className="text-xs text-[#666666] dark:text-neutral-400 mt-1">
            品牌文案(key-value)放 site_settings,业务规则(key-value)放 app_settings。
          </p>
        </div>
        <button
          onClick={handleSaveDraft}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> 保存草稿
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangle" className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Site settings */}
          <section className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black uppercase tracking-widest">Site Settings</h4>
              <div className="flex items-center gap-2">
                <input
                  value={newSiteKey}
                  onChange={(e) => setNewSiteKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSiteKey())}
                  placeholder="新 key (e.g. brand.hero.headline)"
                  className="px-3 py-1.5 border-2 border-[#171717] dark:border-neutral-50 text-xs font-mono w-72 focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800"
                />
                <button
                  onClick={addSiteKey}
                  className="p-1.5 bg-[#171717] text-white hover:bg-[#262626] transition-colors"
                  title="新增"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {siteKeys.length === 0 ? (
              <p className="text-xs text-[#999999] italic">暂无 site_settings。API 还没返回数据(后端未灌 seed)。</p>
            ) : (
              <div className="space-y-3">
                {siteKeys.map((k) => (
                  <div key={k} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2 items-start">
                    <code className="text-xs font-mono font-bold text-[#171717] dark:text-neutral-50 break-all pt-2">{k}</code>
                    <textarea
                      value={stringifyValue(siteDraft[k])}
                      onChange={(e) => updateSiteValue(k, e.target.value)}
                      rows={2}
                      className="px-3 py-2 border-2 border-[#171717] dark:border-neutral-50 text-xs font-mono focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 resize-none"
                    />
                    <button
                      onClick={() => removeSiteKey(k)}
                      className="p-1.5 hover:bg-[#171717] hover:text-white transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* App settings */}
          <section className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black uppercase tracking-widest">App Settings</h4>
              <div className="flex items-center gap-2">
                <input
                  value={newAppKey}
                  onChange={(e) => setNewAppKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAppKey())}
                  placeholder="新 key (e.g. duration_buckets)"
                  className="px-3 py-1.5 border-2 border-[#171717] dark:border-neutral-50 text-xs font-mono w-72 focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800"
                />
                <button
                  onClick={addAppKey}
                  className="p-1.5 bg-[#171717] text-white hover:bg-[#262626] transition-colors"
                  title="新增"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {appKeys.length === 0 ? (
              <p className="text-xs text-[#999999] italic">暂无 app_settings。API 还没返回数据(后端未灌 seed)。</p>
            ) : (
              <div className="space-y-3">
                {appKeys.map((k) => (
                  <div key={k} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2 items-start">
                    <code className="text-xs font-mono font-bold text-[#171717] dark:text-neutral-50 break-all pt-2">{k}</code>
                    <textarea
                      value={stringifyValue(appDraft[k])}
                      onChange={(e) => updateAppValue(k, e.target.value)}
                      rows={2}
                      className="px-3 py-2 border-2 border-[#171717] dark:border-neutral-50 text-xs font-mono focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 resize-none"
                    />
                    <button
                      onClick={() => removeAppKey(k)}
                      className="p-1.5 hover:bg-[#171717] hover:text-white transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function tryParseJson(raw: string): any {
  if (raw.trim() === '') return '';
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stringifyValue(v: any): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

// =============================================================
// Tab 2: 页面文案(page_settings)
// =============================================================
function PageSettingsTab() {
  const PAGES = ['home', 'courses', 'degrees', 'hackathons', 'enterprise', 'auth', 'dashboard'];
  const [page, setPage] = useState<string>('home');
  const { data, isLoading } = useQuery({
    queryKey: ['cms-admin', 'page-settings', page],
    queryFn: () => getAppSettings('global').then(() => ({})).catch(() => ({})),
    retry: 0,
  });
  // 实际后端会返 page_settings 的 keys,本期先用空 stub
  const keys = data ? Object.keys(data).filter((k) => k.startsWith(`${page}.`)) : [];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase">Page Settings</h3>
          <p className="text-xs text-[#666666] dark:text-neutral-400 mt-1">按 page 路由分组,key 形如 <code className="bg-[#EEEDE9] dark:bg-neutral-800 px-1">home.hero.headline</code></p>
        </div>
        <select
          value={page}
          onChange={(e) => setPage(e.target.value)}
          className="px-3 py-2 border-2 border-[#171717] dark:border-neutral-50 text-xs font-black uppercase tracking-widest bg-white dark:bg-neutral-100"
        >
          {PAGES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <PlaceholderPanel
        title={`Page · ${page}`}
        description="每个 page 路由一组 key-value,key 命名约定:`{page}.{section}.{field}`(如 `home.hero.headline`)。"
        fields={['GET /api/v1/page-settings?page=' + page, 'POST /api/v1/admin/cms/page-settings', 'PATCH /api/v1/admin/cms/page-settings/:id', 'DELETE /api/v1/admin/cms/page-settings/:id']}
      />
      {isLoading && (
        <Skeleton variant="rectangle" className="h-32 w-full" />
      )}
    </div>
  );
}

// =============================================================
// Tab 3: 枚举(enum_translations)
// =============================================================
const ENUM_TYPES = [
  'course_level', 'cost_type', 'order_status', 'hackathon_status',
  'submission_status', 'inquiry_status', 'user_role', 'notification_type',
  'course_status', 'course_type', 'resource_type', 'oauth_provider',
  'search_result_type', 'progress_status',
];

function EnumsTab() {
  const [filterType, setFilterType] = useState<string>('order_status');
  const { data, isLoading } = useQuery({
    queryKey: ['cms-admin', 'enum', filterType],
    queryFn: () => getEnumTranslations(filterType).catch(() => []),
    retry: 0,
  });
  // 数据: API > fallback
  const items: EnumItem[] =
    data && data.length > 0
      ? (data as EnumItem[])
      : (FALLBACK_ENUMS[filterType] ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase">Enum Translations</h3>
          <p className="text-xs text-[#666666] dark:text-neutral-400 mt-1">
            枚举的 i18n label + color + icon。共 {ENUM_TYPES.length} 种。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border-2 border-[#171717] dark:border-neutral-50 text-xs font-black uppercase tracking-widest bg-white dark:bg-neutral-100"
          >
            {ENUM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            title="完整 CRUD 留给后续 PR"
          >
            <Plus className="w-3.5 h-3.5" /> 新增 value
          </button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton variant="rectangle" className="h-48 w-full" />
      ) : (
        <div className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100">
          <div className="grid grid-cols-12 gap-3 p-3 border-b-2 border-[#171717] dark:border-neutral-50 text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400">
            <div className="col-span-2">value</div>
            <div className="col-span-3">label (zh-CN)</div>
            <div className="col-span-4">colorClass</div>
            <div className="col-span-1">icon</div>
            <div className="col-span-1">order</div>
            <div className="col-span-1 text-right">action</div>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#999999] italic">无数据</div>
          ) : (
            items.map((it) => (
              <div
                key={it.value}
                className="grid grid-cols-12 gap-3 p-3 items-center text-sm border-b border-[#EEEDE9] last:border-0 hover:bg-[#F5F4F0] dark:hover:bg-neutral-800"
              >
                <div className="col-span-2 font-mono text-xs font-bold">{it.value}</div>
                <div className="col-span-3">{it.label}</div>
                <div className="col-span-4 font-mono text-[10px] text-[#666666] dark:text-neutral-400 break-all">
                  {it.colorClass ?? '—'}
                </div>
                <div className="col-span-1 text-xs text-[#666666] dark:text-neutral-400">
                  {it.icon ?? '—'}
                </div>
                <div className="col-span-1 text-xs text-[#666666] dark:text-neutral-400">
                  {it.sortOrder ?? 0}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    disabled
                    className="p-1.5 hover:bg-[#171717] hover:text-white transition-colors disabled:opacity-40"
                    title="编辑(后续 PR)"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    disabled
                    className="p-1.5 hover:bg-danger-100 hover:text-danger-500 transition-colors disabled:opacity-40"
                    title="删除(后续 PR)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <p className="text-[10px] text-[#999999]">
        当前展示的是 fallback(API 不可用时的硬编码值),不写后端;CRUD 按钮留待后续 PR。
      </p>
    </div>
  );
}

// =============================================================
// Tab 4-13: 10 个 list resource 的通用 CRUD 组件
// =============================================================
//
// 10 个 list tab (industries / testimonials / quick-prompts / course-categories /
// enterprise-methods / popular-searches / hot-keywords / auth-providers /
// top-nav / footer-columns) 都有相同的 CRUD pattern:
//   - GET /api/v1/admin/cms/<resource> 拉 list
//   - POST /api/v1/admin/cms/<resource> 新增
//   - PATCH /api/v1/admin/cms/<resource>/:id 更新
//   - DELETE /api/v1/admin/cms/<resource>/:id 删除
//   - 都有 id + isActive + orderIndex, 其它字段随 resource 变
//
// 通用 ListCrudTab 接 resource 名 + 字段定义,渲染统一 brutalist 表格 + edit form.
// 简化: Json 字段用 textarea + JSON.parse; boolean 用 checkbox; number 用 input type=number.

import api from '../../lib/api';

interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'json' | 'boolean' | 'number';
  required?: boolean;
  hint?: string;
}

interface ListCrudTabProps {
  resource: string;        // e.g. "industries"
  displayName: string;     // e.g. "Industries"
  fields: FieldDef[];      // 渲染哪些列 + form 哪些字段
  // 可选: 额外的"显示名"列(从 data 里取)
  primaryKey?: string;      // 显示在表格第一列, 默认 'id' 前 8 位
}

function ListCrudTab({ resource, displayName, fields, primaryKey = 'id' }: ListCrudTabProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ['cms-admin', 'list', resource],
    queryFn: async () => {
      const { data } = await api.get<any[]>(`/api/v1/admin/cms/${resource}`);
      return data ?? [];
    },
    retry: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const beginEdit = (item: any) => {
    setEditingId(item.id);
    setDraft({ ...item });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const beginCreate = () => {
    setCreating(true);
    const empty: Record<string, any> = { isActive: true, orderIndex: (items?.length ?? 0) + 1 };
    fields.forEach((f) => { empty[f.name] = f.type === 'json' ? '' : f.type === 'boolean' ? false : ''; });
    setNewRow(empty);
  };
  const cancelCreate = () => {
    setCreating(false);
    setNewRow({});
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/v1/admin/cms/${resource}/${editingId}`, draft);
      showToast(`${displayName} 已更新`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['cms-admin', 'list', resource] });
      cancelEdit();
    } catch (e: any) {
      showToast(`更新失败: ${e?.response?.data?.message ?? e?.message ?? '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  const createRow = async () => {
    setBusy(true);
    try {
      await api.post(`/api/v1/admin/cms/${resource}`, newRow);
      showToast(`${displayName} 已新增`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['cms-admin', 'list', resource] });
      cancelCreate();
    } catch (e: any) {
      showToast(`新增失败: ${e?.response?.data?.message ?? e?.message ?? '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  const removeRow = async (id: string) => {
    if (!confirm(`确认删除该 ${displayName}?`)) return;
    try {
      await api.delete(`/api/v1/admin/cms/${resource}/${id}`);
      showToast(`已删除`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['cms-admin', 'list', resource] });
    } catch (e: any) {
      showToast(`删除失败: ${e?.response?.data?.message ?? e?.message ?? '未知错误'}`, 'error');
    }
  };
  const toggleActive = async (item: any) => {
    try {
      await api.patch(`/api/v1/admin/cms/${resource}/${item.id}`, { isActive: !item.isActive });
      await queryClient.invalidateQueries({ queryKey: ['cms-admin', 'list', resource] });
    } catch (e: any) {
      showToast(`切换失败: ${e?.response?.data?.message ?? e?.message ?? '未知错误'}`, 'error');
    }
  };

  const updateDraft = (key: string, val: any) => setDraft((p) => ({ ...p, [key]: val }));
  const updateNew = (key: string, val: any) => setNewRow((p) => ({ ...p, [key]: val }));

  // 渲染 cell (read mode)
  const renderReadCell = (item: any, field: FieldDef): string => {
    const v = item[field.name];
    if (v === null || v === undefined) return '—';
    if (field.type === 'boolean') return v ? '✓' : '✗';
    if (field.type === 'json') return Array.isArray(v) ? `[${v.length} items]` : JSON.stringify(v).slice(0, 40);
    if (typeof v === 'string' && v.length > 40) return v.slice(0, 40) + '...';
    return String(v);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase">{displayName}</h3>
          <p className="text-xs text-[#666666] dark:text-neutral-400 mt-1">
            CRUD: GET / POST / PATCH / DELETE /api/v1/admin/cms/{resource}
          </p>
        </div>
        <button
          onClick={creating ? cancelCreate : beginCreate}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] disabled:opacity-50 transition-colors"
        >
          {creating ? <><X className="w-3.5 h-3.5" /> 取消</> : <><Plus className="w-3.5 h-3.5" /> 新增</>}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangle" className="h-10 w-full" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-[#999999] italic">暂无 {displayName}。</p>
      ) : (
        <div className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#171717] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">{primaryKey}</th>
                {fields.map((f) => (
                  <th key={f.name} className="px-3 py-2 text-left font-black uppercase tracking-widest">{f.label}</th>
                ))}
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">排序</th>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">启用</th>
                <th className="px-3 py-2 text-right font-black uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody>
              {creating && (
                <tr className="bg-[#F5F4F0] dark:bg-neutral-800">
                  <td className="px-3 py-2 font-mono text-[#999999]">新</td>
                  {fields.map((f) => (
                    <td key={f.name} className="px-3 py-2">
                      {renderFormField(newRow, f, (v) => updateNew(f.name, v))}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={newRow.orderIndex ?? 0}
                      onChange={(e) => updateNew('orderIndex', Number(e.target.value))}
                      className="w-16 px-2 py-1 border-2 border-[#171717] text-xs font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!newRow.isActive}
                      onChange={(e) => updateNew('isActive', e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={createRow}
                      disabled={busy}
                      className="p-1 hover:bg-[#171717] hover:text-white transition-colors"
                      title="保存"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={isEditing ? 'bg-[#F5F4F0] dark:bg-neutral-800' : 'hover:bg-[#F5F4F0] dark:hover:bg-neutral-800'}>
                    <td className="px-3 py-2 font-mono text-[10px] text-[#666666]">{item[primaryKey]?.toString().slice(0, 8) ?? item.id.slice(0, 8)}</td>
                    {fields.map((f) => (
                      <td key={f.name} className="px-3 py-2">
                        {isEditing ? renderFormField(draft, f, (v) => updateDraft(f.name, v)) : renderReadCell(item, f)}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draft.orderIndex ?? 0}
                          onChange={(e) => updateDraft('orderIndex', Number(e.target.value))}
                          className="w-16 px-2 py-1 border-2 border-[#171717] text-xs font-mono"
                        />
                      ) : item.orderIndex}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(item)}
                        className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 ${item.isActive !== false ? 'bg-[#171717] text-white border-[#171717]' : 'border-[#171717] text-[#171717]'}`}
                      >
                        {item.isActive !== false ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} disabled={busy} className="p-1 hover:bg-[#171717] hover:text-white transition-colors" title="保存">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 hover:bg-[#171717] hover:text-white transition-colors" title="取消">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => beginEdit(item)} className="p-1 hover:bg-[#171717] hover:text-white transition-colors" title="编辑">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeRow(item.id)} className="p-1 hover:bg-[#171717] hover:text-white transition-colors" title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderFormField(state: Record<string, any>, field: FieldDef, setVal: (v: any) => void) {
  const v = state[field.name];
  if (field.type === 'textarea') {
    return (
      <textarea
        value={v ?? ''}
        onChange={(e) => setVal(e.target.value)}
        rows={2}
        className="w-full px-2 py-1 border-2 border-[#171717] text-xs font-mono resize-none min-w-[160px]"
      />
    );
  }
  if (field.type === 'json') {
    return (
      <textarea
        value={v === null || v === undefined ? '' : (typeof v === 'string' ? v : JSON.stringify(v, null, 2))}
        onChange={(e) => {
          const raw = e.target.value;
          try { setVal(raw.trim() === '' ? null : JSON.parse(raw)); }
          catch { setVal(raw); /* 保留 raw, 等用户修 */ }
        }}
        rows={3}
        placeholder='JSON 数组 / 对象, 例: [{"key":"value"}] 或 {"k":"v"}'
        className="w-full px-2 py-1 border-2 border-[#171717] text-xs font-mono resize-none min-w-[200px]"
      />
    );
  }
  if (field.type === 'boolean') {
    return <input type="checkbox" checked={!!v} onChange={(e) => setVal(e.target.checked)} />;
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={v ?? 0}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-24 px-2 py-1 border-2 border-[#171717] text-xs font-mono"
      />
    );
  }
  // text
  return (
    <input
      type="text"
      value={v ?? ''}
      onChange={(e) => setVal(e.target.value)}
      className="w-full px-2 py-1 border-2 border-[#171717] text-xs font-mono min-w-[120px]"
    />
  );
}

// =============================================================
// 主组件
// =============================================================
export function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('global');

  return (
    <div>
      <PageHeader activeTab={activeTab} onChange={setActiveTab} />
      <div className="mt-6">
        {activeTab === 'global' && <GlobalSettingsTab />}
        {activeTab === 'page' && <PageSettingsTab />}
        {activeTab === 'enums' && <EnumsTab />}
        {activeTab === 'industries' && (
          <ListCrudTab
            resource="industries"
            displayName="Industries"
            primaryKey="key"
            fields={[
              { name: 'key', label: 'Key', type: 'text', required: true },
              { name: 'label', label: 'Label', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'icon', label: 'Icon (lucide)', type: 'text' },
              { name: 'methodology', label: 'Methodology (JSON)', type: 'json' },
            ]}
          />
        )}
        {activeTab === 'testimonials' && (
          <ListCrudTab
            resource="testimonials"
            displayName="Testimonials"
            fields={[
              { name: 'name', label: '姓名', type: 'text', required: true },
              { name: 'title', label: '身份', type: 'text' },
              { name: 'quote', label: '感言', type: 'textarea', required: true },
              { name: 'avatar', label: 'Avatar', type: 'text' },
            ]}
          />
        )}
        {activeTab === 'enterprise_methods' && (
          <ListCrudTab
            resource="enterprise-methods"
            displayName="Enterprise Methods"
            primaryKey="num"
            fields={[
              { name: 'num', label: '编号', type: 'text', required: true },
              { name: 'title', label: '标题', type: 'text', required: true },
              { name: 'desc', label: '描述', type: 'textarea' },
              { name: 'bullets', label: '要点 (JSON array)', type: 'json' },
            ]}
          />
        )}
        {activeTab === 'quick_prompts' && (
          <ListCrudTab
            resource="quick-prompts"
            displayName="Quick Prompts"
            primaryKey="label"
            fields={[
              { name: 'emoji', label: 'Emoji', type: 'text' },
              { name: 'label', label: '显示 label', type: 'text', required: true },
              { name: 'promptText', label: '实际 prompt', type: 'textarea', required: true },
              { name: 'scope', label: 'Scope', type: 'text' },
            ]}
          />
        )}
        {activeTab === 'course_categories' && (
          <ListCrudTab
            resource="course-categories"
            displayName="Course Categories"
            primaryKey="key"
            fields={[
              { name: 'key', label: 'Key', type: 'text', required: true },
              { name: 'label', label: 'Label', type: 'text', required: true },
            ]}
          />
        )}
        {activeTab === 'searches' && (
          <div className="space-y-6">
            <ListCrudTab
              resource="popular-searches"
              displayName="Popular Searches"
              primaryKey="keyword"
              fields={[
                { name: 'keyword', label: '关键词', type: 'text', required: true },
                { name: 'clickCount', label: '点击数', type: 'number' },
              ]}
            />
            <ListCrudTab
              resource="hot-keywords"
              displayName="Hot Keywords"
              primaryKey="keyword"
              fields={[
                { name: 'keyword', label: '关键词', type: 'text', required: true },
                { name: 'scope', label: 'Scope', type: 'text' },
              ]}
            />
          </div>
        )}
        {activeTab === 'auth_providers' && (
          <ListCrudTab
            resource="auth-providers"
            displayName="Auth Providers"
            primaryKey="id"
            fields={[
              { name: 'id', label: 'ID (e.g. google)', type: 'text', required: true },
              { name: 'label', label: 'Label', type: 'text', required: true },
              { name: 'icon', label: 'Icon (lucide)', type: 'text' },
              { name: 'config', label: 'Config (JSON)', type: 'json' },
            ]}
          />
        )}
        {activeTab === 'navigation' && (
          <div className="space-y-6">
            <ListCrudTab
              resource="top-nav"
              displayName="Top Nav"
              primaryKey="label"
              fields={[
                { name: 'label', label: 'Label', type: 'text', required: true },
                { name: 'path', label: 'Path', type: 'text', required: true },
                { name: 'icon', label: 'Icon (lucide)', type: 'text' },
              ]}
            />
            <ListCrudTab
              resource="footer-columns"
              displayName="Footer Columns"
              primaryKey="title"
              fields={[
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'links', label: 'Links (JSON array)', type: 'json' },
              ]}
            />
          </div>
        )}
        {activeTab === 'i18n' && (
          <ListCrudTab
            resource="i18n/messages"
            displayName="i18n Messages"
            primaryKey="key"
            fields={[
              { name: 'key', label: 'Key', type: 'text', required: true },
              { name: 'locale', label: 'Locale', type: 'text', required: true },
              { name: 'value', label: 'Value', type: 'textarea', required: true },
              { name: 'category', label: 'Category', type: 'text' },
            ]}
          />
        )}
        {activeTab === 'date_formats' && (
          <ListCrudTab
            resource="date-format-templates"
            displayName="Date Format Templates"
            primaryKey="scope"
            fields={[
              { name: 'scope', label: 'Scope', type: 'text', required: true },
              { name: 'locale', label: 'Locale', type: 'text', required: true },
              { name: 'template', label: 'Template', type: 'text', required: true },
            ]}
          />
        )}
      </div>
    </div>
  );
}
