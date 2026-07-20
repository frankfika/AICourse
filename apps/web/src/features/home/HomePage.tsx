/**
 * HomePage — P0-5 落地版
 *
 * 按 review/mocks/mock-home.html 的 8 段位顺序:
 *   1) hero(大标语 + 4 数据点 + 2 CTA + 右侧课程预览 mock)
 *   2) 热门课程(coursesApi 前 6)
 *   3) 学位路径(degreesApi 前 3)
 *   4) 黑客松(hackathonsApi 进行中 3 个,含倒计时)
 *   5) AI 助教 CTA(品牌宣言 + mock 聊天气泡)
 *   6) 讲师墙(4 个 mock 讲师)
 *   7) footer(4 列)
 *   8) AI 助教 FAB + mobile bottom tab — 实际放在 Layout
 *
 * 设计约束:
 *   - 全部用现成 Button / Card / Skeleton / EmptyState 4 个 P0-4 基础组件
 *   - 不写新组件 / 不引新依赖
 *   - 数据拉取 4xx/5xx 时,自动 fallback 到 mock data(4 课程/3 学位/3 黑客松/4 讲师)
 *   - 暗色:用 token,跟随 <html class="dark">
 *
 * 备注:Layout 负责顶部 nav / theme toggle / FAB / bottom tab,
 * HomePage 只负责 8 段主体内容。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock,
  User as UserIcon,
  Sparkles,
  ArrowUpRight,
  Star,
  Lock,
  Trophy,
  Calendar,
  MapPin,
  Award,
  BookOpen,
  GraduationCap,
  Search,
  MessageCircle,
  Linkedin,
} from 'lucide-react';
import { useMemo } from 'react';
import api from '../../lib/api';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

// =============================================================
// 公共类型(贴近后端 schema,但不引 shared-types 避免循环依赖)
// =============================================================
interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  instructor: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
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
  courses?: Array<{ id: string; title: string; stepNumber: number }>;
  stats?: { courseCount: number; totalChapters: number; estimatedHours: number; totalLearners: number };
}

interface Hackathon {
  id: string;
  title: string;
  description: string;
  status: 'upcoming' | 'active' | 'judging' | 'finished' | 'cancelled';
  startDate: string | Date;
  endDate: string | Date;
  location?: string | null;
  maxTeamSize: number;
  minTeamSize: number;
  _count?: { registrations?: number };
}

interface Instructor {
  id: string;
  name: string;
  title: string;
  initials: string;
  cover: string;
  linkedin: string;
}

// =============================================================
// 倒计时 hook (两态: 距开始 / 距截止)
// =============================================================
interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  phase: 'upcoming' | 'active' | 'ended';
  label: string;  // 中文 label: '距开始' / '距截止' / '已结束'
}

function useCountdown(
  startDate: string | Date,
  endDate?: string | Date,
): CountdownState {
  return useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : start + 7 * 24 * 3600 * 1000;
    const now = Date.now();

    let target: number;
    let phase: 'upcoming' | 'active' | 'ended';
    let label: string;
    if (now < start) {
      target = start;
      phase = 'upcoming';
      label = '距开始';
    } else if (now < end) {
      target = end;
      phase = 'active';
      label = '距截止';
    } else {
      target = now;
      phase = 'ended';
      label = '已结束';
    }
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return { days, hours, minutes, phase, label };
  }, [startDate, endDate]);
}

// =============================================================
// 课程封面 fallback(按 tags 选 brutalist 实心底)
// brutalist 不要渐变,统一 #171717 / #262626 黑灰硬边
// =============================================================
function getCourseCoverBg(tags: string | undefined): string {
  const t = (tags ?? '').toLowerCase();
  if (t.includes('rag')) return 'bg-[#171717]';
  if (t.includes('mlops') || t.includes('deploy')) return 'bg-[#262626]';
  if (t.includes('fine') || t.includes('tune')) return 'bg-[#171717]';
  if (t.includes('llm')) return 'bg-[#171717]';
  return 'bg-[#171717]';
}

// =============================================================
// 4 段:热门课程
// =============================================================
function CoursesSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['home', 'courses'],
    queryFn: async () => {
      const { data: d } = await api.get<Course[]>('/api/v1/courses');
      return d;
    },
    retry: 1,
    staleTime: 60_000,
  });

  // 失败 / 空 → 渲染 EmptyState(无 mock fallback)
  const courses = data ?? [];

  return (
    <section className="py-16 md:py-24 bg-neutral-0 dark:bg-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 md:mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-display-md font-bold text-neutral-900 dark:text-neutral-900">
              热门课程
            </h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-600 text-sm md:text-base">
              每门课 4-8 周,学完一个可被验证的能力
            </p>
          </div>
          <Link
            to="/courses"
            className="text-sm text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white font-medium hidden sm:inline-flex items-center gap-1"
          >
            浏览全部 <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} padding="none" className="overflow-hidden">
                <Skeleton variant="rectangle" className="aspect-video w-full rounded-none" />
                <div className="p-5 space-y-3">
                  <Skeleton variant="text" />
                  <Skeleton variant="text" count={2} />
                </div>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="暂无课程"
            description="课程正在准备中,稍后再来看看吧。"
            action={
              <Link to="/courses">
                <Button variant="primary" size="md">浏览全部课程</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="group block rounded-xl bg-neutral-50 dark:bg-neutral-50 border border-neutral-200 hover:border-[#171717] transition overflow-hidden"
                >
                  <div
                    className={`aspect-video ${getCourseCoverBg(course.tags)} relative flex items-end p-4`}
                  >
                    <span className="absolute top-3 left-3 text-xs px-2 py-0.5 rounded-full bg-neutral-0/90 dark:bg-neutral-0/90 font-medium text-neutral-900">
                      {course.tags || 'LLM 应用'}
                    </span>
                    <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-cert-500 text-white font-medium">
                      {course.level}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-lg text-neutral-900 line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
                      {course.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5" />
                          {course.instructor}
                        </span>
                        <span>·</span>
                        <span className="font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {course.duration}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-warning-500">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="font-mono">4.8</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {course.costType === 'free' ? (
                        <span className="text-xs text-success-500 font-medium">免费</span>
                      ) : course.costType === 'charity' ? (
                        <span className="text-xs text-warning-500 font-medium">公益</span>
                      ) : (
                        <span className="text-sm font-mono font-medium text-neutral-900">
                          ¥ {Number(course.price).toFixed(0)}
                        </span>
                      )}
                      <span className="text-xs text-[#171717] underline underline-offset-2 font-medium inline-flex items-center gap-1">
                        立即试看 <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {isError && (
              <p className="mt-4 text-xs text-warning-500 text-center" aria-live="polite">
                课程数据加载失败{(error as Error | undefined)?.message ? `: ${ (error as Error).message }` : ''}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// =============================================================
// 5 段:学位路径
// =============================================================
function DegreesSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['home', 'degrees'],
    queryFn: async () => {
      const { data: d } = await api.get<Degree[]>('/api/v1/degrees');
      return d;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const degrees = data ?? [];

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-display-md font-bold text-neutral-900">
              学位路径
            </h2>
            <p className="mt-2 text-neutral-600 text-sm md:text-base">
              不是又一张证书,是可被验证的能力图谱
            </p>
          </div>
          <Link
            to="/degrees"
            className="text-sm text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white font-medium hidden sm:inline-flex items-center gap-1"
          >
            浏览全部 <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="lg">
                <Skeleton variant="rectangle" className="w-12 h-12" />
                <div className="mt-4 space-y-2">
                  <Skeleton variant="text" />
                  <Skeleton variant="text" count={2} />
                </div>
              </Card>
            ))}
          </div>
        ) : degrees.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-6 h-6" />}
            title="暂无学位"
            description="学位路径正在准备中。"
            action={
              <Link to="/degrees">
                <Button variant="primary" size="md">了解学位</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {degrees.slice(0, 3).map((degree, i) => {
              const isHot = i === 1; // 中间一张为热门
              return (
                <Link
                  key={degree.id}
                  to={`/degrees/${degree.id}`}
                  className={`block rounded-xl p-6 transition ${
                    isHot
                      ? 'border-2 border-[#171717]'
                      : 'border border-neutral-200 hover:border-[#171717]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold font-mono ${
                        isHot
                          ? 'bg-xp-500 text-white'
                          : i === 2
                          ? 'bg-cert-100 text-cert-500'
                          : 'bg-[#EEEDE9] text-[#171717]'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    {isHot && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#171717] text-white font-medium">
                        最热门
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-neutral-900">
                    {degree.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600">{degree.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(degree.courses ?? []).slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-neutral-700">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHot ? 'bg-[#171717]' : i === 2 ? 'bg-cert-500' : 'bg-[#171717]'
                          }`}
                        />
                        {c.title}
                      </li>
                    ))}
                    {(degree.courses?.length ?? 0) > 4 && (
                      <li className="flex items-center gap-2 text-neutral-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />...
                      </li>
                    )}
                  </ul>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs text-neutral-600">
                      {degree.stats?.courseCount ?? 0} 门课 · {degree.stats?.estimatedHours ?? 0} 小时
                    </span>
                    <span className="text-sm text-[#171717] underline underline-offset-2 font-medium inline-flex items-center gap-1">
                      了解 <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {isError && (
          <p className="mt-4 text-xs text-warning-500 text-center" aria-live="polite">
            数据加载失败{(error as Error | undefined)?.message ? `: ${ (error as Error).message }` : ''}
          </p>
        )}
      </div>
    </section>
  );
}

// =============================================================
// 6 段:黑客松
// =============================================================
function HackathonCard({ h }: { h: Hackathon }) {
  const countdown = useCountdown(h.startDate, h.endDate);
  const startDate = new Date(h.startDate);
  const isActive = h.status === 'active';
  const dateLabel = startDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <Link
      to={`/hackathons/${h.id}`}
      className="group block rounded-xl border border-neutral-200 hover:border-[#171717] transition overflow-hidden"
    >
      <div
        className={`relative flex flex-col justify-end p-5 md:p-6 text-white ${
          isActive ? 'bg-[#171717]' : 'bg-[#262626]'
        }`}
      >
        <span className="text-xs font-medium opacity-80">
          {isActive ? '🔴 LIVE' : '即将开始'} · {dateLabel}
        </span>
        <h3 className="mt-2 text-lg md:text-xl font-bold leading-tight line-clamp-2">
          {h.title}
        </h3>
        {countdown.phase !== 'ended' && (
          <p className="mt-1 text-xs font-mono opacity-90">
            {countdown.label} {countdown.days} 天 {countdown.hours} 小时
          </p>
        )}
        {countdown.phase === 'ended' && (
          <p className="mt-1 text-xs font-mono opacity-90">已结束</p>
        )}
      </div>
      <div className="p-4 bg-neutral-50">
        <p className="text-xs text-neutral-600 line-clamp-2 mb-2">{h.description}</p>
        <div className="flex items-center justify-between text-[10px] text-neutral-600">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            {h._count?.registrations ?? 0} 人报名
          </span>
          <span className="text-[#171717] underline underline-offset-2 font-medium inline-flex items-center gap-1">
            立即报名 <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function HackathonsSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['home', 'hackathons'],
    queryFn: async () => {
      // 取进行中 + 即将开始各 1-2 个
      const [active, upcoming] = await Promise.all([
        hackathonsApi.getAll({ status: 'active' }).catch(() => []),
        hackathonsApi.getAll({ status: 'upcoming' }).catch(() => []),
      ]);
      return [...active, ...upcoming].slice(0, 3) as Hackathon[];
    },
    retry: 1,
    staleTime: 60_000,
  });

  const hackathons = data ?? [];

  const main = hackathons[0];
  const small = hackathons.slice(1, 3);
  const mainCountdown = useCountdown(
    main?.startDate ?? new Date(),
    main?.endDate,
  );

  return (
    <section className="py-16 md:py-24 bg-neutral-0 dark:bg-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 md:mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-display-md font-bold text-neutral-900">
              黑客松进行中
            </h2>
            <p className="mt-2 text-neutral-600 text-sm md:text-base">
              社区、竞赛、激励 —— 让你的能力被看见
            </p>
          </div>
          <Link
            to="/hackathons"
            className="text-sm text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white font-medium hidden sm:inline-flex items-center gap-1"
          >
            全部赛事 <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" padding="none">
              <Skeleton variant="rectangle" className="aspect-[2/1] w-full rounded-t-xl" />
              <div className="p-5">
                <Skeleton variant="text" count={2} />
              </div>
            </Card>
            <div className="space-y-4">
              <Skeleton variant="rectangle" className="h-32 w-full" />
              <Skeleton variant="rectangle" className="h-32 w-full" />
            </div>
          </div>
        ) : hackathons.length === 0 ? (
          <EmptyState
            icon={<Trophy className="w-6 h-6" />}
            title="暂无黑客松"
            description="下一场黑客松正在筹备中,敬请期待。"
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* 主卡 */}
            <Link
              to={`/hackathons/${main.id}`}
              className="lg:col-span-2 block rounded-xl border border-neutral-200 overflow-hidden group hover:border-[#171717] transition"
            >
              <div className="aspect-[2/1] bg-[#171717] p-6 md:p-8 flex flex-col justify-end text-white">
                <span className="text-xs font-medium opacity-80">
                  {mainCountdown.phase === 'upcoming' && '⏰ '}
                  {mainCountdown.phase === 'active' && '🔴 LIVE · '}
                  {mainCountdown.phase === 'ended' && '已结束'}
                  {mainCountdown.phase !== 'ended' &&
                    `${mainCountdown.label} ${mainCountdown.days} 天 ${mainCountdown.hours} 小时 ${mainCountdown.minutes} 分`}
                </span>
                <h3 className="mt-2 text-2xl md:text-3xl font-bold leading-tight">
                  {main.title}
                </h3>
                <p className="mt-2 opacity-90 text-sm md:text-base line-clamp-2">
                  {main.description}
                </p>
              </div>
              <div className="p-5 flex items-center justify-between bg-neutral-50">
                <div className="flex items-center gap-3 text-xs text-neutral-600">
                  <span className="flex items-center gap-1">
                    <UsersMini /> {main._count?.registrations ?? 0} 人已报名
                  </span>
                  {main.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {main.location}
                    </span>
                  )}
                </div>
                <span className="text-sm px-4 py-2 rounded-md bg-[#171717] text-white font-medium group-hover:bg-[#262626] transition">
                  立即报名
                </span>
              </div>
            </Link>
            {/* 小卡 */}
            <div className="space-y-4">
              {small.length > 0 ? (
                small.map((h) => <HackathonCard key={h.id} h={h} />)
              ) : (
                <Card padding="lg">
                  <p className="text-sm text-neutral-600 text-center">暂无其他赛事</p>
                </Card>
              )}
            </div>
          </div>
        )}
        {isError && (
          <p className="mt-4 text-xs text-warning-500 text-center" aria-live="polite">
            数据加载失败{(error as Error | undefined)?.message ? `: ${ (error as Error).message }` : ''}
          </p>
        )}
      </div>
    </section>
  );
}

// 临时小图标 - 用 Users 替代但宽度更窄
function UsersMini() {
  return <UserIcon className="w-3 h-3" />;
}

// =============================================================
// 7 段:AI 助教 CTA
// =============================================================
function AiTutorSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-[#171717] p-8 md:p-16 text-white relative overflow-hidden">
          {/* 装饰圆 */}
          <div
            className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#A3A3A3]/20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                贯穿全程
              </span>
              <h2 className="mt-4 text-3xl md:text-display-md font-bold">
                AI 助教,不在抽屉里
              </h2>
              <p className="mt-4 opacity-90 leading-relaxed">
                每节课、每个项目、每个问题旁边都有它 —— 知道你在学什么,能引用你学过的内容,会用苏格拉底式反问而不只是给答案。
              </p>
              <Link to="/dashboard/learning" className="inline-block mt-6">
                <span className="px-6 py-3 rounded-md bg-white text-[#171717] font-medium hover:bg-neutral-100 transition inline-flex items-center gap-2">
                  体验 AI 助教 <ArrowUpRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
            {/* 聊天气泡 mock */}
            <div className="bg-white rounded-xl p-5 border border-[#171717]">
              <div className="text-xs opacity-70 font-mono mb-3 text-[#666666]">
                LESSON · 用 LangChain 搭建第一个 Agent
              </div>
              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-[#171717] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    我
                  </div>
                  <div className="text-sm bg-[#EEEDE9] rounded-lg p-3 text-[#171717]">
                    ReAct 和 Tool Use 到底有什么区别?
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-cert-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    AI
                  </div>
                  <div className="text-sm bg-[#EEEDE9] rounded-lg p-3 text-[#171717]">
                    <p>ReAct 是"推理-行动"循环的模式,Tool Use 是其中"行动"环节的具体实现。类比:ReAct 像算法,Tool Use 像函数调用。</p>
                    <p className="mt-2 text-[#666666] text-xs">📎 引用:Lesson 2.3 · 00:04:12</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================
// 8 段:讲师墙
// =============================================================
function InstructorsSection() {
  // 从真实课程数据聚合 instructor 字段去重(共享 CoursesSection 的 query cache)
  const { data: courses } = useQuery({
    queryKey: ['home', 'courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  // 按 instructor 字段去重,保留前 4 个
  const instructors: Instructor[] = useMemo(() => {
    if (!courses) return [];
    const seen = new Set<string>();
    const palette = [
      { cover: 'bg-[#171717]' },
      { cover: 'bg-[#262626]' },
      { cover: 'bg-[#171717]' },
      { cover: 'bg-[#262626]' },
    ];
    const result: Instructor[] = [];
    for (let i = 0; i < courses.length && result.length < 4; i++) {
      const c = courses[i];
      const name = c.instructor?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({
        id: `i-${name}`,
        name,
        title: '课程讲师', // 后端目前没有 instructor.title 字段,统一占位
        initials: name.charAt(0),
        cover: palette[result.length].cover,
        linkedin: '#',
      });
    }
    return result;
  }, [courses]);

  if (instructors.length === 0) {
    return (
      <section className="py-16 md:py-24 bg-neutral-0 dark:bg-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-display-md font-bold text-neutral-900">来自一线的讲师</h2>
          <p className="mt-2 text-neutral-600 text-sm md:text-base">讲师信息将在课程上线后展示</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-neutral-0 dark:bg-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <h2 className="text-3xl md:text-display-md font-bold text-neutral-900">
            来自一线的讲师
          </h2>
          <p className="mt-2 text-neutral-600 text-sm md:text-base">
            不是 PPT 复读机,是正在写代码、正在做产品的人
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {instructors.map((inst) => (
            <a
              key={inst.id}
              href={inst.linkedin}
              className="text-center group relative"
            >
              <div
                className={`w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full ${inst.cover} flex items-center justify-center text-white text-2xl font-bold`}
              >
                {inst.initials}
              </div>
              <h3 className="mt-3 font-semibold text-neutral-900">
                {inst.name}
              </h3>
              <p className="text-xs text-neutral-600 mt-1">{inst.title}</p>
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#171717] text-white">
                  <Linkedin className="w-4 h-4" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================
// 9 段:Footer
// =============================================================
// =============================================================
// 注:SiteFooter 已提升到 main Layout (components/Layout.tsx),
//     所有页共享同一个 footer, 不再在 HomePage 单独渲染。
// =============================================================
// 主页面
// =============================================================
export function HomePage() {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 transition-colors">
      {/* 1 段:HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(23,23,23,0.06), transparent 60%), radial-gradient(ellipse at bottom right, rgba(163,163,163,0.08), transparent 50%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 左侧文字 */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEEDE9] text-[#171717] text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#171717]" />
                2026 春季 · 第 14 期 · 现已开放报名
              </div>
              <h1 className="text-4xl md:text-display-lg font-bold tracking-tight leading-[1.1] text-neutral-900">
                学完仍然不会做?
                <br />
                <span className="underline underline-offset-4 decoration-4">让 AI 时代的能力</span>
                <br />
                可被看见。
              </h1>
              <p className="mt-6 text-lg text-neutral-600 max-w-xl">
                课程 + 学位 + 实践项目 + 黑客松 + AI 助教 —— 一条连续的学习回路,不是又一个视频站。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/courses">
                  <Button variant="primary" size="lg" leftIcon={<Sparkles className="w-5 h-5" />}>
                    免费开始
                  </Button>
                </Link>
                <Link to="/degrees">
                  <Button variant="secondary" size="lg" rightIcon={<ArrowUpRight className="w-5 h-5" />}>
                    了解学位路径
                  </Button>
                </Link>
              </div>
              <div className="mt-10 md:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 max-w-xl">
                {[
                  { num: '12.4K', label: '在读学员' },
                  { num: '86', label: '系统化课程' },
                  { num: '2,400+', label: '已完成项目' },
                  { num: '24', label: '学位' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl md:text-3xl font-bold font-mono text-neutral-900">
                      {s.num}
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 右侧:课程预览 mock 卡片(纯 lucide 拼) */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-2xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(23,23,23,0.06), rgba(163,163,163,0.08))',
                }}
                aria-hidden="true"
              />
              <Card variant="elevated" padding="md" className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-danger-500" />
                  <div className="w-2 h-2 rounded-full bg-warning-500" />
                  <div className="w-2 h-2 rounded-full bg-success-500" />
                  <span className="ml-2 text-xs text-neutral-600 font-mono">
                    academy.opencsg / learn
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-neutral-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-[#666666] font-medium">
                          CHAPTER 03 · LESSONS 04 / 12
                        </div>
                        <div className="mt-1 font-medium text-neutral-900 truncate">
                          用 LangChain 搭建第一个 Agent
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#171717] text-white whitespace-nowrap">
                        已完成
                      </span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-neutral-200 overflow-hidden">
                      <div className="h-full w-2/3 bg-[#171717]" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 border-2 border-[#171717]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-[#666666] font-medium">
                          CHAPTER 04 · LESSONS 01 / 08
                        </div>
                        <div className="mt-1 font-medium text-neutral-900 truncate">
                          RAG 检索增强生成实战
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#171717] text-white whitespace-nowrap">
                        进行中
                      </span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-neutral-200 overflow-hidden">
                      <div className="h-full w-1/4 bg-[#171717] animate-pulse" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 opacity-60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-neutral-600 font-medium">
                          CHAPTER 05 · LOCKED
                        </div>
                        <div className="mt-1 font-medium text-neutral-900 truncate">
                          Function Calling 与工具集成
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-[#EEEDE9] border border-[#171717]">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#171717] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      AI
                    </div>
                    <div className="text-sm text-neutral-900">
                      <div className="text-xs text-neutral-600 mb-1">
                        AI 助教 · 2 分钟前
                      </div>
                      你在 Lesson 4 卡了 12 秒,要先回顾下向量数据库的余弦相似度吗?
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <CoursesSection />
      <DegreesSection />
      <HackathonsSection />
      <AiTutorSection />
      <InstructorsSection />
      {/* footer 提升到 main Layout, 见 components/Layout.tsx */}
    </div>
  );
}

// 显式避免未使用的引用警告(在某些 strict 模式下)
void Search;
void Calendar;
void Award;
void MessageCircle;
