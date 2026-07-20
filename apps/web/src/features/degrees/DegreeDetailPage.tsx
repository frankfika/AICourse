/**
 * DegreeDetailPage — v1.2.0 全量去 mock
 *
 * 全部数据来自 `GET /api/v1/degrees/:id` (NanoDegreeWithPath)
 * 失败 → 渲染 EmptyState, 无 mock fallback
 *
 * v1.0 阶段未实现 (后端 module 暂未提供,显示 P2 占位):
 *   - 路径阶段图 (PathDiagram)
 *   - 课程矩阵 + 必修/选修 chip
 *   - 排名图 (Leaderboard)
 *   - 证书预览
 *   - 讲师墙
 *   - 学员评价
 *
 * 真实可用:
 *   - Hero (title / description / learningPoints)
 *   - 课程列表 (degree.courses[])
 *   - Stats (degree.stats.{courseCount, totalChapters, totalLearners, estimatedHours})
 *   - 立即报名 (PurchaseModal)
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  GraduationCap,
  Users,
  Sparkles,
  PlayCircle,
  ChevronRight,
  Layers,
  Trophy,
  Star,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { NanoDegreeWithPath } from '@opencsg/shared-types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { PurchaseModal } from './PurchaseModal';

const P2_PLACEHOLDERS = [
  { icon: Layers, title: '路径阶段图', sub: '后端 stage API 设计中' },
  { icon: Trophy, title: '同班排名', sub: '后端 leaderboard API 设计中' },
  { icon: GraduationCap, title: '证书预览', sub: '后端 certificate 模块设计中' },
  { icon: Star, title: '学员评价', sub: '后端 degree-level review API 设计中' },
];

export function DegreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses'>('overview');

  const { data: degree, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['degree', id],
    queryFn: async () => {
      const { data } = await api.get<NanoDegreeWithPath>(`/api/v1/degrees/${id}`);
      return data;
    },
    enabled: !!id,
    retry: 1,
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data as Array<{ id: string; degreeId?: string | null; courseId?: string | null }>;
    },
    enabled: !!user,
    retry: 0,
  });

  if (isLoading) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton variant="text" className="h-4 w-32" />
          <Skeleton variant="rectangle" className="h-64 w-full rounded-2xl" />
          <Skeleton variant="rectangle" className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    return (
      <div className="bg-neutral-50 dark:bg-neutral-50 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-900 mb-2">
            学位加载失败
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-600 mb-6">
            {status === 404
              ? '该学位不存在或已下架'
              : `网络错误${(error as any)?.message ? `: ${(error as any).message}` : ''}`}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="primary" size="md" onClick={() => refetch()}>
              重试
            </Button>
            <Link to="/degrees">
              <Button variant="secondary" size="md">返回学位列表</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!degree) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-50 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-900 mb-2">
            学位不存在
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-600 mb-6">
            可能链接已失效,回到学位列表看看其他选择。
          </p>
          <Link to="/degrees">
            <Button variant="primary" size="md">回到学位列表</Button>
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="bg-neutral-50 dark:bg-neutral-50 min-h-screen text-neutral-900 dark:text-neutral-900">
      {/* Top action bar */}
      <section className="bg-neutral-0 dark:bg-neutral-100 border-b border-neutral-200 dark:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/degrees"
            className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-600 hover:text-[#171717] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back To Degrees
          </Link>
        </div>
      </section>

      {/* Hero — split white + black */}
      <section className="border-b border-neutral-200 dark:border-neutral-200">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 md:p-12 lg:p-16 bg-neutral-0 dark:bg-neutral-100 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-200 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 bg-neutral-900 dark:bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest">
                Nano Degree
              </span>
              {isFree ? (
                <span className="inline-flex items-center px-2 py-0.5 border border-neutral-900 dark:border-neutral-900 text-neutral-900 dark:text-neutral-900 text-[10px] font-black uppercase tracking-widest">
                  Free
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 border border-neutral-900 dark:border-neutral-900 text-neutral-900 dark:text-neutral-900 text-[10px] font-black uppercase tracking-widest">
                  ¥{degree.price}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600">
                <Sparkles className="w-3 h-3" /> {degree.stats?.estimatedHours ?? 0}h
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] mb-6 break-words">
              {degree.title}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-600 text-lg leading-relaxed mb-8 max-w-2xl">
              {degree.description}
            </p>

            <div className="grid grid-cols-4 border-t border-neutral-200 dark:border-neutral-200">
              <div className="py-5 border-r border-neutral-200 dark:border-neutral-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-1">Courses</div>
                <div className="text-2xl font-black tracking-tighter">{degree.stats?.courseCount ?? degree.courses.length}</div>
              </div>
              <div className="py-5 border-r border-neutral-200 dark:border-neutral-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-1">Chapters</div>
                <div className="text-2xl font-black tracking-tighter">{degree.stats?.totalChapters ?? 0}</div>
              </div>
              <div className="py-5 border-r border-neutral-200 dark:border-neutral-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-1">Learners</div>
                <div className="text-2xl font-black tracking-tighter">{degree.stats?.totalLearners ?? 0}</div>
              </div>
              <div className="py-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-1">Hours</div>
                <div className="text-2xl font-black tracking-tighter">{degree.stats?.estimatedHours ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Right: thumbnail + CTA */}
          <div className="bg-neutral-900 dark:bg-neutral-900 text-white flex flex-col">
            <div className="aspect-[16/10] border-b border-white/20 overflow-hidden bg-neutral-800">
              {degree.thumbnail ? (
                <img
                  src={degree.thumbnail}
                  alt={degree.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <GraduationCap className="w-16 h-16 text-white/30" />
                </div>
              )}
            </div>
            <div className="p-8 md:p-12 flex flex-col gap-4">
              {enrolled ? (
                <div className="inline-flex items-center justify-between gap-3 border border-white px-6 py-4 font-black uppercase tracking-widest text-sm">
                  <CheckCircle2 className="w-4 h-4" /> 已报名,继续学习
                </div>
              ) : user ? (
                <button
                  onClick={() => setPurchaseOpen(true)}
                  className="inline-flex items-center justify-between gap-3 bg-white text-neutral-900 px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-neutral-100 transition-colors"
                >
                  <span>{isFree ? 'Free Enroll' : `Buy ¥${degree.price}`}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-between gap-3 bg-white text-neutral-900 px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-neutral-100 transition-colors"
                >
                  <span>Login to Enroll</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40 pt-2">
                {degree.courses.length} 门课程 · {degree.stats?.totalChapters ?? 0} 章节
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto scrollbar-hide">
          {[
            { key: 'overview', label: '学位概览', icon: BookOpen },
            { key: 'courses', label: `课程 (${degree.courses.length})`, icon: PlayCircle },
          ].map(({ key, label, icon: Icon }, i, arr) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`py-4 px-5 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
                  active
                    ? 'text-neutral-900 dark:text-neutral-900 border-b-2 border-neutral-900 dark:border-neutral-900 -mb-px'
                    : 'text-neutral-600 dark:text-neutral-600 hover:text-neutral-900'
                } ${i < arr.length - 1 ? 'border-r border-neutral-200 dark:border-neutral-200' : ''}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tab content */}
      <section className="border-b border-neutral-200 dark:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 dark:text-neutral-600 mb-3">
                    / 01 Overview
                  </div>
                  <p className="text-lg leading-relaxed">{degree.description}</p>
                </div>

                {learningPoints.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 dark:text-neutral-600 mb-3">
                      / 02 What You Will Learn
                    </div>
                    <div className="grid sm:grid-cols-2 gap-0 border-t border-l border-neutral-200 dark:border-neutral-200">
                      {learningPoints.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-4 border-b border-r border-neutral-200 dark:border-neutral-200 hover:bg-neutral-0 dark:hover:bg-neutral-100 transition-colors"
                        >
                          <div className="shrink-0 w-7 h-7 bg-neutral-900 dark:bg-neutral-900 text-white text-[10px] font-black flex items-center justify-center">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <span className="text-sm font-medium leading-relaxed pt-1">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* P2 增强功能占位 */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 dark:text-neutral-600 mb-3">
                    / 03 Coming Next
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {P2_PLACEHOLDERS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <div
                          key={p.title}
                          className="border border-dashed border-neutral-200 dark:border-neutral-200 p-4 flex items-start gap-3 bg-neutral-0 dark:bg-neutral-100"
                        >
                          <div className="shrink-0 w-9 h-9 bg-neutral-100 dark:bg-neutral-100 flex items-center justify-center text-neutral-400">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-900">{p.title}</div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-500 mt-0.5">{p.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <div className="border border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100">
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-200">
                    <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600">学位时长</div>
                    <div className="text-lg font-black mt-1">{degree.stats?.estimatedHours ?? 0} 小时</div>
                  </div>
                  <div>
                    {degree.courses.slice(0, 5).map((c, i) => (
                      <div
                        key={c.id}
                        className={`p-4 ${i < Math.min(degree.courses.length, 5) - 1 ? 'border-b border-neutral-200 dark:border-neutral-200' : ''} hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-400 mb-1">
                          Step {String(c.stepNumber).padStart(2, '0')}
                        </div>
                        <div className="text-sm font-black tracking-tight leading-snug">{c.title}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mt-1">
                          {c.chapterCount} 章 · {c.instructor}
                        </div>
                      </div>
                    ))}
                    {degree.courses.length > 5 && (
                      <div className="p-3 text-center text-[10px] text-neutral-500 dark:text-neutral-500 border-t border-neutral-200 dark:border-neutral-200">
                        + {degree.courses.length - 5} 门课程
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div>
              {degree.courses.length === 0 ? (
                <div className="text-center py-24 text-neutral-600 dark:text-neutral-600">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
                  该学位下暂无课程
                </div>
              ) : (
                <div className="border border-neutral-200 dark:border-neutral-200">
                  {degree.courses.map((c, i) => (
                    <Link
                      key={c.id}
                      to={`/courses/${c.id}`}
                      className={`flex items-center gap-4 px-4 py-4 bg-neutral-0 dark:bg-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors group ${
                        i < degree.courses.length - 1 ? 'border-b border-neutral-200 dark:border-neutral-200' : ''
                      }`}
                    >
                      <div className="shrink-0 w-12 h-12 bg-neutral-900 dark:bg-neutral-900 text-white flex items-center justify-center font-black text-sm">
                        {String(c.stepNumber).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black tracking-tight leading-snug truncate">{c.title}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mt-1 flex items-center gap-2 flex-wrap">
                          <span>{c.chapterCount} 章</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {c.learnerCount}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {c.duration}
                          </span>
                          <span>·</span>
                          <span>{c.instructor}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <PurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        type="degree"
        itemId={degree.id}
        title={degree.title}
        price={degree.price}
        costType={degree.costType}
      />
    </div>
  );
}
