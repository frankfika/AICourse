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
  ArrowUpRight,
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

  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data as Array<{ id: string; degreeId?: string | null; courseId?: string | null }>;
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="text-center py-32 text-[#666666]">加载中...</div>;
  if (!degree) return <div className="text-center py-32">学位不存在</div>;

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
    <div className="bg-[#F5F4F0] text-[#171717] animate-in fade-in duration-500">
      {/* Top action bar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/degrees"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] hover:text-[#171717]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back To Degrees
          </Link>
        </div>
      </section>

      {/* Hero */}
      <section className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Nano Degree
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              / Path
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase leading-[0.95] mb-6 max-w-5xl">
            {degree.title}
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-12 max-w-3xl">
            {degree.description}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-white/20">
            {[
              { icon: BookOpen, label: 'Courses', value: `${degree.stats.courseCount}` },
              { icon: GraduationCap, label: 'Chapters', value: `${degree.stats.totalChapters}` },
              { icon: Clock, label: 'Hours', value: `${degree.stats.estimatedHours}` },
              { icon: Users, label: 'Learners', value: `${degree.stats.totalLearners}` },
            ].map(({ icon: Icon, label, value }, i) => (
              <div
                key={label}
                className={`p-6 ${i < 3 ? 'border-r border-white/20' : ''} ${i < 2 ? 'border-b md:border-b-0 border-white/20' : ''}`}
              >
                <Icon className="w-5 h-5 mb-3 text-white/60" />
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
                  {label}
                </div>
                <div className="text-3xl font-black tracking-tighter">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-1">
              {isFree ? 'Free Program' : 'Tuition'}
            </div>
            <div className="text-4xl md:text-5xl font-black tracking-tighter">
              {isFree ? '免费' : `¥${Number(degree.price).toFixed(2)}`}
            </div>
          </div>
          {enrolled ? (
            <div className="inline-flex items-center gap-2 bg-[#171717] text-white px-8 py-4 font-black uppercase tracking-wider text-sm">
              <CheckCircle2 className="w-5 h-5" /> 已报名，去学习
            </div>
          ) : user ? (
            <button
              onClick={() => setPurchaseOpen(true)}
              className="inline-flex items-center justify-center gap-3 bg-[#171717] text-white px-8 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors"
            >
              {isFree ? '免费报名' : '立即购买'} <ArrowUpRight className="w-5 h-5" />
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-3 bg-[#171717] text-white px-8 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors"
            >
              登录后报名 <ArrowUpRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </section>

      {/* Learning outcomes */}
      {learningPoints.length > 0 && (
        <section className="border-b border-[#171717]">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
              / 01 Outcomes
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none mb-10">
              学完<br />你能
            </h2>
            <div className="grid md:grid-cols-2 gap-0 border-t border-l border-[#171717]">
              {learningPoints.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-6 border-b border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
                >
                  <div className="shrink-0 w-10 h-10 bg-[#171717] text-white text-sm font-black flex items-center justify-center">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <span className="text-base font-medium leading-relaxed pt-1.5">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Learning path */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                / 02 Curriculum
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                学习路径
              </h2>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
              {degree.courses.length} Courses
            </div>
          </div>

          <div className="border-t border-[#171717]">
            {degree.courses.map((course, i) => (
              <div
                key={course.id}
                className="grid grid-cols-1 md:grid-cols-12 border-b border-[#171717] hover:bg-[#EEEDE9] transition-colors"
              >
                {/* Step number */}
                <div className="col-span-12 md:col-span-1 p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#171717] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#666666]">
                      Step
                    </div>
                    <div className="text-2xl font-black tracking-tighter">
                      {String(course.stepNumber).padStart(2, '0')}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="col-span-12 md:col-span-8 p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#171717]">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-[#171717] text-white">
                      {course.level}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {course.duration}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {course.chapterCount} Ch
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] flex items-center gap-1">
                      <Users className="w-3 h-3" /> {course.learnerCount}
                    </span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black tracking-tight leading-tight mb-1">
                    {course.title}
                  </h3>
                  <p className="text-sm text-[#666666] line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-2">
                    讲师 / {course.instructor}
                  </div>
                </div>

                {/* Action */}
                <div className="col-span-12 md:col-span-3 p-4 md:p-6 flex md:items-center md:justify-end">
                  <Link
                    to={`/courses/${course.id}`}
                    className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#171717] hover:underline"
                  >
                    {enrolled ? '开始学习' : '查看详情'} <Play className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Certificate footer */}
          <div className="mt-10 border border-[#171717] bg-white p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <Trophy className="w-8 h-8 shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-1">
                  Completion Reward
                </div>
                <div className="text-xl font-black tracking-tight">
                  完成所有课程后将获得 OpenCSG Nano Degree 认证证书
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-6 h-6 shrink-0" />
          </div>
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
