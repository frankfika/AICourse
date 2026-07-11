import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock,
  User as UserIcon,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import api from '../../lib/api';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  instructor: string;
  level: string;
  costType: 'free' | 'paid' | 'charity';
  price: number;
  tags: string;
}

interface Degree {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: number;
  costType: 'free' | 'paid' | 'charity';
  stats?: { courseCount: number; totalChapters: number; estimatedHours: number; totalLearners: number };
  courses?: Array<{ id: string; title: string; stepNumber: number }>;
}

export function HomePage() {
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const { data: degrees = [] } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const { data } = await api.get<Degree[]>('/api/v1/degrees');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const freeCourses = courses.filter((c) => c.costType === 'free').slice(0, 4);

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      {/* ==================== HERO (BENTO) ==================== */}
      <section className="border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Massive title — spans 2 cols */}
          <div className="lg:col-span-2 p-6 sm:p-10 md:p-12 lg:p-14 xl:p-16 border-b lg:border-b-0 lg:border-r border-[#171717] flex flex-col justify-between gap-8 lg:gap-10 min-h-[420px] lg:min-h-[560px] xl:min-h-[620px]">
            <div>
              <div className="inline-flex items-center gap-2 mb-6 lg:mb-8">
                <span className="w-2 h-2 bg-[#171717]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                  OpenCSG Academy / 2026
                </span>
              </div>
              <h1 className="text-[3.25rem] leading-[0.95] sm:text-6xl md:text-7xl lg:text-7xl xl:text-[7rem] 2xl:text-[8rem] font-black tracking-tighter uppercase">
                Master
                <br />
                <span className="text-[#171717]">AI.</span>
                <br />
                <span className="text-[#A3A3A3]">Own The</span>
                <br />
                <span className="text-[#171717]">Future.</span>
              </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-3 lg:gap-4">
              <Link
                to="/courses"
                className="inline-flex items-center justify-between gap-6 bg-[#171717] text-white px-5 lg:px-6 py-4 lg:py-5 font-black uppercase tracking-wider text-xs lg:text-sm hover:bg-[#262626] transition-colors"
              >
                <span>Browse All Courses</span>
                <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </Link>
              <Link
                to="/degrees"
                className="inline-flex items-center justify-between gap-6 bg-white border border-[#171717] px-5 lg:px-6 py-4 lg:py-5 font-black uppercase tracking-wider text-xs lg:text-sm hover:bg-[#EEEDE9] transition-colors"
              >
                <span>Explore Degrees</span>
                <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </Link>
            </div>
          </div>

          {/* Right column: stats stacked */}
          <div className="lg:col-span-1 grid grid-cols-3 lg:grid-cols-1">
            {[
              { num: '01', label: 'Learners', value: '10K+', desc: 'Active students worldwide' },
              { num: '02', label: 'Courses', value: '50+', desc: 'Curated by industry experts' },
              { num: '03', label: 'Degrees', value: '12', desc: 'Nano-degree programs' },
            ].map((stat, i, arr) => (
              <div
                key={stat.num}
                className={`p-6 sm:p-8 flex flex-col justify-between min-h-[140px] lg:min-h-[180px] xl:min-h-[200px] ${
                  i < arr.length - 1 ? 'border-b border-[#171717]' : ''
                } ${i < arr.length - 1 ? 'border-r lg:border-r-0 border-[#171717]' : ''}`}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                  {stat.num} / {stat.label}
                </span>
                <div>
                  <div className="text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter">
                    {stat.value}
                  </div>
                  <div className="text-xs font-medium text-[#666666] mt-1">{stat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== DEGREES (BLACK BANNER + 3 COL) ==================== */}
      {degrees && degrees.length > 0 && (
        <section className="border-b border-[#171717]">
          <div className="bg-[#171717] text-white p-8 md:p-12 lg:p-16 flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">
                Nano Degrees
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tighter uppercase leading-[0.95]">
                体系化路径<br />一站打通
              </h2>
            </div>
            <Link
              to="/degrees"
              className="inline-flex items-center gap-2 border border-white/30 px-5 py-3 text-sm font-black uppercase tracking-wider hover:bg-white hover:text-[#171717] transition-colors"
            >
              查看全部 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#171717] border-t border-[#171717]">
            {degrees.slice(0, 3).map((degree, i) => (
              <Link
                key={degree.id}
                to={`/degrees/${degree.id}`}
                className="group block p-6 lg:p-8 hover:bg-[#EEEDE9] transition-colors"
              >
                <div className="flex items-center justify-between mb-5 lg:mb-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                    / 0{i + 1}
                  </span>
                  <ArrowUpRight className="w-5 h-5 text-[#666666] group-hover:text-[#171717] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
                <h3 className="text-xl lg:text-2xl font-black tracking-tighter mb-3 leading-tight">
                  {degree.title}
                </h3>
                <p className="text-sm text-[#666666] line-clamp-3 mb-5 lg:mb-6">{degree.description}</p>
                <div className="flex items-end justify-between pt-4 border-t border-[#EEEDE9]">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                      Price
                    </div>
                    <div className="text-lg lg:text-xl font-black mt-1">
                      {degree.costType === 'free' ? '免费' : `¥${Number(degree.price).toFixed(0)}`}
                    </div>
                  </div>
                  {degree.stats && (
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                        Path
                      </div>
                      <div className="text-lg lg:text-xl font-black mt-1">
                        {degree.stats.courseCount}
                        <span className="text-xs text-[#666666] ml-1">门课</span>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ==================== FREE COURSES (BENTO 1 BIG + 3 SMALL) ==================== */}
      {freeCourses.length > 0 && (
        <section className="border-b border-[#171717]">
          <div className="p-8 md:p-12 lg:p-16 border-b border-[#171717] flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
                Free Courses
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tighter uppercase leading-[0.95]">
                立即开始<br />免费学习
              </h2>
            </div>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 border border-[#171717] px-5 py-3 text-sm font-black uppercase tracking-wider hover:bg-[#171717] hover:text-white transition-colors"
            >
              全部课程 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 md:auto-rows-fr">
            {/* Big featured course */}
            <Link
              to={`/courses/${freeCourses[0].id}`}
              className="md:col-span-2 md:row-span-3 group block border-b md:border-b-0 md:border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
            >
              <div className="aspect-[16/9] md:aspect-[16/8] overflow-hidden bg-[#EEEDE9]">
                <img
                  src={freeCourses[0].thumbnail}
                  alt={freeCourses[0].title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" /> Free
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                    {freeCourses[0].level === 'Beginner' ? '入门' : '进阶'}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter leading-tight mb-3">
                  {freeCourses[0].title}
                </h3>
                <p className="text-sm text-[#666666] line-clamp-2 mb-4">{freeCourses[0].description}</p>
                <div className="flex items-center gap-4 text-xs text-[#666666] font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {freeCourses[0].duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5" /> {freeCourses[0].instructor}
                  </span>
                </div>
              </div>
            </Link>

            {/* Smaller course list */}
            {freeCourses.slice(1, 4).map((course, i, arr) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className={`group block p-4 lg:p-6 hover:bg-[#EEEDE9] transition-colors border-b md:border-b border-[#171717] ${
                  i < arr.length - 1 ? '' : 'border-b-0 md:border-b-0'
                }`}
              >
                <div className="flex items-start gap-3 lg:gap-4 h-full">
                  <div className="shrink-0 w-16 h-16 lg:w-20 lg:h-20 overflow-hidden bg-[#EEEDE9]">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">
                        Free / {course.level === 'Beginner' ? 'Beginner' : 'Advanced'}
                      </div>
                      <h4 className="font-black tracking-tight leading-tight line-clamp-2 text-sm lg:text-base">
                        {course.title}
                      </h4>
                    </div>
                    <div className="text-xs text-[#666666] font-medium flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {course.duration}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ==================== ENTERPRISE CTA (SPLIT BLACK / OFF-WHITE) ==================== */}
      <section className="border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 md:p-12 lg:p-16 xl:p-20 bg-[#171717] text-white flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 mb-6 lg:mb-8 w-fit">
              <span className="w-2 h-2 bg-white" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                Enterprise Training
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-6xl xl:text-7xl 2xl:text-[6.5rem] font-black tracking-tighter uppercase leading-[0.95] mb-6">
              为你的<br />团队定制<br />AI 培训
            </h2>
            <p className="text-white/60 font-medium text-base lg:text-lg leading-relaxed mb-8 lg:mb-10 max-w-md">
              1v1 咨询 + 定制化课程路径。从战略到落地，我们与你的团队并肩作战。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <Link
                to="/enterprise"
                className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-5 lg:px-6 py-4 lg:py-5 font-black uppercase tracking-wider text-xs lg:text-sm hover:bg-[#EEEDE9] transition-colors"
              >
                <span>预约 1v1 咨询</span>
                <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center justify-between gap-6 border border-white/30 text-white px-5 lg:px-6 py-4 lg:py-5 font-black uppercase tracking-wider text-xs lg:text-sm hover:bg-white/10 transition-colors"
              >
                <span>先看课程</span>
                <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </Link>
            </div>
          </div>

          <div className="p-8 md:p-12 lg:p-16 xl:p-20 bg-[#F5F4F0] flex flex-col justify-center gap-6 lg:gap-8">
            {[
              { num: '01', title: '战略对齐', desc: '深入理解业务目标，识别 AI 应用高价值场景' },
              { num: '02', title: '路径设计', desc: '为不同岗位定制从入门到专家的培养路径' },
              { num: '03', title: '实战交付', desc: '用真实业务问题驱动学习，可量化的成果' },
            ].map(({ num, title, desc }) => (
              <div key={num} className="border-t border-[#171717] pt-5 lg:pt-6">
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl lg:text-3xl font-black tracking-tighter text-[#A3A3A3]">
                    {num}
                  </span>
                  <h3 className="text-lg lg:text-xl font-black tracking-tight">{title}</h3>
                </div>
                <p className="text-sm text-[#666666] mt-2 leading-relaxed pl-10 lg:pl-12">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
