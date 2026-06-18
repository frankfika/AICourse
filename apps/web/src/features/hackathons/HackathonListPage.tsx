import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Rocket } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
            <Rocket className="w-5 h-5" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">黑客松</h1>
        </div>
        <p className="text-[#666666]">
          加入开放式创新挑战赛，与社区一起构建 AI 与大模型应用。
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-white text-[#666666] border-[#EEEDE9] hover:border-[#171717]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-md w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
          <input
            type="text"
            placeholder="搜索黑客松..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EEEDE9] rounded-full text-sm focus:outline-none focus:border-[#171717]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[#666666]">加载中...</div>
      ) : hackathons?.length ? (
        <div className="flex flex-col gap-3">
          {hackathons.map((h) => (
            <HackathonCard
              key={h.id}
              hackathon={h}
              isOrganizer={!!user && h.organizerId === user.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#EEEDE9]">
          <p className="text-[#666666]">没有找到符合条件的黑客松</p>
        </div>
      )}
    </div>
  );
}
