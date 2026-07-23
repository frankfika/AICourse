import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { HackathonStatus } from '@opencsg/shared-types';
import { Seo } from '../../components/Seo';
import { useAuthStore } from '../../stores/authStore';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { HackathonCard } from './HackathonCard';
import { usePageSettings, useI18n, pickPage } from '../../lib/cms';
import { useCollapsibleHero } from '../../hooks/useCollapsibleHero';
import { cn } from '../../lib/cn';
import { Tabs } from '../../components/ui/Tabs';
import { SearchInput } from '../../components/ui/SearchInput';
import { usePagination } from '../../hooks/usePagination';

const FALLBACK_TABS: { key: HackathonStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'upcoming', label: '报名中' },
  { key: 'active', label: '进行中' },
  { key: 'judging', label: '评审中' },
  { key: 'finished', label: '已结束' },
];

export function HackathonListPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<HackathonStatus | 'all'>('all');

  // CMS-driven tabs (cms-audit-labels.md §3: hackathon_status)
  const { t } = useI18n();
  const TABS = FALLBACK_TABS.map((tab) => ({
    ...tab,
    label:
      tab.key === 'all'
        ? t('hackathon.tab.all', tab.label)
        : t(`hackathon.tab.${tab.key}`, tab.label),
  }));

  const { data: hackathons, isLoading } = useQuery({
    queryKey: ['hackathons', activeTab, search],
    queryFn: async () => {
      const params: { status?: string; search?: string } = {};
      if (activeTab !== 'all') params.status = activeTab;
      if (search.trim()) params.search = search.trim();
      return hackathonsApi.getAll(params);
    },
  });

  // P1-4: 客户端分页(每页 24)
  const pagination = usePagination(hackathons ?? [], { pageSize: 24 });

  // CMS-driven copy
  const { data: pageData } = usePageSettings('hackathons', [
    'list.eyebrow', 'list.headline', 'list.sub', 'list.empty_eyebrow', 'list.empty_title',
  ]);
  const eyebrow = pickPage(pageData, 'list.eyebrow', 'zh-CN', t('hackathon.eyebrow.list', '/ Hackathons'));
  const headline = pickPage(pageData, 'list.headline', 'zh-CN', t('hackathon.headline.list', 'BUILD.\nSHIP.\nWIN.'));
  const sub = pickPage(pageData, 'list.sub', 'zh-CN', t('hackathon.sub.list', '加入开放式创新挑战赛，与社区一起构建 AI 与大模型应用，在限定时间内交付可演示的解决方案。'));
  const emptyEyebrow = pickPage(pageData, 'list.empty_eyebrow', 'zh-CN', t('hackathon.empty.eyebrow', '/ 404'));
  const emptyTitle = pickPage(pageData, 'list.empty_title', 'zh-CN', t('hackathon.list.empty_title', '没有找到符合条件的黑客松'));
  const headlineLines = headline.split('\n');

  // 向下滚 → 收起顶部 hero, 向上滚 → 展开 (iOS Safari / Twitter 风格)
  const { ref: heroRef, isCollapsed } = useCollapsibleHero<HTMLElement>({ threshold: 120 });

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      <Seo
        title={headline.replace(/\n/g, ' ')}
        description={sub}
        path="/hackathons"
      />
      {/* Hero — black (collapsible on scroll) */}
      <section
        ref={heroRef}
        className={cn(
          'border-b border-[#171717] bg-[#171717] text-white overflow-hidden transition-all duration-300 ease-out',
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1200px] opacity-100',
        )}
        aria-hidden={isCollapsed}
      >
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-4 h-4 text-white/60" />
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
              {eyebrow}
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-[0.9] mb-6">
            {headlineLines[0] ?? headline}
            <br />{headlineLines[1] ?? ''}
            <br />{headlineLines[2] ?? ''}
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-2xl">
            {sub}
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <Tabs<HackathonStatus | 'all'>
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="黑客松状态筛选"
            items={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
            className="flex flex-wrap items-stretch border border-[#171717] divide-x divide-[#171717]"
            itemClassName={(_, active) =>
              `px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-[#171717] ${
                active ? 'bg-[#171717] text-white' : 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
              }`
            }
          />

          <div className="flex-1 max-w-md">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search.placeholder.hackathon', '搜索黑客松...')}
              ariaLabel={t('common.search.placeholder.hackathon', '搜索黑客松...')}
            />
          </div>
        </div>
      </section>

      {/* List */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="py-24 text-center text-[#666666] font-medium">{t('common.loading', '加载中...')}</div>
          ) : pagination.pageItems.length ? (
            <>
              <div>
                {pagination.pageItems.map((h, i) => (
                  <div
                    key={h.id}
                    className={i < pagination.pageItems.length - 1 ? 'border-b border-[#171717]' : ''}
                  >
                    <HackathonCard
                      hackathon={h}
                      isOrganizer={!!user && h.organizerId === user.id}
                    />
                  </div>
                ))}
              </div>
              {pagination.totalPages > 1 && (
                <div className="px-6 py-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#171717]">
                  <div className="text-sm text-[#666666]">
                    第 <span className="font-mono font-medium text-[#171717]">{pagination.currentPage}</span> / {pagination.totalPages} 页
                    <span className="ml-2 font-mono">· 共 {pagination.total} 条</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={pagination.prev}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest bg-[#F5F4F0] border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[#171717]"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={pagination.next}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest bg-[#F5F4F0] border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[#171717]"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                {emptyEyebrow}
              </div>
              <p className="text-2xl font-black tracking-tighter">{emptyTitle}</p>
              <Link
                to="/hackathons"
                className="inline-flex items-center gap-2 mt-6 text-xs font-black uppercase tracking-widest text-[#171717] hover:underline"
              >
                {t('common.clear_filter', '清除筛选')} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
