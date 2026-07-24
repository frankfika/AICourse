/**
 * cms.ts — CMS 内容 hooks (frontend)
 *
 * 所有 hook 必须 fallback 到原硬编码值(从 cms-audit-*.md 抄),
 * 这样: 后端未上线 / API 404 / 网络错误 时页面不白屏,跟改造前视觉一致。
 *
 * 5 个 hook:
 *   - useSiteSettings(keys)        — site_settings.brand.* (key-value)
 *   - usePageSettings(page, keys?) — page_settings.<page>.*
 *   - useList(resource)            — 10 个 list resource
 *   - useEnum(enumType)            — enum_translations (enums, etc.)
 *   - useI18n(locale?)             — i18n_messages.t(key, fallback)
 *
 * fallback 数据来源(本文件末尾的 FALLBACK_* 常量):
 *   - review/cms-audit-marketing.md §1 P0/P1 (14+27 条)
 *   - review/cms-audit-lists.md §1 P0 (9 个列表)
 *   - review/cms-audit-labels.md §2 P2 i18n (30+ 通用文案)
 */
import { useQuery } from '@tanstack/react-query';
import {
  getSiteSettings,
  getPageSettings,
  getList,
  getI18nMessages,
  getEnumTranslations,
  type ListResource,
  type EnumTranslationItem,
} from './cmsApi';

// =============================================================
// 1) useSiteSettings — 全局品牌文案
// =============================================================
export function useSiteSettings(keys: string[]) {
  return useQuery({
    queryKey: ['cms', 'site-settings', keys.slice().sort().join(',')],
    queryFn: () => getSiteSettings(keys),
    staleTime: 5 * 60_000,
    retry: 0,
    // 重要: 不要 throw — hook 永远返 (data | undefined),让 fallback 逻辑在组件里跑
  });
}

// =============================================================
// 2) usePageSettings — 页面级文案
// =============================================================
export function usePageSettings(page: string, keys?: string[]) {
  return useQuery({
    queryKey: ['cms', 'page-settings', page, keys ? keys.slice().sort().join(',') : '*'],
    queryFn: () => getPageSettings(page, keys),
    staleTime: 5 * 60_000,
    retry: 0,
  });
}

// =============================================================
// 3) useList — 10 个 list resource
// =============================================================
export function useList<T = any>(resource: ListResource) {
  return useQuery<T[]>({
    queryKey: ['cms', 'list', resource],
    queryFn: () => getList<T>(resource),
    staleTime: 5 * 60_000,
    retry: 0,
  });
}

// =============================================================
// 4) useEnum — 枚举 i18n(label + color + icon)
//    注: enum mapping 整体交给 Sub-agent B 接管,这里只暴露 stub
//    避免我多此一举;但是 auth-providers 等结构化 list 走 useList.
// =============================================================
export interface EnumItem {
  value: string;
  label: string;
  colorClass?: string;
  icon?: string;
  sortOrder?: number;
}
export function useEnum(enumType: string, locale: string = 'zh-CN') {
  // Sub-agent B 接管: 走 enum-translations API + fallback
  // API 失败/数据缺失时,getLabel/getColor/getIcon 自动用 __FALLBACK_ENUMS__ 兜底
  const query = useQuery<EnumTranslationItem[]>({
    queryKey: ['cms', 'enum', enumType, locale],
    queryFn: () => getEnumTranslations(enumType, locale),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const apiItems = query.data;
  const fallbackList = __FALLBACK_ENUMS__[enumType] ?? [];
  // API 返回非空 → 用 API;否则用 fallback
  const effective: EnumItem[] =
    apiItems && apiItems.length > 0 ? (apiItems as EnumItem[]) : fallbackList;
  // 仍然保留一份 fallback map(给 API 缺某个 value 时用)
  const fallbackMap = new Map(fallbackList.map((it) => [it.value, it]));
  return {
    data: query.data,
    isLoading: query.isLoading,
    getLabel: (value: string): string => {
      const fromApi = effective.find((it) => it.value === value);
      if (fromApi) return fromApi.label;
      return fallbackMap.get(value)?.label ?? value;
    },
    getColor: (value: string): string | undefined => {
      const fromApi = effective.find((it) => it.value === value);
      if (fromApi?.colorClass) return fromApi.colorClass;
      return fallbackMap.get(value)?.colorClass;
    },
    getIcon: (value: string): string | undefined => {
      const fromApi = effective.find((it) => it.value === value);
      if (fromApi?.icon) return fromApi.icon;
      return fallbackMap.get(value)?.icon;
    },
  };
}

// =============================================================
// __FALLBACK_ENUMS__ — Sub-agent B 用的 fallback enum 表
// (跟 AdminSettingsPage 的 import 保持一致)
// key 是 enumType, value 是 EnumItem[]
// =============================================================
export const __FALLBACK_ENUMS__: Record<string, EnumItem[]> = {
  course_level: [
    { value: 'Beginner', label: '入门', sortOrder: 0 },
    { value: 'Intermediate', label: '进阶', sortOrder: 1 },
    { value: 'Advanced', label: '高级', sortOrder: 2 },
    { value: 'Expert', label: '专家', sortOrder: 3 },
  ],
  cost_type: [
    { value: 'free', label: '免费', colorClass: 'bg-success-100 text-success-500', sortOrder: 0 },
    { value: 'paid', label: '付费', colorClass: 'bg-xp-100 text-xp-500', sortOrder: 1 },
    { value: 'charity', label: '公益', colorClass: 'bg-warning-100 text-warning-500', sortOrder: 2 },
  ],
  course_status: [
    { value: 'draft', label: '草稿', colorClass: 'bg-neutral-100 text-neutral-600', sortOrder: 0 },
    { value: 'published', label: '已发布', colorClass: 'bg-success-100 text-success-500', sortOrder: 1 },
    { value: 'archived', label: '已下架', colorClass: 'bg-neutral-100 text-neutral-600', sortOrder: 2 },
  ],
  course_type: [
    { value: 'own', label: '自有', sortOrder: 0 },
    { value: 'partner', label: '合作', sortOrder: 1 },
    { value: 'public', label: '公开', sortOrder: 2 },
    { value: 'third_party', label: '第三方', sortOrder: 3 },
  ],
  order_status: [
    { value: 'pending', label: '待支付', colorClass: 'bg-warning-100 text-warning-500', icon: 'Clock', sortOrder: 0 },
    { value: 'paid', label: '已支付', colorClass: 'bg-info-100 text-info-500', icon: 'CheckCircle2', sortOrder: 1 },
    { value: 'completed', label: '已完成', colorClass: 'bg-success-100 text-success-500', icon: 'CheckCircle2', sortOrder: 2 },
    { value: 'failed', label: '失败', colorClass: 'bg-danger-100 text-danger-500', icon: 'XCircle', sortOrder: 3 },
    { value: 'refunded', label: '已退款', colorClass: 'bg-neutral-100 text-neutral-600', icon: 'RotateCcw', sortOrder: 4 },
    { value: 'expired', label: '已过期', colorClass: 'bg-neutral-100 text-neutral-600', icon: 'Clock', sortOrder: 5 },
  ],
  hackathon_status: [
    { value: 'upcoming', label: '报名中', colorClass: 'bg-info-100 text-info-500', sortOrder: 0 },
    { value: 'active', label: '进行中', colorClass: 'bg-success-100 text-success-500', sortOrder: 1 },
    { value: 'judging', label: '评审中', colorClass: 'bg-warning-100 text-warning-500', sortOrder: 2 },
    { value: 'finished', label: '已结束', colorClass: 'bg-neutral-100 text-neutral-600', sortOrder: 3 },
    { value: 'cancelled', label: '已取消', colorClass: 'bg-danger-100 text-danger-500', sortOrder: 4 },
  ],
  submission_status: [
    { value: 'draft', label: '草稿', sortOrder: 0 },
    { value: 'submitted', label: '已提交', sortOrder: 1 },
    { value: 'reviewing', label: '评审中', sortOrder: 2 },
    { value: 'shortlisted', label: '入围', sortOrder: 3 },
    { value: 'winner', label: '获奖', sortOrder: 4 },
    { value: 'rejected', label: '未入围', sortOrder: 5 },
  ],
  inquiry_status: [
    { value: 'pending', label: '待处理', colorClass: 'bg-warning-100 text-warning-500', sortOrder: 0 },
    { value: 'contacted', label: '已联系', colorClass: 'bg-info-100 text-info-500', sortOrder: 1 },
    { value: 'qualified', label: '已合格', colorClass: 'bg-success-100 text-success-500', sortOrder: 2 },
    { value: 'closed', label: '已关闭', colorClass: 'bg-neutral-100 text-neutral-600', sortOrder: 3 },
    { value: 'archived', label: '已归档', colorClass: 'bg-neutral-100 text-neutral-600', sortOrder: 4 },
  ],
  user_role: [
    { value: 'student', label: '学员', colorClass: 'bg-info-100 text-info-500', sortOrder: 0 },
    { value: 'instructor', label: '讲师', colorClass: 'bg-success-100 text-success-500', sortOrder: 1 },
    { value: 'admin', label: '管理员', colorClass: 'bg-warning-100 text-warning-500', sortOrder: 2 },
    { value: 'super_admin', label: '超级管理员', colorClass: 'bg-danger-100 text-danger-500', sortOrder: 3 },
  ],
  notification_type: [
    { value: 'enrollment', label: '报名通知', icon: 'GraduationCap', sortOrder: 0 },
    { value: 'order', label: '订单通知', icon: 'ShoppingBag', sortOrder: 1 },
    { value: 'certificate', label: '证书通知', icon: 'Award', sortOrder: 2 },
    { value: 'system', label: '系统通知', icon: 'Bell', sortOrder: 3 },
  ],
  resource_type: [
    { value: 'pdf', label: 'PDF', sortOrder: 0 },
    { value: 'code', label: '代码', sortOrder: 1 },
    { value: 'link', label: '链接', sortOrder: 2 },
    { value: 'video', label: '视频', sortOrder: 3 },
    { value: 'audio', label: '音频', sortOrder: 4 },
  ],
  oauth_provider: [
    { value: 'google', label: 'Google', icon: 'Chrome', sortOrder: 0 },
    { value: 'github', label: 'GitHub', icon: 'Github', sortOrder: 1 },
    { value: 'wechat', label: '微信', icon: 'MessageCircle', sortOrder: 2 },
    { value: 'wecom', label: '企业微信', icon: 'Briefcase', sortOrder: 3 },
    { value: 'feishu', label: '飞书', icon: 'Send', sortOrder: 4 },
    { value: 'apple', label: 'Apple', icon: 'Apple', sortOrder: 5 },
  ],
  search_result_type: [
    { value: 'course', label: '课程', icon: 'BookOpen', sortOrder: 0 },
    { value: 'degree', label: '学位', icon: 'GraduationCap', sortOrder: 1 },
    { value: 'hackathon', label: '黑客松', icon: 'Trophy', sortOrder: 2 },
    { value: 'instructor', label: '讲师', icon: 'User', sortOrder: 3 },
  ],
  progress_status: [
    { value: 'not_started', label: '未开始', colorClass: 'bg-neutral-100 text-neutral-600', icon: 'Circle', sortOrder: 0 },
    { value: 'in_progress', label: '进行中', colorClass: 'bg-info-100 text-info-500', icon: 'PlayCircle', sortOrder: 1 },
    { value: 'completed', label: '已完成', colorClass: 'bg-success-100 text-success-500', icon: 'CheckCircle2', sortOrder: 2 },
  ],
};

// =============================================================
// 5) useI18n — 通用文案 (key 模式)
// 返回 { t, locale } — locale 给 useLocaleDate 等下游 hook 用
// =============================================================
export function useI18n(locale: string = 'zh-CN') {
  const { data } = useQuery<Record<string, string>>({
    queryKey: ['cms', 'i18n-messages', locale],
    queryFn: () => getI18nMessages(locale),
    staleTime: 10 * 60_000,
    retry: 0,
  });
  return {
    locale,
    t: (key: string, fallback?: string) => {
      // 优先: i18n_messages 真实翻译
      if (data && typeof data[key] === 'string') return data[key];
      // 次选: 显式传入的 fallback
      if (fallback !== undefined) return fallback;
      // 最后: 用 I18N_FALLBACK 静态表(从 cms-audit-labels.md §2 P2 抄)
      return I18N_FALLBACK[key] ?? key;
    },
  };
}

// =============================================================
// useI18n 同款但是直接传 map(给非 hook 场景: 同步函数 / 测试)
// =============================================================
export function createT(map: Record<string, string> | undefined) {
  return (key: string, fallback?: string) => {
    if (map && typeof map[key] === 'string') return map[key];
    if (fallback !== undefined) return fallback;
    return I18N_FALLBACK[key] ?? key;
  };
}

// =============================================================
// =============================================================
// FALLBACK 静态表 (从 cms-audit-*.md 抄,改 hardcode 时同步改这里)
// =============================================================
// =============================================================

// ---- site_settings.brand.* ---------------------------------
export const SITE_FALLBACK: Record<string, any> = {
  // hero
  'brand.hero.headline': {
    'zh-CN': '学完仍然不会做?\n让 AI 时代的能力\n可被看见。',
    'en-US': 'Still can\'t apply what you learn?\nMake your AI-era capabilities\nvisible.',
  },
  'brand.hero.subheadline': {
    'zh-CN':
      '课程 + 学位 + 实践项目 + 黑客松 + AI 助教 —— 一条连续的学习回路,不是又一个视频站。',
    'en-US':
      'Courses + Degrees + Practice Projects + Hackathons + AI Tutor — one continuous learning loop, not another video site.',
  },
  'brand.hero.term_default': {
    'zh-CN': '2026 夏季 · 开放报名',
    'en-US': 'Summer 2026 · Open Enrollment',
  },
  'brand.hero.cta_primary': { 'zh-CN': '免费开始', 'en-US': 'Start Free' },
  'brand.hero.cta_secondary': { 'zh-CN': '了解学位路径', 'en-US': 'Explore Degree Paths' },
  'brand.hero.badge_template': {
    'zh-CN': '{count} 场黑客松进行中',
    'en-US': '{count} hackathons live',
  },
  // auth shell
  'brand.auth.shell_headline': {
    'zh-CN': '学完仍然不会做?\n让 AI 时代的能力\n可被看见。',
    'en-US': 'Still can\'t apply what you learn?\nMake your AI-era capabilities\nvisible.',
  },
  'brand.auth.shell_sub_template': {
    'zh-CN': '{count} 名工程师、创业者、CTO 在这里把 AI 能力变成可被验证的作品。',
    'en-US':
      '{count} engineers, founders, and CTOs are here turning AI capabilities into verifiable work.',
  },
  'brand.auth.testimonial': {
    'zh-CN': {
      label: '学员故事',
      quote:
        '我以为 RAG 就是把文档塞进向量库。学完才发现 prompt 模板、reranking、citation、evaluation 才是真正决定效果的地方。AI 助教在我卡壳时直接引用课里第几节第几分几秒 —— 救了我 3 个通宵。',
      name: 'K. Chen',
      title: 'LLM 应用工程师学位',
      placeholder: '占位示例',
    },
    'en-US': {
      label: 'Student Story',
      quote:
        'I thought RAG was just stuffing documents into a vector DB. After the degree I realized prompt templates, reranking, citation, and evaluation are what really matter. The AI tutor quoted which lesson minute-second-saved me 3 all-nighters.',
      name: 'K. Chen',
      title: 'LLM Application Engineer Degree',
      placeholder: 'Placeholder Sample',
    },
  },
  // footer
  'brand.footer.tagline': {
    'zh-CN': '学完仍然不会做?让 AI 时代的能力可被看见。',
    'en-US': 'Still can\'t apply what you learn? Make your AI-era capabilities visible.',
  },
  'brand.footer.version_tag': {
    'zh-CN': 'v0.5.0 · built for AI era',
    'en-US': 'v0.5.0 · built for AI era',
  },
  'brand.footer.addresses': {
    'zh-CN': ['Beijing', 'Shanghai', 'Shenzhen'],
    'en-US': ['Beijing', 'Shanghai', 'Shenzhen'],
  },
  // nav small bits
  'brand.nav.back_home': { 'zh-CN': '返回首页', 'en-US': 'Back to Home' },
  'brand.nav.login': { 'zh-CN': '登录', 'en-US': 'Sign In' },
  // degree badge
  'brand.degree.badge': { 'zh-CN': 'Nano Degree', 'en-US': 'Nano Degree' },
  // company
  'brand.company.addresses': {
    'zh-CN': ['Beijing', 'Shanghai', 'Shenzhen'],
    'en-US': ['Beijing', 'Shanghai', 'Shenzhen'],
  },
};

// ---- page_settings.* ---------------------------------------
export const PAGE_FALLBACK: Record<string, Record<string, any>> = {
  // ---- home ----
  home: {
    courses_subhead: {
      'zh-CN': '每门课 4-8 周,学完一个可被验证的能力',
      'en-US': 'Each course takes 4-8 weeks — finish with a verifiable capability.',
    },
    degrees_subhead: {
      'zh-CN': '不是又一张证书,是可被验证的能力图谱',
      'en-US': 'Not another certificate — a verifiable capability map.',
    },
    hackathons_subhead: {
      'zh-CN': '社区、竞赛、激励 —— 让你的能力被看见',
      'en-US': 'Community, competition, recognition — make your work visible.',
    },
    aitutor_subhead: {
      'zh-CN':
        '每节课、每个项目、每个问题旁边都有它 —— 知道你在学什么,能引用你学过的内容,会用苏格拉底式反问而不只是给答案。',
      'en-US':
        'Beside every lesson, project, and question — it knows what you are learning, references what you have learned, and uses Socratic questioning instead of just giving answers.',
    },
    aitutor_chip: { 'zh-CN': '贯穿全程', 'en-US': 'Every step of the way' },
    instructors_subhead: {
      'zh-CN': '不是 PPT 复读机,是正在写代码、正在做产品的人',
      'en-US': 'Not PPT readers — people who are writing code and shipping products.',
    },
  },
  // ---- courses list ----
  courses: {
    list: {
      h1: { 'zh-CN': '课程大厅', 'en-US': 'Course Hall' },
      sub_template: {
        'zh-CN': '从 {count} 门系统化课程中找到你的下一步',
        'en-US': 'Find your next step from {count} systematic courses',
      },
      search_placeholder: {
        'zh-CN': '搜索课程 / 讲师 / 技能,如 LangChain / RAG / Agent',
        'en-US': 'Search courses / instructors / skills, e.g. LangChain / RAG / Agent',
      },
      hot_label: { 'zh-CN': '热门:', 'en-US': 'Hot:' },
      sort_label: { 'zh-CN': '排序:', 'en-US': 'Sort:' },
      empty_title: { 'zh-CN': '没有匹配的课程', 'en-US': 'No matching courses' },
      empty_title_template: {
        'zh-CN': '没找到「{query}」相关课程',
        'en-US': 'No courses match "{query}"',
      },
      empty_desc: {
        'zh-CN': '试试调整筛选条件,或清空后重新搜索',
        'en-US': 'Try adjusting filters, or clear and search again',
      },
      clear_filters: { 'zh-CN': '清除筛选', 'en-US': 'Clear filters' },
      loading: { 'zh-CN': '加载课程中...', 'en-US': 'Loading courses...' },
    },
  },
  // ---- degrees list / detail ----
  degrees: {
    list: {
      eyebrow: { 'zh-CN': '/ 02 Nano Degrees', 'en-US': '/ 02 Nano Degrees' },
      headline: { 'zh-CN': 'LEARNING\nPATHS', 'en-US': 'LEARNING\nPATHS' },
      sub: {
        'zh-CN':
          '体系化课程路径,从入门到进阶一站式打通,拿下 OpenCSG 认证学位。',
        'en-US':
          'Systematic learning paths — from beginner to advanced in one stream, with an OpenCSG-certified degree.',
      },
    },
    detail: {
      back: { 'zh-CN': 'Back To Degrees', 'en-US': 'Back To Degrees' },
      tabs: {
        overview: { 'zh-CN': '学位概览', 'en-US': 'Overview' },
        courses: { 'zh-CN': '课程', 'en-US': 'Courses' },
      },
      section_eyebrows: {
        overview: { 'zh-CN': '/ 01 Overview', 'en-US': '/ 01 Overview' },
        learn: { 'zh-CN': '/ 02 What You Will Learn', 'en-US': '/ 02 What You Will Learn' },
        coming_next: { 'zh-CN': '/ 03 Coming Next', 'en-US': '/ 03 Coming Next' },
      },
      sidebar_hours_label: { 'zh-CN': '学位时长', 'en-US': 'Duration' },
      empty_courses: {
        'zh-CN': '该学位下暂无课程',
        'en-US': 'No courses under this degree yet',
      },
    },
  },
  // ---- hackathons ----
  hackathons: {
    list: {
      eyebrow: { 'zh-CN': '/ Hackathons', 'en-US': '/ Hackathons' },
      headline: { 'zh-CN': 'BUILD.\nSHIP.\nWIN.', 'en-US': 'BUILD.\nSHIP.\nWIN.' },
      sub: {
        'zh-CN':
          '加入开放式创新挑战赛,与社区一起构建 AI 与大模型应用,在限定时间内交付可演示的解决方案。',
        'en-US':
          'Join open innovation challenges — build AI and LLM applications with the community, shipping demo-ready solutions within a time-box.',
      },
      empty_eyebrow: { 'zh-CN': '/ 404', 'en-US': '/ 404' },
      empty_title: { 'zh-CN': '没有找到符合条件的黑客松', 'en-US': 'No hackathons match your filters' },
    },
    detail: {
      back: { 'zh-CN': 'Back To Hackathons', 'en-US': 'Back To Hackathons' },
      countdown_template: {
        'zh-CN': '还有 {days} 天开始',
        'en-US': '{days} days to start',
      },
      panel_label_desc: { 'zh-CN': '01 / Description', 'en-US': '01 / Description' },
      panel_label_rules: { 'zh-CN': '02 / Rules', 'en-US': '02 / Rules' },
      empty_judges: { 'zh-CN': '评委待定', 'en-US': 'Judges TBD' },
    },
  },
  // ---- enterprise ----
  enterprise: {
    hero: {
      eyebrow: { 'zh-CN': '/ Enterprise Training', 'en-US': '/ Enterprise Training' },
      headline: {
        'zh-CN': 'Build\nYour\nAI Team.',
        'en-US': 'Build\nYour\nAI Team.',
      },
      sub: {
        'zh-CN':
          '1v1 咨询 + 定制化课程路径。从战略对齐到实战交付,我们与你的团队并肩作战,把 AI 真正变成生产力。',
        'en-US':
          '1v1 consulting + custom course paths. From strategic alignment to real-world delivery — we work alongside your team to turn AI into productivity.',
      },
      cta_primary: { 'zh-CN': 'Book 1v1 Consultation', 'en-US': 'Book 1v1 Consultation' },
      cta_secondary: { 'zh-CN': 'View Cases', 'en-US': 'View Cases' },
    },
    inquiry: {
      eyebrow: { 'zh-CN': 'Get In Touch', 'en-US': 'Get In Touch' },
      headline: {
        'zh-CN': 'Start\nThe\nConversation',
        'en-US': 'Start\nThe\nConversation',
      },
      sub: {
        'zh-CN':
          '填写右侧表单,我们的解决方案顾问会在 1 个工作日内联系你,提供 1v1 定制咨询。',
        'en-US':
          'Fill the form — our solution consultant will reach out within 1 business day for a 1v1 custom consultation.',
      },
    },
  },
  // ---- auth pages (login / register / bindings) ----
  auth: {
    tab_login: { 'zh-CN': '登录', 'en-US': 'Sign In' },
    tab_register: { 'zh-CN': '注册', 'en-US': 'Sign Up' },
    h1_login: { 'zh-CN': '欢迎回来', 'en-US': 'Welcome back' },
    sub_login: { 'zh-CN': '继续你的 AI 时代学习路径', 'en-US': 'Continue your AI-era learning path' },
    h1_register: { 'zh-CN': '创建账号', 'en-US': 'Create account' },
    sub_register: { 'zh-CN': '注册后立即开始学习 AI 课程', 'en-US': 'Start learning AI courses right after sign up' },
    h1_bindings: { 'zh-CN': '绑定第三方账号,登录更便捷', 'en-US': 'Bind third-party accounts for easier sign-in' },
  },
  // ---- dashboard layout / pages ----
  dashboard: {
    layout: {
      my_learning: { 'zh-CN': '我的学习 · 继续上次', 'en-US': 'My learning · Pick up where you left off' },
      no_enrollment: { 'zh-CN': '选课开始学习', 'en-US': 'Enroll to start learning' },
      learning_center: { 'zh-CN': '学习中心', 'en-US': 'Learning Center' },
    },
    ai: {
      not_ready_label: { 'zh-CN': '尚未接入 · 等待 chat module', 'en-US': 'Not yet connected — waiting for chat module' },
      input_placeholder: { 'zh-CN': '问 AI 助教... (Shift+Enter 换行)', 'en-US': 'Ask AI Tutor... (Shift+Enter for newline)' },
    },
  },
  // ---- purchase modal ----
  purchase: {
    confirm_title_template: {
      'zh-CN': '{isFree, select, free {确认报名} other {确认下单}}',
      'en-US': '{isFree, select, free {Confirm enrollment} other {Confirm order}}',
    },
    confirm_desc_template: {
      'zh-CN':
        '{isFree, select, free {该内容免费,注册后即可开始学习} other {请确认订单信息,支付后立即开通学习权限}}',
      'en-US':
        '{isFree, select, free {This content is free — start learning after sign up} other {Confirm your order — access unlocks right after payment}}',
    },
    success_title_template: {
      'zh-CN': '{isFree, select, free {报名成功} other {支付成功}}',
      'en-US': '{isFree, select, free {Enrolled} other {Payment successful}}',
    },
    success_desc_template: {
      'zh-CN':
        '{type, select, degree {已同步开通学位下所有课程,立即开始学习吧} other {课程已开通,去个人中心开始学习吧}}',
      'en-US':
        '{type, select, degree {All courses under this degree are now unlocked — start learning now} other {Course is unlocked — go to your profile to start learning}}',
    },
    go_learn: { 'zh-CN': '开始学习', 'en-US': 'Start Learning' },
    pay_now: { 'zh-CN': '立即支付', 'en-US': 'Pay Now' },
    enroll_now: { 'zh-CN': '立即报名', 'en-US': 'Enroll Now' },
  },
};

// ---- list fallback (9 个 P0 + 1 个 P1 enterprise-methods) ----
export const LIST_FALLBACK: Record<ListResource, any[]> = {
  industries: [
    { key: 'fintech', label: '金融 / Fintech', description: '风控、量化、智能客服' },
    { key: 'retail', label: '电商 / Retail', description: '推荐系统、搜索、营销' },
    { key: 'manufacturing', label: '制造 / Manufacturing', description: '质检、排产、预测维护' },
    { key: 'healthcare', label: '医疗 / Healthcare', description: '影像诊断、临床辅助' },
    { key: 'education', label: '教育 / Education', description: '个性化学习、智能评测' },
    { key: 'government', label: '政企 / Government', description: '文档处理、数据分析' },
    { key: 'auto', label: '汽车 / Auto', description: '自动驾驶、智能座舱' },
    { key: 'media', label: '媒体 / Media', description: '内容生成、推荐分发' },
  ],
  'enterprise-methods': [
    {
      num: '01',
      icon: 'Target',
      title: '战略对齐',
      desc: '深入理解业务目标与团队现状,识别 AI 应用的高价值场景,输出定制化能力地图。',
      bullets: ['业务场景调研', 'AI 能力评估', 'ROI 测算', '实施路线图'],
    },
    {
      num: '02',
      icon: 'GraduationCap',
      title: '路径设计',
      desc: '基于岗位与职级,定制从入门到专家的培养路径,理论与实战项目深度结合。',
      bullets: ['岗位能力模型', '课程组合设计', '实战项目选题', '考核评估机制'],
    },
    {
      num: '03',
      icon: 'Briefcase',
      title: '实战交付',
      desc: '用真实业务问题驱动学习,导师全程陪跑,交付可量化的业务成果。',
      bullets: ['1v1 导师陪跑', '项目代码评审', '业务指标达成', '长期社区支持'],
    },
  ],
  testimonials: [
    {
      name: 'K. Chen',
      title: 'LLM 应用工程师学位 · 占位示例',
      quote:
        '我以为 RAG 就是把文档塞进向量库。学完才发现 prompt 模板、reranking、citation、evaluation 才是真正决定效果的地方。AI 助教在我卡壳时直接引用课里第几节第几分几秒 —— 救了我 3 个通宵。',
      avatar: 'K',
      isActive: true,
      orderIndex: 0,
    },
  ],
  'quick-prompts': [
    { emoji: '📌', label: '解释这节课', promptText: '请帮我解释这节课的核心概念', scope: 'lesson', orderIndex: 0 },
    { emoji: '💡', label: 'ReAct vs CoT', promptText: 'ReAct 和 CoT 有什么区别?用代码示例说明', scope: 'global', orderIndex: 1 },
    { emoji: '🧪', label: '给个练习', promptText: '基于本节内容给我一个动手练习', scope: 'lesson', orderIndex: 2 },
    { emoji: '🛠️', label: '这段代码怎么改', promptText: '如何优化这段代码的性能和可读性?', scope: 'lesson', orderIndex: 3 },
  ],
  'course-categories': [
    { key: 'llm_app', label: 'LLM 应用' },
    { key: 'rag', label: 'RAG / 检索' },
    { key: 'agent', label: 'Agent' },
    { key: 'mlops', label: 'MLOps / 部署' },
    { key: 'fine_tune', label: 'Fine-tuning' },
    { key: 'theory', label: '基础理论' },
  ],
  'popular-searches': [
    { keyword: 'LangChain' },
    { keyword: 'RAG' },
    { keyword: 'Agent' },
    { keyword: 'vLLM' },
  ],
  'hot-keywords': [
    { keyword: 'LangChain', scope: 'courses' },
    { keyword: 'RAG', scope: 'courses' },
    { keyword: 'Agent', scope: 'courses' },
    { keyword: 'vLLM', scope: 'courses' },
    { keyword: 'Fine-tuning', scope: 'courses' },
  ],
  'auth-providers': [
    { id: 'local', label: '本地账号', icon: 'Mail' },
    { id: 'google', label: 'Google', icon: 'Chrome' },
    { id: 'github', label: 'GitHub', icon: 'Github' },
    { id: 'wechat', label: '微信', icon: 'MessageCircle' },
    { id: 'wecom', label: '企业微信', icon: 'Briefcase' },
    { id: 'feishu', label: '飞书', icon: 'Send' },
    { id: 'apple', label: 'Apple', icon: 'Apple' },
  ],
  'top-nav': [
    { label: '课程', path: '/courses' },
    { label: '学位', path: '/degrees' },
    { label: '黑客松', path: '/hackathons' },
    { label: '企业培训', path: '/enterprise' },
  ],
  'footer-columns': [
    {
      title: '学习',
      links: [
        { label: '课程', path: '/courses' },
        { label: '学位', path: '/degrees' },
        { label: '黑客松', path: '/hackathons' },
        { label: '企业培训', path: '/enterprise' },
      ],
    },
    {
      title: '公司',
      links: [
        { label: '关于我们', path: 'https://opencsg.com' },
        { label: '企业培训', path: '/enterprise' },
        { label: '价格', path: '/courses' },
      ],
    },
    {
      title: '法律',
      links: [
        { label: '服务条款', path: '/terms' },
        { label: '隐私政策', path: '/privacy' },
        { label: 'Cookie 政策', path: '/cookies' },
        { label: '退款政策', path: '/refund' },
      ],
    },
  ],
};

// ---- i18n_messages fallback (cms-audit-labels.md §2 P2) ----
// key → fallback 中文字符串. 改文案时同步改这里.
export const I18N_FALLBACK: Record<string, string> = {
  // empty
  'course.empty.title': '暂无课程',
  'course.empty.desc': '课程正在准备中,稍后再来看看吧。',
  'degree.empty.title': '暂无学位',
  'degree.empty.desc': '学位路径正在准备中。',
  'hackathon.empty.title': '暂无黑客松',
  'hackathon.empty.desc': '下一场黑客松正在筹备中,敬请期待。',
  'order.empty.title': '还没有订单',
  'order.empty.desc': '去课程大厅选一门课开始学习吧',
  'order.empty.desc2': '你去课程大厅看看,先选一门感兴趣的吧',
  'certificate.empty.title': '还没有证书',
  'certificate.empty.desc': '完成课程后会自动生成证书',
  'notification.empty.title': '还没有通知',
  'notification.empty.desc': '新动态会显示在这里',
  'qa.empty.title': '还没有 Q&A',
  'qa.empty.desc': '本课学员提的问题会在这里,你可以点上面「Q&A」旁边的铃铛订阅',
  'team.empty.title': '还没有队伍',
  'team.empty.desc': '报名后可创建或加入队伍',
  'submission.empty.title': '还没有作品',
  'submission.empty.desc': '组队完成后可提交项目作品',
  'announcement.empty.title': '暂无公告',
  'announcement.empty.desc': '组织者发布的新公告会显示在这里',
  'lesson.notes.empty.title': '还没有笔记',
  'lesson.notes.empty.desc': '在视频任意时间点按 N 添加第一条笔记',
  'lesson.notes.hint': '在视频任意时间点按 N 添加时间戳笔记',
  'lesson.cc.empty.title': '字幕暂未提供',
  'lesson.cc.empty.desc':
    '本节字幕由讲师或社区提供,目前还没有上传。你可以先看视频或切换到「笔记」做记录。',
  'lesson.resources.empty.title': '本节暂无资源',
  'lesson.resources.empty.desc': '讲师还没上传配套资料',
  'dashboard.no_course.title': '还没有可学习的课程',
  'dashboard.no_course.desc': '先去课程大厅选一门课开始学习',
  'identity.empty.title': '还没有绑定任何登录方式',
  'identity.empty.desc': '请先绑定至少一种第三方登录方式',
  'auth.merged_hint': '已登录过 OpenCSG?系统会自动合并到你的账号',
  'auth.merged_hint.register': '已有 OpenCSG 账号?系统会自动合并到你的账号',
  // loading
  'common.loading': '加载中...',
  'common.loading.dots': '加载中…',
  'common.submitting': '提交中...',
  'common.paying': '支付中…',
  'common.paying.suffix': '支付通道待接入 · 当前为测试环境',
  // error
  'common.error.network': '网络错误,请稍后重试',
  'common.error.data_load': '数据加载失败',
  'common.error.data_load.suffix': '请稍后重试',
  'common.error.course_load': '课程数据加载失败',
  // other
  'purchase.eyebrow.enroll': '/ Enroll',
  'purchase.eyebrow.checkout': '/ Checkout',
  'purchase.field.course': '/ Course',
  'purchase.field.degree': '/ Degree',
  'purchase.label.free': 'Free',
  'purchase.label.total': 'Total',
  'purchase.label.free_zh': '免费',
  'purchase.cancel': '取消',
  'purchase.later': '稍后',
  'purchase.guest_warning': '请先登录后再购买',
  'purchase.error.fail': '操作失败',
  'dashboard.ai.placeholder': 'AI 助教暂未上线。chat module 接入后,这里会基于课程内容回答你的问题。',
  'dashboard.ai.disclaimer': 'AI 助教答复可能不准确,请参考官方文档',
  'dashboard.lesson.completing': '提交中…',
  'dashboard.lesson.completed': '已完成',
  'dashboard.lesson.complete': '标记完成',
  'dashboard.outline.progress': '课程大纲',
  'dashboard.outline.progress.detail': '共 {total} 章 · {completed} / {total} 课时已完成',
  'dashboard.notes.placeholder.label': '笔记后端 API(POST/GET /api/v1/notes)正在设计中',
  'dashboard.tab.notes': '笔记',
  'dashboard.tab.cc': '字幕',
  'dashboard.tab.resources': '资源',
  'dashboard.tab.qa': 'Q&A',
  'dashboard.points.label': '积分',
  'dashboard.ai.label': 'AI 助教',
  'dashboard.lesson.nav.prev': '上一节',
  'dashboard.lesson.nav.next': '下一节',
  'dashboard.lesson.hint': '完成本节获得积分 + 进度推进',
  // common nav
  'common.back': '返回',
  'common.next': '下一步',
  'common.cancel': '取消',
  'common.confirm': '确定',
  'common.save': '保存',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.retry': '重试',
  'common.search.placeholder': '搜索课程 / 讲师 / 技能',
  'common.search.placeholder.full': '搜索课程 / 学位 / 黑客松 / 讲师...',
  'common.search.placeholder.hackathon': '搜索黑客松...',
  'common.search.hot': '热门搜索',
  'common.search.empty.title': '没找到相关内容',
  'common.search.empty.desc': '试试其他关键词',
  // company address
  'company.address.placeholder': '电话可通过邮件联系获取',
  'company.address.line': 'OpenCSG · {cities}',
  'company.contact.form.title': '告诉我们你的需求',
  'company.contact.form.desc': '简单描述你的团队现状、痛点、想要达成的目标...',
  'company.contact.topic.placeholder': '例:LLM 应用开发 / RAG 系统 / Agent 工程化',
  'company.contact.field.name': '姓名',
  'company.contact.field.email': '邮箱',
  'company.contact.field.company': '公司',
  'company.contact.field.phone': '电话',
  'company.contact.field.team_size': '团队规模',
  'company.contact.field.topic': '培训主题',
  'company.contact.field.description': '详细描述',
  'company.contact.submit': '提交咨询',
  'company.contact.submitting': '提交中...',
  'company.contact.success.title': '收到!',
  'company.contact.success.desc': '我们的解决方案顾问会在 1 个工作日内通过邮件或电话联系你。',
  'company.contact.success.again': '再次提交 →',
  // course-level labels
  'course.level.Beginner': '入门',
  'course.level.Intermediate': '进阶',
  'course.level.Advanced': '高级',
  'course.level.Expert': '专家',
  'course.cost.free': '免费',
  'course.cost.paid': '付费',
  'course.cost.charity': '公益',
  'course.type.own': '自有',
  'course.type.partner': '合作',
  'course.type.public': '公开',
  'course.type.third_party': '第三方',
  'course.resource_type.pdf': 'PDF',
  'course.resource_type.code': '代码',
  'course.resource_type.link': '链接',
  'course.resource_type.video': '视频',
  'course.resource_type.audio': '音频',
  'duration.lt4': '4 小时以内',
  'duration.4to8': '4-8 小时',
  'duration.8to12': '8-12 小时',
  'duration.gt12': '12 小时以上',
  'sort.popular': '最热门',
  'sort.recent': '最新',
  'sort.rating': '评分',
  'rating.all': '全部',
  'rating.5': '★ 5.0',
  'rating.4': '★ 4.0+',
  'rating.3': '★ 3.0+',
  // hackathon status
  'hackathon.status.upcoming': '报名中',
  'hackathon.status.active': '进行中',
  'hackathon.status.judging': '评审中',
  'hackathon.status.finished': '已结束',
  'hackathon.status.cancelled': '已取消',
  'hackathon.tab.all': '全部',
  'hackathon.tab.upcoming': '报名中',
  'hackathon.tab.active': '进行中',
  'hackathon.tab.judging': '评审中',
  'hackathon.tab.finished': '已结束',
  'hackathon.countdown.upcoming': '距开始',
  'hackathon.countdown.active': '距截止',
  'hackathon.countdown.ended': '已结束',
  // nav
  'nav.home': '首页',
  'nav.courses': '课程',
  'nav.degrees': '学位',
  'nav.hackathons': '黑客松',
  'nav.enterprise': '企业培训',
  'nav.ai': 'AI',
  'nav.profile': '我的',
  'nav.dashboard': '学习中心',
  // auth
  'auth.back_home': '返回首页',
  'auth.title.login': '登录',
  'auth.title.register': '注册',
  'auth.placeholder.email': 'you@company.com',
  'auth.placeholder.password': '••••••••',
  'auth.placeholder.name': '你的姓名',
  'auth.placeholder.confirm': '再输入一次',
  'auth.remember_me': '7 天内自动登录(仅本设备)',
  'auth.no_account': '还没有账号?',
  'auth.have_account': '已有账号?',
  'auth.signup_link': '免费注册 →',
  'auth.signin_link': '直接登录 →',
  'auth.legal_prefix': '继续即表示你同意我们的',
  'auth.legal_and': '和',
  'auth.toast.bind_coming': '{label} 绑定即将推出, 灰度开放中',
  'auth.toast.login_coming': '{label} 登录即将推出, 灰度开放中',
  'auth.toast.signup_coming': '{label} 注册即将推出, 灰度开放中',
  'auth.toast.signin_success': '登录成功',
  'auth.toast.signup_success': '注册成功, 欢迎加入!',
  'auth.toast.signin_fail': '登录失败,请检查邮箱或密码',
  'auth.toast.signup_fail': '注册失败,请稍后再试',
  'auth.toast.unbind': '已解绑',
  'auth.toast.unbind_fail': '解绑失败',
  'auth.toast.local_primary': '本地账号是主登录,无法解绑',
  'auth.confirm.unbind': '解绑 {label} 后,你将无法再用此账号登录。确定?',
  'auth.identity.keep_one': '至少保留一种登录方式',
  'auth.identity.warning_title': '安全提醒',
  'auth.identity.warning_desc': '解绑会立即吊销对应 provider 的 refresh token。',
  'auth.bindings.path': '设置页路径:',
  'auth.bindings.count': '{count} 种 · 至少保留 1 种',
  // degree
  'degree.badge': 'Nano Degree',
  'degree.badge.free': 'Free',
  'degree.courses.label': '{count} 门课程',
  'degree.chapters.label': '{count} 章节',
  'degree.hours.label': '小时',
  'degree.eyebrow.list': '/ 02 Nano Degrees',
  'degree.headline.list': 'LEARNING\nPATHS',
  'degree.not_found': '学位不存在',
  'degree.not_found.desc': '可能链接已失效,回到学位列表看看其他选择。',
  'degree.error.load': '学位加载失败',
  'degree.error.404': '该学位不存在或已下架',
  'degree.enrolled': '已报名,继续学习',
  'degree.cta.buy': 'Buy ¥{price}',
  'degree.cta.enroll': 'Free Enroll',
  'degree.cta.login': 'Login to Enroll',
  'degree.detail.back': 'Back To Degrees',
  'degree.sidebar.hours': '学位时长',
  'degree.stats.courses': 'Courses',
  'degree.stats.chapters': 'Chapters',
  'degree.stats.learners': 'Learners',
  'degree.stats.hours': 'Hours',
  // enterprise
  'enterprise.eyebrow.hero': '/ Enterprise Training',
  'enterprise.eyebrow.method': '/ 01 Method',
  'enterprise.eyebrow.cases': '/ 02 Cases',
  'enterprise.eyebrow.inquiry': '/ 03 Inquiry',
  'enterprise.eyebrow.inquiry.short': 'Get In Touch',
  'enterprise.headline.hero': 'Build\nYour\nAI Team.',
  'enterprise.headline.method': 'How We\nWork',
  'enterprise.headline.cases': 'Trusted By',
  'enterprise.headline.inquiry': 'Start\nThe\nConversation',
  'enterprise.sub.hero':
    '1v1 咨询 + 定制化课程路径。从战略对齐到实战交付,我们与你的团队并肩作战,把 AI 真正变成生产力。',
  'enterprise.cta.primary': 'Book 1v1 Consultation',
  'enterprise.cta.secondary': 'View Cases',
  'enterprise.cases.tag': '示例 · 行业范围',
  'enterprise.cases.eyebrow_us': 'Industries We Serve',
  'enterprise.method.step': 'Step',
  // footer
  'footer.cols.learn': '学习',
  'footer.cols.company': '公司',
  'footer.cols.legal': '法律',
  'footer.brand': 'OpenCSG Academy',
  'footer.platform_name': 'OpenCSG Academy',
  'footer.copyright': '© 2026 {platform}',
  'footer.icp.pending': '· 备案号待补',
  'footer.icp.filled': '· 备案号 {icp}',
  // auth shell testimonial
  'auth.shell.testimonial.label': '学员故事 · 占位示例',
  // hackathon
  'hackathon.eyebrow.list': '/ Hackathons',
  'hackathon.headline.list': 'BUILD.\nSHIP.\nWIN.',
  'hackathon.sub.list':
    '加入开放式创新挑战赛,与社区一起构建 AI 与大模型应用,在限定时间内交付可演示的解决方案。',
  'hackathon.empty.eyebrow': '/ 404',
  'hackathon.detail.back': 'Back To Hackathons',
  'hackathon.cta.login': 'Login to Join',
  'hackathon.admin.label': 'Admin',
  'hackathon.organizer.label': 'Organizer',
  'hackathon.stat.start': 'Start',
  'hackathon.stat.end': 'End',
  'hackathon.stat.location': 'Location',
  'hackathon.stat.team_size': 'Team Size',
  'hackathon.prizes.label': 'Prizes',
  'hackathon.judges.label': 'Judges',
  'hackathon.tabs.overview': '概览',
  'hackathon.tabs.announcements': '公告',
  'hackathon.tabs.teams': '队伍',
  'hackathon.tabs.submissions': '作品',
  'hackathon.panel.desc': '01 / Description',
  'hackathon.panel.desc.title': '活动介绍',
  'hackathon.panel.rules': '02 / Rules',
  'hackathon.panel.rules.title': '比赛规则',
  'hackathon.not_found': '黑客松不存在',
  // dashboard ai
  'ai.title': 'AI 助教',
  'ai.refresh': '重新开始',
  'ai.settings': '设置',
  'ai.current_lesson': '当前: {title}',
  'ai.not_ready': '尚未接入 · 等待 chat module',
  'ai.placeholder': '问 AI 助教... (Shift+Enter 换行)',
  // hero
  'hero.badge.term_only': '{term}',
  'hero.badge.live_count': '{term} · {count} 场黑客松进行中',
  'hero.badge.fallback': '2026 夏季 · 开放报名',
  'hero.headline.line1': '学完仍然不会做?',
  'hero.headline.line2': '让 AI 时代的能力',
  'hero.headline.line3': '可被看见。',
  'hero.sub': '课程 + 学位 + 实践项目 + 黑客松 + AI 助教 —— 一条连续的学习回路,不是又一个视频站。',
  'hero.cta.primary': '免费开始',
  'hero.cta.secondary': '了解学位路径',
  'hero.cta.browse_courses': '浏览全部',
  'hero.cta.browse_degrees': '浏览全部',
  'hero.cta.all_hackathons': '全部赛事',
  'hero.cta.try_ai': '体验 AI 助教',
  'hero.cta.try_ai_sub':
    '每节课、每个项目、每个问题旁边都有它 —— 知道你在学什么,能引用你学过的内容,会用苏格拉底式反问而不只是给答案。',
  // section
  'section.courses.title': '热门课程',
  'section.courses.sub': '每门课 4-8 周,学完一个可被验证的能力',
  'section.degrees.title': '学位路径',
  'section.degrees.sub': '不是又一张证书,是可被验证的能力图谱',
  'section.hackathons.title': '黑客松进行中',
  'section.hackathons.sub': '社区、竞赛、激励 —— 让你的能力被看见',
  'section.ai.title': 'AI 助教,不在抽屉里',
  'section.ai.sub':
    '每节课、每个项目、每个问题旁边都有它 —— 知道你在学什么,能引用你学过的内容,会用苏格拉底式反问而不只是给答案。',
  'section.ai.chip': '贯穿全程',
  'section.instructors.title': '来自一线的讲师',
  'section.instructors.sub': '不是 PPT 复读机,是正在写代码、正在做产品的人',
  'section.instructors.empty.sub': '讲师信息将在课程上线后展示',
  // hackathon card
  'hackathon.live_badge': '🔴 LIVE',
  'hackathon.upcoming_badge': '即将开始',
  'hackathon.ended_badge': '已结束',
  'hackathon.countdown_chip.upcoming': '⏰',
  'hackathon.countdown_chip.active': '🔴 LIVE ·',
  'hackathon.cta.enroll': '立即报名',
  'hackathon.cta.view_more': '立即报名',
  'hackathon.cta.no_more': '暂无其他赛事',
  'hackathon.card.registrations': '{count} 人报名',
  'hackathon.card.registrations_full': '{count} 人已报名',
  // empty course card
  'course.card.browse_all': '浏览全部课程',
  'course.card.cta.trial': '立即试看',
  'course.card.default_tag': 'LLM 应用',
  'course.card.learn_more': '了解',
  // misc
  'common.empty.not_found_404': '没有找到',
  'common.units.h': '小时',
  'common.units.day': '天',
  'common.units.hour': '小时',
  'common.units.min': '分',
  'common.units.courses': '门课',
  'common.units.chapters': '章',
  'common.units.lessons': '课时',
  'common.units.learners': '学员',
  'common.product_sample': '产品示例',
  'common.sample_disclaimer': '示例对话,真实聊天登录后即可使用',
  'common.lesson_id_label': 'LESSON ·',
  // course card
  'course.card.hot': '最热门',
  'course.card.rating_default': '4.8',
  // ai chat
  'ai.chat.intro.question': '这节课的 ReAct 循环,哪一步最容易出 bug?',
  'ai.chat.intro.answer':
    '通常是"观察"那一步:Agent 拿到工具结果后,容易直接答而不是先判断要不要再调一次工具。',
  'ai.chat.intro.citation': '📎 引用:这节课 Lesson 2 · ReAct 循环',
  'ai.chat.intro.user_label': '我',
  'ai.chat.intro.ai_label': 'AI',
  // video center
  'video.open_resource': '打开',
  'video.tab.notes.count': '笔记 {count}',
  'video.tab.cc.count': '字幕 {count}',
  'video.tab.resources.count': '资源 {count}',
  'video.tab.qa.count': 'Q&A {count}',
};

// ---- 工具:用 I18N_FALLBACK 反向查(组件里没数据时,从 key 拿兜底) ----
export function pickI18n(key: string, fallback?: string): string {
  return I18N_FALLBACK[key] ?? fallback ?? key;
}

// ---- 工具:site_settings value 可能是 { zh-CN: '...' } / { columns: [...] } 形式 ----
export function pickLocalized(value: any, locale: string = 'zh-CN', fallback?: string): string {
  if (value == null) return fallback ?? '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // 优先匹配 locale,再 fallback 到 zh-CN
    if (typeof value[locale] === 'string') return value[locale];
    if (typeof value['zh-CN'] === 'string') return value['zh-CN'];
    if (typeof value['en-US'] === 'string') return value['en-US'];
  }
  return fallback ?? '';
}

/**
 * 4-arg overload: pickPage(data, key, locale, i18nResult)
 *   - data: 来自 usePageSettings 的 record
 *   - key: page_settings 的 key
 *   - locale: zh-CN / en-US
 *   - i18nResult: 已经算好的 i18n fallback(由 useI18n().t() 算出)
 *
 * 这样使用:
 *   pickPage(homePages, 'courses_subhead', 'zh-CN', t('section.courses.sub', '...'))
 *
 * 比单写一个 helper 简单: pickPage 已经处理了 "data 有 key 用 data, 否则 fallback"
 * 这里只是把 fallback 表达成已算好的字符串.
 */
export function pickPage(
  data: Record<string, any> | undefined,
  key: string,
  locale: string = 'zh-CN',
  i18nFallback?: string,
): string {
  if (data && data[key] != null) {
    const v = pickLocalized(data[key], locale);
    if (v) return v;
  }
  return i18nFallback ?? '';
}

// ---- 工具:site_settings brand.hero.* 拿 fallback 时,优先 hook.data, 再 SITE_FALLBACK, 再 inline ----
export function pickSite(
  data: Record<string, any> | undefined,
  key: string,
  locale: string = 'zh-CN',
  inline?: string,
): string {
  if (data && data[key] != null) {
    const v = pickLocalized(data[key], locale);
    if (v) return v;
  }
  const fb = SITE_FALLBACK[key];
  if (fb != null) {
    const v = pickLocalized(fb, locale);
    if (v) return v;
  }
  return inline ?? '';
}

// ---- 安全: nav / footer path 白名单 ----
//
// P0 安全加固 2026-07-23: admin 可以在 CMS 后台填任意 path, 之前直接
//   <a href={link.path}> 渲染, 一旦填了 javascript:alert(1) / data:text/html,...
//   就会变成 XSS。
//
// 这里做白名单:
//   - / 开头 (内部路由)  → 保留
//   - http(s):// 开头 (外部) → 保留
//   - 其他 (含 javascript: / data: / vbscript:) → 降级为 '#'
//
// 注意: 这只是**前端**的兜底防线。真正的安全是 admin 角色本身要可信。
// 服务端 schema 不限制 path 字段格式, 是因为 admin 是可信用户。
export function safeNavPath(path: unknown): string {
  if (typeof path !== 'string' || path.length === 0) return '#';
  const p = path.trim();
  // 协议相对 URL (//evil.com/path) — 浏览器会按当前 scheme 解析, 等于 open redirect / phishing,降级
  if (p.startsWith('//')) return '#';
  // 内部路由 (但 // 已拦,这里只剩单 / 开头的)
  if (p.startsWith('/')) return p;
  // 外部 http(s) URL
  if (/^https?:\/\//i.test(p)) return p;
  // 锚点
  if (p.startsWith('#')) return p;
  // 邮件 / tel
  if (/^(mailto|tel):/i.test(p)) return p;
  // 其他全部 (含 javascript: / data: / vbscript: / 单 / 起头但 // 已被拦) → 降级
  return '#';
}
