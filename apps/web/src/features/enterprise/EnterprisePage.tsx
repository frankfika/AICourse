import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Seo } from '../../components/Seo';
import { useToast } from '../../components/auth/Toast';
import {
  Building2,
  ArrowUpRight,
  Check,
  Mail,
  Phone,
  User as UserIcon,
  Building,
  Target,
  Sparkles,
  Send,
  Zap,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import api from '../../lib/api';
import { useList, usePageSettings, useSiteSettings, useI18n, pickPage, pickSite, LIST_FALLBACK } from '../../lib/cms';
import { useCollapsibleHero } from '../../hooks/useCollapsibleHero';
import { cn } from '../../lib/cn';

// CMS LIST_FALLBACK['enterprise-methods'] 用 icon 字符串名 (e.g. 'Target') 表示图标,
// 这里建个 string→Component 映射表,这样 fallback 数组保持纯数据,不嵌 React component
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  GraduationCap,
  Briefcase,
};

// 复用 site/stats 的 KPI,4 个 slot 都从真实数据映射, 避免假数字
interface SiteStats {
  activeLearners: number;
  totalCourses: number;
  totalProjects: number;
  totalDegrees: number;
  activeHackathonCount: number;
  currentTermLabel: string;
}

function formatStatNumber(n: number | undefined | null): string {
  if (n == null) return '—';
  if (n >= 10000) {
    const v = n / 10000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)}万`;
  }
  if (n >= 1000) {
    return n.toLocaleString('en-US');
  }
  return n.toString();
}

interface InquiryForm {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  phone: string;
  topic: string;
  description: string;
}

const initialForm: InquiryForm = {
  name: '',
  email: '',
  company: '',
  teamSize: '1-10',
  phone: '',
  topic: '',
  description: '',
};

export function EnterprisePage() {
  const [form, setForm] = useState<InquiryForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { showToast } = useToast();

  // 公开站点统计(后端 GET /api/v1/site/stats 已就绪)
  const { data: stats } = useQuery({
    queryKey: ['site', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<SiteStats>('/api/v1/site/stats');
      return data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // CMS-driven copy
  const { t } = useI18n();
  const { data: entPages } = usePageSettings('enterprise', [
    'hero.eyebrow', 'hero.headline', 'hero.sub', 'hero.cta_primary', 'hero.cta_secondary',
    'inquiry.eyebrow', 'inquiry.headline', 'inquiry.sub', 'inquiry.eyebrow.form',
    'method.eyebrow', 'method.headline',
    'cases.eyebrow', 'cases.headline', 'cases.tag', 'cases.eyebrow_us',
    'stat.active_learners', 'stat.total_courses', 'stat.total_projects', 'stat.total_degrees',
    'form.name', 'form.email', 'form.company', 'form.phone',
    'form.team_size', 'form.topic', 'form.description',
    'form.placeholder.topic', 'form.placeholder.description',
  ]);
  const { data: industriesData } = useList<{
    id: string; key: string; label: string; description?: string | null;
    methodology?: { num: string; icon: string; title: string; desc: string; bullets: string[] }[];
    isActive?: boolean; orderIndex: number;
  }>('industries');
  const { data: methodsData } = useList<{
    id: string; num: string; icon?: string; title: string; desc: string; bullets: string[];
    isActive?: boolean; orderIndex: number;
  }>('enterprise-methods');
  const { data: teamSizesData } = useList<{ key?: string; label: string }>('team-sizes');
  const { data: siteData } = useSiteSettings(['brand.company.addresses']);

  // 把 industries 8 宫格拉成 list — 数据源: API → LIST_FALLBACK.industries (无 inline 硬编码)
  const industries = (industriesData && industriesData.length > 0
    ? industriesData
    : LIST_FALLBACK.industries as { key: string; label: string; description?: string | null; isActive?: boolean; orderIndex: number }[]
  )
    .filter((i) => i.isActive !== false)
    .map((i) => ({ label: i.label, desc: i.description ?? '' }));

  // 把 3 步法拉成 list — icon 字段是字符串名,ICON_MAP 映射到 lucide-react component
  const methods = (methodsData && methodsData.length > 0
    ? methodsData
    : LIST_FALLBACK['enterprise-methods'] as { num: string; icon?: string; title: string; desc: string; bullets?: string[]; isActive?: boolean; orderIndex: number }[]
  )
    .filter((m) => m.isActive !== false)
    .map((m) => ({
      num: m.num,
      icon: ICON_MAP[m.icon as string] ?? Target,
      title: m.title,
      desc: m.desc,
      bullets: m.bullets ?? [],
    }));

  // 团队规模选项 (CMS list 兜底,无 inline 数组)
  const teamSizes = (teamSizesData && teamSizesData.length > 0
    ? teamSizesData
    : LIST_FALLBACK['team-sizes'] as { label: string }[]
  ).map((s) => s.label);

  // Hero copy
  const heroEyebrow = pickPage(entPages, 'hero.eyebrow', 'zh-CN', t('enterprise.eyebrow.hero', '/ Enterprise Training'));
  const heroHeadline = pickPage(entPages, 'hero.headline', 'zh-CN', t('enterprise.headline.hero', 'Build\nYour\nAI Team.'));
  const heroSub = pickPage(entPages, 'hero.sub', 'zh-CN', t('enterprise.sub.hero', '1v1 咨询 + 定制化课程路径。从战略对齐到实战交付,我们与你的团队并肩作战,把 AI 真正变成生产力。'));
  const heroCtaPrimary = pickPage(entPages, 'hero.cta_primary', 'zh-CN', t('enterprise.cta.primary', 'Book 1v1 Consultation'));
  const heroCtaSecondary = pickPage(entPages, 'hero.cta_secondary', 'zh-CN', t('enterprise.cta.secondary', 'View Cases'));
  const heroLines = heroHeadline.split('\n');
  // 向下滚 → 收起顶部 hero, 向上滚 → 展开 (iOS Safari / Twitter 风格)
  const { ref: heroRef, isCollapsed } = useCollapsibleHero<HTMLElement>({ threshold: 120 });
  // Method copy
  const methodEyebrow = pickPage(entPages, 'method.eyebrow', 'zh-CN', t('enterprise.eyebrow.method', '/ 01 Method'));
  const methodHeadline = pickPage(entPages, 'method.headline', 'zh-CN', t('enterprise.headline.method', 'How We\nWork'));
  const methodLines = methodHeadline.split('\n');
  // Cases copy
  const casesEyebrow = pickPage(entPages, 'cases.eyebrow', 'zh-CN', t('enterprise.eyebrow.cases', '/ 02 Cases'));
  const casesHeadline = pickPage(entPages, 'cases.headline', 'zh-CN', t('enterprise.headline.cases', 'Trusted By'));
  const casesTag = pickPage(entPages, 'cases.tag', 'zh-CN', t('enterprise.cases.tag', '示例 · 行业范围'));
  const casesEyebrowUs = pickPage(entPages, 'cases.eyebrow_us', 'zh-CN', t('enterprise.cases.eyebrow_us', 'Industries We Serve'));
  // Inquiry copy
  const inquiryEyebrow = pickPage(entPages, 'inquiry.eyebrow', 'zh-CN', t('enterprise.eyebrow.inquiry.short', 'Get In Touch'));
  const inquiryEyebrowFull = pickPage(entPages, 'inquiry.eyebrow', 'zh-CN', t('enterprise.eyebrow.inquiry', 'Get In Touch'));
  const inquiryHeadline = pickPage(entPages, 'inquiry.headline', 'zh-CN', t('enterprise.headline.inquiry', 'Start\nThe\nConversation'));
  const inquiryHeadlineLines = inquiryHeadline.split('\n');
  const inquirySub = pickPage(entPages, 'inquiry.sub', 'zh-CN', t('enterprise.inquiry.sub', '填写右侧表单,我们的解决方案顾问会在 1 个工作日内联系你,提供 1v1 定制咨询。'));
  // Address line — 没配 site_settings 时为空数组,不显示假地址
  const addressCities = (siteData?.['brand.company.addresses'] && Array.isArray(siteData['brand.company.addresses'])
    ? siteData['brand.company.addresses']
    : []) as string[];

  // 联系信息走 env 注入,没设时不显示该行(避免硬编码邮箱/电话)
  const enterpriseEmail =
    import.meta.env.VITE_PUBLIC_ENTERPRISE_EMAIL?.trim() ?? '';
  const enterprisePhone = import.meta.env.VITE_PUBLIC_ENTERPRISE_PHONE?.trim();

  // Stats 标签 (CMS 优先,i18n 兜底,空字符串兜底)
  const statActiveLearners = pickPage(entPages, 'stat.active_learners', 'zh-CN', t('company.stat.active_learners', ''));
  const statTotalCourses = pickPage(entPages, 'stat.total_courses', 'zh-CN', t('company.stat.total_courses', ''));
  const statTotalProjects = pickPage(entPages, 'stat.total_projects', 'zh-CN', t('company.stat.total_projects', ''));
  const statTotalDegrees = pickPage(entPages, 'stat.total_degrees', 'zh-CN', t('company.stat.total_degrees', ''));

  // 表单 label (CMS 优先,i18n 兜底,空字符串兜底)
  const labelName = pickPage(entPages, 'form.name', 'zh-CN', t('company.contact.field.name', ''));
  const labelEmail = pickPage(entPages, 'form.email', 'zh-CN', t('company.contact.field.email', ''));
  const labelCompany = pickPage(entPages, 'form.company', 'zh-CN', t('company.contact.field.company', ''));
  const labelPhone = pickPage(entPages, 'form.phone', 'zh-CN', t('company.contact.field.phone', ''));
  const labelTeamSize = pickPage(entPages, 'form.team_size', 'zh-CN', t('company.contact.field.team_size', ''));
  const labelTopic = pickPage(entPages, 'form.topic', 'zh-CN', t('company.contact.field.topic', ''));
  const labelDescription = pickPage(entPages, 'form.description', 'zh-CN', t('company.contact.field.description', ''));

  // 表单 placeholder
  const placeholderTopic = pickPage(entPages, 'form.placeholder.topic', 'zh-CN', t('company.contact.topic.placeholder', ''));
  const placeholderDescription = pickPage(entPages, 'form.placeholder.description', 'zh-CN', t('company.contact.form.desc', ''));

  // 表单 section eyebrow — 不要硬编码 "/ 03 Inquiry",由 CMS 配
  const formEyebrow = pickPage(entPages, 'inquiry.eyebrow.form', 'zh-CN', t('company.contact.form.eyebrow', '/ Inquiry'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/v1/enterprise/inquiries', form);
      setSuccess(true);
      setForm(initialForm);
      showToast(t('company.contact.success', '已收到您的咨询,我们会尽快联系您'), 'success', 4000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t('company.contact.error', '提交失败，请稍后再试');
      // P0 (audit 2026-07-24): 改用 showToast 跟全项目一致, 弃 inline 红条
      showToast(msg, 'error', 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      <Seo
        title={heroHeadline.replace(/\n/g, ' ')}
        description={heroSub}
        path="/enterprise"
      />
      {/* ==================== HERO (FULL BLACK) ==================== */}
      {/* 向下滚 → 收起, 向上滚 → 展开 (iOS Safari / Twitter 风格) */}
      <section
        ref={heroRef}
        className={cn(
          'border-b border-[#171717] bg-[#171717] text-white overflow-hidden transition-all duration-300 ease-out',
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1200px] opacity-100',
        )}
        aria-hidden={isCollapsed}
      >
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> {heroEyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-[0.95] mb-8">
            {heroLines[0] ?? heroHeadline}
            <br />
            {heroLines[1] ?? ''}
            <br />
            <span className="text-white/40">{heroLines[2] ?? ''}</span>
          </h1>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-3xl mb-12">
            {heroSub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#inquiry"
              className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors"
            >
              <span>{heroCtaPrimary}</span>
              <ArrowUpRight className="w-5 h-5" />
            </a>
            <a
              href="#cases"
              className="inline-flex items-center justify-between gap-6 border border-white/30 text-white px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-white/10 transition-colors"
            >
              <span>{heroCtaSecondary}</span>
              <ArrowUpRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ==================== STATS BAR (来自 GET /api/v1/site/stats) ====================
          原硬编码 "50+ Enterprise Clients / 10K+ Trained Engineers / 98% / 12+"
          没有任何后端 source-of-truth, 全部改为 SiteStats 真实 KPI + 重新映射标签:
            activeLearners   → 累计培训学员
            totalCourses     → 已上线系统化课程
            totalProjects    · 已交付实践项目
            totalDegrees     → 学位项目数
          加载中显示 '—' */}
      <section className="border-b border-[#171717] bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[
            { num: formatStatNumber(stats?.activeLearners), label: statActiveLearners },
            { num: formatStatNumber(stats?.totalCourses), label: statTotalCourses },
            { num: formatStatNumber(stats?.totalProjects), label: statTotalProjects },
            { num: formatStatNumber(stats?.totalDegrees), label: statTotalDegrees },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`p-8 md:p-10 ${i < 3 ? 'border-r border-[#171717]' : ''} ${
                i < 2 ? 'border-b md:border-b-0 border-[#171717]' : ''
              }`}
            >
              <div className="text-4xl md:text-5xl font-black tracking-tighter mb-2">{s.num}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== METHODOLOGY (3-STEP) ==================== */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
            {methodEyebrow}
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none mb-12">
            {methodLines[0] ?? methodHeadline}
            <br />{methodLines[1] ?? ''}
          </h2>

          <div className="border-t border-l border-[#171717]">
            {methods.map(({ num, icon: Icon, title, desc, bullets }) => (
              <div
                key={num}
                className="grid grid-cols-1 md:grid-cols-12 border-b border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
              >
                <div className="md:col-span-3 p-8 border-b md:border-b-0 md:border-r border-[#171717] flex flex-col gap-4 justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A3A3A3]">
                    Step
                  </span>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-7xl font-black tracking-tighter leading-[0.85] text-[#171717]">
                      {num}
                    </span>
                    <Icon className="w-7 h-7 text-[#171717]" />
                  </div>
                </div>
                <div className="md:col-span-5 p-8 border-b md:border-b-0 md:border-r border-[#171717]">
                  <h3 className="text-2xl font-black tracking-tight mb-3">{title}</h3>
                  <p className="text-sm text-[#666666] leading-relaxed">{desc}</p>
                </div>
                <div className="md:col-span-4 p-8 flex flex-col gap-2 justify-center">
                  {bullets.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#171717]"
                    >
                      <Check className="w-3.5 h-3.5" /> {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CASES (BENTO) ==================== */}
      <section id="cases" className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                {casesEyebrow}
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                {casesHeadline}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#171717]">
                <span className="w-1.5 h-1.5 bg-[#171717]" />
                {casesTag}
              </span>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                {casesEyebrowUs}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[#171717]">
            {industries.map(({ label, desc }) => (
              <div
                key={label}
                className="p-6 border-b border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
              >
                <div className="text-base font-black tracking-tight leading-tight mb-2">
                  {label}
                </div>
                <div className="text-xs text-[#666666] leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== INQUIRY FORM (SPLIT) ==================== */}
      <section id="inquiry" className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: pitch */}
          <div className="p-10 md:p-16 lg:p-20 border-b lg:border-b-0 lg:border-r border-white/20 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 mb-8 w-fit">
              <span className="w-2 h-2 bg-white" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                {inquiryEyebrowFull}
              </span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.95] mb-6">
              {inquiryHeadlineLines[0] ?? inquiryHeadline}
              <br />{inquiryHeadlineLines[1] ?? ''}
              <br />{inquiryHeadlineLines[2] ?? ''}
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              {inquirySub}
            </p>

            <div className="space-y-4 border-t border-white/20 pt-8">
              {enterpriseEmail ? (
                <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                  <Mail className="w-4 h-4 text-white/50" />
                  <a
                    href={`mailto:${enterpriseEmail}`}
                    className="hover:text-white transition-colors underline underline-offset-4"
                  >
                    {enterpriseEmail}
                  </a>
                </div>
              ) : null}
              {enterprisePhone ? (
                <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                  <Phone className="w-4 h-4 text-white/50" />
                  <span>{enterprisePhone}</span>
                </div>
              ) : (
                // env 未设时不展示电话行(原 "+86 400-xxx-xxxx" 是假数据)
                <div className="flex items-center gap-4 text-sm font-medium text-white/40 italic">
                  <Phone className="w-4 h-4 text-white/30" />
                  <span>{t('company.address.placeholder', '电话可通过邮件联系获取')}</span>
                </div>
              )}
              {addressCities.length > 0 ? (
                <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                  <Building2 className="w-4 h-4 text-white/50" />
                  <span>AI Academy · {addressCities.join(' · ')}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: form */}
          <div className="p-10 md:p-16 lg:p-20 bg-[#F5F4F0] text-[#171717]">
            {success ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-[#171717] text-white flex items-center justify-center mb-6">
                  <Check className="w-8 h-8" strokeWidth={3} />
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-3 break-words">{t('company.contact.success.title', '收到!')}</h3>
                <p className="text-[#666666] mb-8 max-w-md">
                  {t('company.contact.success.desc', '我们的解决方案顾问会在 1 个工作日内通过邮件或电话联系你。')}
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline"
                >
                  {t('company.contact.success.again', '再次提交 →')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-6">
                  {formEyebrow}
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-8 break-words">{t('company.contact.form.title', '告诉我们你的需求')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label={labelName}
                    icon={UserIcon}
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    required
                  />
                  <Field
                    label={labelEmail}
                    icon={Mail}
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                  />
                  <Field
                    label={labelCompany}
                    icon={Building}
                    value={form.company}
                    onChange={(v) => setForm({ ...form, company: v })}
                    required
                  />
                  <Field
                    label={labelPhone}
                    icon={Phone}
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 block">
                    {labelTeamSize}
                  </label>
                  <div className="flex flex-wrap border border-[#171717]">
                    {teamSizes.map((size, i) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setForm({ ...form, teamSize: size })}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                          form.teamSize === size
                            ? 'bg-[#171717] text-white'
                            : 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
                        } ${i < teamSizes.length - 1 ? 'border-r border-[#171717]' : ''}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label={labelTopic}
                  icon={Zap}
                  value={form.topic}
                  onChange={(v) => setForm({ ...form, topic: v })}
                  placeholder={placeholderTopic}
                  required
                />

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 block">
                    {labelDescription}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    placeholder={placeholderDescription}
                    className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] focus:ring-2 focus:ring-[#171717] transition-colors resize-none"
                  />
                </div>

                {/* P0 (audit 2026-07-24): 错误改走 showToast (上方), 删 inline 红条 */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-between gap-6 bg-[#171717] text-white px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? t('company.contact.submitting', '提交中...') : t('company.contact.submit', '提交咨询')}</span>
                  <Send className="w-5 h-5" />
                </button>

                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> {t('company.contact.prefill.supported', 'AI Pre-fill supported in admin')}
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] focus:ring-2 focus:ring-[#171717] transition-colors"
      />
    </div>
  );
}
