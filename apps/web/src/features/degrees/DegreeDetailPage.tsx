import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  GraduationCap,
  Users,
  CheckCircle2,
  Sparkles,
  Play,
  Trophy,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { NanoDegreeWithPath } from '@opencsg/shared-types';
import { PurchaseModal } from './PurchaseModal';
import { useState } from 'react';

export function DegreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: degree, isLoading } = useQuery({
    queryKey: ['degree', id],
    queryFn: async () => {
      const { data } = await api.get<NanoDegreeWithPath>(`/api/v1/degrees/${id}`);
      return data;
    },
    enabled: !!id,
  });

  // 是否已报名
  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data as Array<{ id: string; degreeId?: string | null; courseId?: string | null }>;
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="text-center py-20">加载中...</div>;
  if (!degree) return <div className="text-center py-20">学位不存在</div>;

  const enrolled = !!myEnrollments?.some((e) => e.degreeId === id);
  const isFree = degree.costType === 'free' || degree.costType === 'charity';

  const learningPoints = (() => {
    try {
      return JSON.parse(degree.learningPoints) as string[];
    } catch {
      return [];
    }
  })();

  return (
    <div className="bg-[#FAFAF8] min-h-screen animate-in fade-in duration-500">
      {/* Hero */}
      <section className="bg-white border-b border-[#EEEDE9]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Link
            to="/degrees"
            className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#171717] mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> 返回学位列表
          </Link>

          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600 mt-1" />
            <span className="text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
              OpenCSG Nano Degree
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-4">{degree.title}</h1>
          <p className="text-lg text-[#666666] mb-8 max-w-3xl">{degree.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="课程" value={`${degree.stats.courseCount} 门`} />
            <StatCard icon={<GraduationCap className="w-5 h-5" />} label="章节" value={`${degree.stats.totalChapters} 章`} />
            <StatCard icon={<Clock className="w-5 h-5" />} label="预计学习" value={`${degree.stats.estimatedHours} 小时`} />
            <StatCard icon={<Users className="w-5 h-5" />} label="累计学员" value={`${degree.stats.totalLearners}`} />
          </div>

          {/* CTA */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#171717] text-white rounded-2xl p-6">
            <div>
              <div className="text-sm text-white/60 mb-1">
                {isFree ? '免费学位' : '体系化学习路径'}
              </div>
              <div className="text-3xl font-bold">
                {isFree ? '免费' : `¥${Number(degree.price).toFixed(2)}`}
              </div>
            </div>
            {enrolled ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-bold">
                <CheckCircle2 className="w-5 h-5" /> 已报名，去学习
              </div>
            ) : user ? (
              <button
                onClick={() => setPurchaseOpen(true)}
                className="px-8 py-3 rounded-xl bg-white text-[#171717] font-bold hover:bg-[#F5F4F0]"
              >
                {isFree ? '免费报名' : '立即购买'}
              </button>
            ) : (
              <Link
                to="/login"
                className="px-8 py-3 rounded-xl bg-white text-[#171717] font-bold hover:bg-[#F5F4F0] text-center"
              >
                登录后报名
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 学习成果 */}
      {learningPoints.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold mb-6">学完你能</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {learningPoints.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-white rounded-xl border border-[#EEEDE9] p-4"
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-[#171717] text-white text-sm font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </div>
                <span className="text-sm md:text-base">{p}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 学习路径 */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold">学习路径</h2>
          <span className="text-sm text-[#666666]">
            共 {degree.stats.courseCount} 门课程
          </span>
        </div>

        <div className="relative">
          {/* 时间轴 */}
          <div className="absolute left-[26px] top-4 bottom-4 w-px bg-[#EEEDE9]" />

          <div className="space-y-4">
            {degree.courses.map((course) => (
              <div
                key={course.id}
                className="relative flex items-stretch gap-4 bg-white rounded-2xl border border-[#EEEDE9] p-5 hover:shadow-md transition-shadow"
              >
                {/* 步骤序号 */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-[#171717] text-white flex flex-col items-center justify-center">
                    <span className="text-[10px] text-white/60 uppercase">step</span>
                    <span className="text-xl font-bold leading-none">
                      {String(course.stepNumber).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#F5F4F0] text-[#171717]">
                      {course.level}
                    </span>
                    <span className="text-xs text-[#666666] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {course.duration}
                    </span>
                    <span className="text-xs text-[#666666] flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {course.chapterCount} 章
                    </span>
                    <span className="text-xs text-[#666666] flex items-center gap-1">
                      <Users className="w-3 h-3" /> {course.learnerCount} 人在学
                    </span>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold mb-1">{course.title}</h3>
                  <p className="text-sm text-[#666666] line-clamp-2 mb-3">
                    {course.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#666666]">
                      讲师：{course.instructor}
                    </span>
                    {enrolled ? (
                      <Link
                        to={`/courses/${course.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#171717] hover:underline"
                      >
                        开始学习 <Play className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        to={`/courses/${course.id}`}
                        className="text-sm text-[#666666] hover:text-[#171717]"
                      >
                        查看课程详情 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 学完获得 */}
        <div className="mt-10 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-purple-700" />
            <h3 className="text-xl font-bold">学完获得</h3>
          </div>
          <p className="text-sm text-[#666666]">
            完成所有课程后将获得 OpenCSG Nano Degree 认证证书，可解锁相应徽章与积分。
          </p>
        </div>
      </section>

      <PurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        type="degree"
        itemId={degree.id}
        title={degree.title}
        price={Number(degree.price)}
        costType={degree.costType}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#F5F4F0] rounded-xl p-4">
      <div className="flex items-center gap-2 text-[#666666] mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}