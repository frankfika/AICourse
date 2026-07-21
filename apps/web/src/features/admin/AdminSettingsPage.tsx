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
// Tab 4-13: 10 个 list resource 的 placeholder
// =============================================================
function ListPlaceholderTab({ title, fields }: { title: string; fields: string[] }) {
  return (
    <PlaceholderPanel
      title={title}
      description="本期不接 CRUD,只显示字段 schema,等 sub-agent A 的 admin endpoint 落地后,接 useQuery + useMutation。"
      fields={fields}
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
          <ListPlaceholderTab
            title="Industries"
            fields={['GET /api/v1/admin/cms/industries', 'POST /api/v1/admin/cms/industries', 'PATCH /api/v1/admin/cms/industries/:id', 'DELETE /api/v1/admin/cms/industries/:id', 'Schema: id, key, label, description, icon, methodology (Json), isActive, orderIndex']}
          />
        )}
        {activeTab === 'testimonials' && (
          <ListPlaceholderTab
            title="Testimonials"
            fields={['GET /api/v1/admin/cms/testimonials', 'POST /api/v1/admin/cms/testimonials', 'PATCH /api/v1/admin/cms/testimonials/:id', 'DELETE /api/v1/admin/cms/testimonials/:id', 'Schema: id, name, title, quote, avatar, isActive, orderIndex']}
          />
        )}
        {activeTab === 'enterprise_methods' && (
          <ListPlaceholderTab
            title="Enterprise Methods"
            fields={['GET /api/v1/admin/cms/enterprise-methods', 'POST /api/v1/admin/cms/enterprise-methods', 'PATCH /api/v1/admin/cms/enterprise-methods/:id', 'DELETE /api/v1/admin/cms/enterprise-methods/:id', 'Schema: id, num, title, desc, bullets (Json[]), isActive, orderIndex']}
          />
        )}
        {activeTab === 'quick_prompts' && (
          <ListPlaceholderTab
            title="Quick Prompts"
            fields={['GET /api/v1/admin/cms/quick-prompts?scope=lesson', 'POST /api/v1/admin/cms/quick-prompts', 'PATCH /api/v1/admin/cms/quick-prompts/:id', 'DELETE /api/v1/admin/cms/quick-prompts/:id', 'Schema: id, emoji, label, promptText, scope, isActive, orderIndex']}
          />
        )}
        {activeTab === 'course_categories' && (
          <ListPlaceholderTab
            title="Course Categories"
            fields={['GET /api/v1/admin/cms/course-categories', 'POST /api/v1/admin/cms/course-categories', 'PATCH /api/v1/admin/cms/course-categories/:id', 'DELETE /api/v1/admin/cms/course-categories/:id', 'Schema: id, key, label, isActive, orderIndex']}
          />
        )}
        {activeTab === 'searches' && (
          <ListPlaceholderTab
            title="Popular Searches + Hot Keywords"
            fields={['popular_searches: id, keyword, clickCount, isActive, orderIndex', 'hot_keywords: id, keyword, scope, isActive, orderIndex', '两个 endpoint,合并显示']}
          />
        )}
        {activeTab === 'auth_providers' && (
          <ListPlaceholderTab
            title="Auth Providers"
            fields={['GET /api/v1/admin/cms/auth-providers', 'POST /api/v1/admin/cms/auth-providers', 'PATCH /api/v1/admin/cms/auth-providers/:id', 'DELETE /api/v1/admin/cms/auth-providers/:id', 'Schema: id (string), label, icon, isActive, orderIndex, config (Json)']}
          />
        )}
        {activeTab === 'navigation' && (
          <ListPlaceholderTab
            title="Top Nav + Footer Columns"
            fields={['top_nav_items: id, label, path, icon, isActive, orderIndex', 'footer_columns: id, title, links (Json[]), isActive, orderIndex', '两个 endpoint,合并显示']}
          />
        )}
        {activeTab === 'i18n' && (
          <ListPlaceholderTab
            title="i18n Messages"
            fields={['GET /api/v1/admin/cms/i18n/messages?locale=zh-CN', 'POST /api/v1/admin/cms/i18n/messages', 'PATCH /api/v1/admin/cms/i18n/messages/:id', 'DELETE /api/v1/admin/cms/i18n/messages/:id', 'Schema: key, locale, value, category']}
          />
        )}
        {activeTab === 'date_formats' && (
          <ListPlaceholderTab
            title="Date Format Templates"
            fields={['GET /api/v1/admin/cms/date-format-templates', 'POST /api/v1/admin/cms/date-format-templates', 'PATCH /api/v1/admin/cms/date-format-templates/:id', 'DELETE /api/v1/admin/cms/date-format-templates/:id', 'Schema: scope, locale, template']}
          />
        )}
      </div>
    </div>
  );
}
