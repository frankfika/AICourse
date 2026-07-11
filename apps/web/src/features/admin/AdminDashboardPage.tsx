import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, Award, Activity, Trophy, ArrowUpRight } from 'lucide-react';
import { badgesApi } from '../../lib/badgesApi';
import { BadgeCard } from '../../components/BadgeCard';

export function AdminDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-gamification-stats'],
    queryFn: () => badgesApi.getAdminStats(),
  });

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
          / Overview
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">数据看板</h2>
      </div>

      {/* Stat cards — 2x2 grid with borders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#171717] mb-8">
        {[
          { icon: Users, label: '总用户数', value: stats?.totalUsers ?? 0 },
          { icon: Activity, label: '近7天活跃', value: stats?.activeUsers7d ?? 0 },
          { icon: BookOpen, label: '累计完成课时', value: stats?.totalLessonsCompleted ?? 0 },
          { icon: Award, label: '徽章解锁总数', value: stats?.totalBadgesUnlocked ?? 0 },
        ].map(({ icon: Icon, label, value }, i) => (
          <div
            key={label}
            className="p-6 border-r border-b border-[#171717] hover:bg-[#F5F4F0] transition-colors"
          >
            <Icon className="w-5 h-5 mb-3 text-[#666666]" />
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">
              {label}
            </div>
            <div className="text-3xl md:text-4xl font-black tracking-tighter">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="border-2 border-[#171717] bg-white">
          <div className="p-5 border-b-2 border-[#171717] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                / 01 Leaderboard
              </div>
              <h3 className="text-lg font-black tracking-tight mt-1 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> 积分排行榜 Top 10
              </h3>
            </div>
          </div>
          <div>
            {stats?.leaderboard && stats.leaderboard.length > 0 ? (
              stats.leaderboard.map((user, idx) => (
                <div
                  key={user.userId}
                  className={`flex items-center gap-3 p-3 ${
                    idx < Math.min(stats.leaderboard.length, 10) - 1 ? 'border-b border-[#EEEDE9]' : ''
                  } hover:bg-[#F5F4F0] transition-colors`}
                >
                  <div
                    className={`shrink-0 w-8 h-8 flex items-center justify-center text-[10px] font-black ${
                      idx < 3 ? 'bg-[#171717] text-white' : 'bg-[#EEEDE9] text-[#666666]'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 font-black tracking-tight truncate min-w-0 text-sm">
                    {user.name}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                    Lv.{user.level}
                  </div>
                  <div className="font-black tracking-tighter text-sm">
                    {user.points}
                    <span className="text-[10px] text-[#A3A3A3] ml-1">pts</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-[#666666]">暂无数据</div>
            )}
          </div>
        </div>

        {/* Badge distribution */}
        <div className="border-2 border-[#171717] bg-white">
          <div className="p-5 border-b-2 border-[#171717]">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
              / 02 Distribution
            </div>
            <h3 className="text-lg font-black tracking-tight mt-1">徽章解锁分布</h3>
          </div>
          <div>
            {stats?.badgeDistribution && stats.badgeDistribution.length > 0 ? (
              stats.badgeDistribution.map((item, idx) => (
                <div
                  key={item.badgeId}
                  className={`flex items-center gap-3 p-3 ${
                    idx < stats.badgeDistribution.length - 1 ? 'border-b border-[#EEEDE9]' : ''
                  } hover:bg-[#F5F4F0] transition-colors`}
                >
                  <BadgeCard
                    badge={{
                      id: item.badgeId,
                      code: item.badgeId,
                      name: item.name,
                      description: '',
                      icon: item.icon,
                      category: '',
                      criteriaType: 'lessons_completed',
                      criteriaValue: 1,
                      points: 0,
                      isActive: true,
                      orderIndex: 0,
                      createdAt: '',
                      updatedAt: '',
                      unlocked: true,
                      progress: item.count,
                      target: item.count,
                    }}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black tracking-tight truncate">{item.name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                      {item.count} 人解锁
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#666666]" />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-[#666666]">暂无数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
