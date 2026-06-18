import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, Award, Activity, Trophy } from 'lucide-react';
import { badgesApi } from '../../lib/badgesApi';
import { BadgeCard } from '../../components/BadgeCard';

export function AdminDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-gamification-stats'],
    queryFn: () => badgesApi.getAdminStats(),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="总用户数" value={stats?.totalUsers ?? 0} />
        <StatCard icon={Activity} label="近7天活跃用户" value={stats?.activeUsers7d ?? 0} />
        <StatCard icon={BookOpen} label="累计完成课时" value={stats?.totalLessonsCompleted ?? 0} />
        <StatCard icon={Award} label="徽章解锁总数" value={stats?.totalBadgesUnlocked ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" /> 积分排行榜 Top 10
          </h2>
          {stats?.leaderboard && stats.leaderboard.length > 0 ? (
            <div className="space-y-3">
              {stats.leaderboard.map((user, idx) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3 border border-[#EEEDE9] rounded-xl"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx < 3 ? 'bg-[#171717] text-white' : 'bg-[#F5F4F0] text-[#666666]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 font-medium truncate">{user.name}</div>
                  <div className="text-sm text-[#666666]">Lv.{user.level}</div>
                  <div className="font-bold">{user.points} 积分</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#666666]">暂无数据</p>
          )}
        </div>

        <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">徽章解锁分布</h2>
          {stats?.badgeDistribution && stats.badgeDistribution.length > 0 ? (
            <div className="space-y-3">
              {stats.badgeDistribution.map((item) => (
                <div key={item.badgeId} className="flex items-center gap-3">
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
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-[#666666]">{item.count} 人解锁</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#666666]">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-[#F5F4F0] rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-[#666666]">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
