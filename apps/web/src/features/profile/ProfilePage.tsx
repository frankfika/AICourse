import { useQuery } from '@tanstack/react-query';
import {
  LogOut,
  User as UserIcon,
  BookOpen,
  Flame,
  Award,
  Settings,
  ArrowUpRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

  const unlockedBadges = (badges ?? []).filter((b) => b.unlocked).length;
  const totalBadges = (badges ?? []).length;

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      {/* Hero — black banner */}
      <section className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">
            / Profile
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white text-[#171717] text-3xl md:text-4xl font-black flex items-center justify-center shrink-0">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                  {user?.name}
                </h1>
                <p className="text-white/60 text-sm mt-2">{user?.email}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center px-2 py-0.5 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
                    {user?.role === 'admin' ? 'Admin' : 'Student'}
                  </span>
                  {points && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-white text-[#171717] text-[10px] font-black uppercase tracking-widest">
                      Lv.{points.level}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 border border-white/30 px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-[#171717] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 bg-white text-[#171717] px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { icon: BookOpen, label: 'Completed Lessons', value: stats?.totalCompletedLessons ?? 0 },
            { icon: Flame, label: 'Streak Days', value: `${stats?.streakDays ?? 0}d` },
            { icon: Award, label: 'Badges', value: `${unlockedBadges}/${totalBadges}` },
            { icon: UserIcon, label: 'Points', value: points?.points ?? 0 },
          ].map(({ icon: Icon, label, value }, i, arr) => (
            <div
              key={label}
              className={`p-6 md:p-8 ${
                i < arr.length - 1 ? 'border-r border-[#171717]' : ''
              } ${i < 2 ? 'border-b md:border-b-0 border-[#171717]' : ''}`}
            >
              <Icon className="w-5 h-5 mb-3 text-[#666666]" />
              <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">
                {label}
              </div>
              <div className="text-3xl md:text-4xl font-black tracking-tighter">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {points && (
              <LevelBadge
                level={points.level}
                points={points.points}
                currentLevelPoints={points.currentLevelPoints ?? 0}
                nextLevelPoints={points.nextLevelPoints ?? 100}
                pointsToNextLevel={points.pointsToNextLevel ?? 100}
              />
            )}

            <div className="border border-[#171717] bg-white">
              <div className="p-5 border-b border-[#171717] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                    / 01 Activity
                  </div>
                  <h2 className="text-xl font-black tracking-tight mt-1">学习活动</h2>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#A3A3A3]">
                  Last 52 Weeks
                </div>
              </div>
              <div className="p-5">
                {stats ? <ActivityHeatmap data={stats.activity ?? []} /> : <div className="text-[#666666]">加载中...</div>}
              </div>
            </div>

            <div className="border border-[#171717] bg-white">
              <div className="p-5 border-b border-[#171717] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                    / 02 Progress
                  </div>
                  <h2 className="text-xl font-black tracking-tight mt-1">我的课程进度</h2>
                </div>
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline"
                >
                  More <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div>
                {courseProgressList.length > 0 ? (
                  courseProgressList.map((cp, i) => (
                    <Link
                      key={cp.courseId}
                      to={`/courses/${cp.courseId}`}
                      className={`flex items-center gap-4 p-5 hover:bg-[#F5F4F0] transition-colors ${
                        i < courseProgressList.length - 1 ? 'border-b border-[#EEEDE9]' : ''
                      }`}
                    >
                      <ProgressRing percent={cp.percent} size={56} strokeWidth={5} />
                      <div className="flex-1 min-w-0">
                        <div className="font-black tracking-tight truncate">
                          {courseTitleMap.get(cp.courseId) || '课程'}
                        </div>
                        <div className="text-xs text-[#666666] font-medium mt-0.5">
                          {cp.completedLessons}/{cp.totalLessons} Lessons
                        </div>
                      </div>
                      {cp.isCompleted ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
                          Done
                        </span>
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-[#666666]" />
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="text-[#666666] text-sm mb-4">还没有注册任何课程</div>
                    <Link
                      to="/courses"
                      className="inline-flex items-center gap-2 bg-[#171717] text-white px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
                    >
                      浏览课程 <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Badges */}
          <div className="lg:col-span-1">
            <div className="border border-[#171717] bg-white">
              <div className="p-5 border-b border-[#171717]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                  / 03 Badges
                </div>
                <div className="flex items-end justify-between mt-1">
                  <h2 className="text-xl font-black tracking-tight">徽章墙</h2>
                  <div className="text-2xl font-black tracking-tighter">
                    {unlockedBadges}
                    <span className="text-sm text-[#A3A3A3] ml-1">/{totalBadges}</span>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {badges && badges.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {badges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} size="sm" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#666666] text-center py-6">还没有徽章，继续学习解锁吧！</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
