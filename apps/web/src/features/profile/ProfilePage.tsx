import { useQuery } from '@tanstack/react-query';
import { LogOut, User as UserIcon, BookOpen, Flame, Award, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { progressApi } from '../../lib/progressApi';
import { pointsApi } from '../../lib/pointsApi';
import { badgesApi } from '../../lib/badgesApi';
import { useAuthStore } from '../../stores/authStore';
import { ProgressRing } from '../../components/ProgressRing';
import { LevelBadge } from '../../components/LevelBadge';
import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { BadgeCard } from '../../components/BadgeCard';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const { data: enrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data as any[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => progressApi.getMyStats(),
  });

  const { data: points } = useQuery({
    queryKey: ['my-points'],
    queryFn: () => pointsApi.getMyPoints(),
  });

  const { data: badges } = useQuery({
    queryKey: ['my-badges'],
    queryFn: () => badgesApi.getMyBadges(),
  });

  const { data: progressList } = useQuery({
    queryKey: ['my-course-progress-list'],
    queryFn: async () => {
      if (!enrollments) return [];
      return Promise.all(
        enrollments
          .filter((e) => e.courseId)
          .map(async (e) => {
            try {
              return await progressApi.getCourseProgress(e.courseId);
            } catch {
              return null;
            }
          }),
      );
    },
    enabled: !!enrollments,
  });

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  const courseProgressList = (progressList ?? []).filter(Boolean) as {
    courseId: string;
    totalLessons: number;
    completedLessons: number;
    percent: number;
    isCompleted: boolean;
  }[];

  const courseTitleMap = new Map(
    (enrollments ?? []).filter((e) => e.course).map((e) => [e.courseId, e.course.title]),
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#171717] rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user?.name}</h1>
            <p className="text-[#666666] text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-1 rounded font-bold bg-[#F5F4F0]">
                {user?.role === 'admin' ? '管理员' : '学员'}
              </span>
              {points && (
                <span className="text-xs px-2.5 py-1 rounded font-bold bg-[#171717] text-white">
                  Lv.{points.level}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1 px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium hover:bg-[#F5F4F0]"
              >
                <Settings className="w-4 h-4" /> 后台
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium hover:bg-[#F5F4F0]"
            >
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </div>
      </div>

      {points && (
        <LevelBadge
          level={points.level}
          points={points.points}
          currentLevelPoints={points.currentLevelPoints}
          nextLevelPoints={points.nextLevelPoints}
          pointsToNextLevel={points.pointsToNextLevel}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
        <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#F5F4F0] rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-sm text-[#666666]">完成课时</span>
          </div>
          <div className="text-2xl font-bold">{stats?.totalCompletedLessons ?? 0}</div>
        </div>

        <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#F5F4F0] rounded-lg">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-sm text-[#666666]">连续学习</span>
          </div>
          <div className="text-2xl font-bold">{stats?.streakDays ?? 0} 天</div>
        </div>

        <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#F5F4F0] rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-sm text-[#666666]">已解锁徽章</span>
          </div>
          <div className="text-2xl font-bold">
            {(badges ?? []).filter((b) => b.unlocked).length} / {(badges ?? []).length}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">学习活动</h2>
        {stats ? <ActivityHeatmap data={stats.activity} /> : <div className="text-[#666666]">加载中...</div>}
      </div>

      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">徽章墙</h2>
        {badges && badges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {badges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} size="md" />
            ))}
          </div>
        ) : (
          <p className="text-[#666666]">还没有徽章，继续学习解锁吧！</p>
        )}
      </div>

      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">我的课程进度</h2>
        {courseProgressList.length > 0 ? (
          <div className="space-y-4">
            {courseProgressList.map((cp) => (
              <div
                key={cp.courseId}
                className="flex items-center gap-4 p-4 border border-[#EEEDE9] rounded-xl hover:border-[#171717] transition-colors"
              >
                <ProgressRing percent={cp.percent} size={56} strokeWidth={5} />
                <div className="flex-1">
                  <div className="font-bold">{courseTitleMap.get(cp.courseId) || '课程'}</div>
                  <div className="text-sm text-[#666666]">
                    {cp.completedLessons}/{cp.totalLessons} 课时
                  </div>
                </div>
                {cp.isCompleted && (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                    已完成
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#666666]">还没有注册任何课程。</p>
        )}
      </div>
    </div>
  );
}
