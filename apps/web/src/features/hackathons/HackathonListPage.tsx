import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Rocket, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { HackathonStatus } from '@opencsg/shared-types';
import { useAuthStore } from '../../stores/authStore';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { HackathonCard } from './HackathonCard';

const TABS: { key: HackathonStatus | 'all'; label: string }[] = [
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

  const { data: hackathons, isLoading } = useQuery({
    queryKey: ['hackathons', activeTab, search],
    queryFn: async () => {
      const params: { status?: string; search?: string } = {};
      if (activeTab !== 'all') params.status = activeTab;
      if (search.trim()) params.search = search.trim();
      return hackathonsApi.getAll(params);
    },
  });

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      {/* Hero — black */}
      <section className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-4 h-4 text-white/60" />
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
              / Hackathons
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] mb-6">
            BUILD.<br />SHIP.<br />WIN.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-2xl">
            加入开放式创新挑战赛，与社区一起构建 AI 与大模型应用，在限定时间内交付可演示的解决方案。
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-stretch border border-[#171717]">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#171717] text-white'
                    : 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
                } ${i < TABS.length - 1 ? 'border-r border-[#171717]' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <input
              type="text"
              placeholder="搜索黑客松..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
            />
          </div>
        </div>
      </section>

      {/* List */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="py-24 text-center text-[#666666] font-medium">加载中...</div>
          ) : hackathons?.length ? (
            <div>
              {hackathons.map((h, i) => (
                <div
                  key={h.id}
                  className={i < hackathons.length - 1 ? 'border-b border-[#171717]' : ''}
                >
                  <HackathonCard
                    hackathon={h}
                    isOrganizer={!!user && h.organizerId === user.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                / 404
              </div>
              <p className="text-2xl font-black tracking-tighter">没有找到符合条件的黑客松</p>
              <Link
                to="/hackathons"
                className="inline-flex items-center gap-2 mt-6 text-xs font-black uppercase tracking-widest text-[#171717] hover:underline"
              >
                清除筛选 <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
