/**
 * DegreeDetailPage — P1-4 落地版
 *
 * 严格按 review/redesign-spec.md §7.2 P1-4:
 *   - 大封面 hero(学位名 + 副标题 + 4 数据点 + 立即报名 CTA)
 *   - 路径图(核心,全新) — 3-4 阶段横向时间线 + SVG 箭头 + 锁图标
 *   - 学习路径:排名图 + 课程矩阵
 *   - 学位认证:证书预览 + 完成要求 + OpenCSG logo
 *   - 讲师墙:2-3 讲师 + 简介
 *   - 学员评价:P1-3 Review 还没建,先 inline 简化版 list
 *   - 右侧 sticky(lg+):立即报名 + 包含什么
 *
 * 设计系统(从 P0-4 tokens 拿):
 *   - 主色:brand-500 #1D8C80(OpenCSG 深青绿)
 *   - 中性:neutral-0..950(暗色走 class="dark" 翻转)
 *   - 阶段配色:brand / xp / cert / success 4 个 token 调色
 *   - 阴影:shadow-sm 默认,hover 升 shadow-md,主 CTA 升 shadow-glow
 *
 * 响应式 3 断点:
 *   - < sm (375): 路径图纵向(4 阶段竖排,连接线下箭头)
 *   - sm-md (768-1023): 路径图横向缩略(2 阶段一行,横滚)
 *   - lg+ (1280): 路径图横向完整(4 阶段一行)
 *
 * 已知偏离:
 *   - P1-3 Review 组件未建,先 inline 评价 list(用同一段样式,等 P1-3 抽
 *     出 ReviewsPage / ReviewsSection 后替换 import)
 *   - 路径图 SVG 用纯内联,按 spec 不引 framer-motion;hover/状态变化走
 *     Tailwind transition-colors + transform
 */

import { useMemo, useState } from 'react';
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
  Trophy,
  ArrowUpRight,
  Lock,
  PlayCircle,
  Star,
  ShieldCheck,
  Quote,
  ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { NanoDegreeWithPath } from '@opencsg/shared-types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { PurchaseModal } from './PurchaseModal';
import {
  computeStageProgress,
  computeOverallPercent,
  getDegreePathMeta,
  STAGE_COLOR_TOKENS,
  type StageProgress,
} from './degreeMockData';
import { cn } from '../../lib/cn';

// =============================================================
// 学位 mock 进度 — P1-4 临时方案
// 后端 progress / enrollment API 还没把"学位级"暴露出来,这里前端 hardcode
// 假数据。等 P2 接进来后改成 useQuery(['degree-progress', id])。
// key = "AI 工程师基础" 阶段 1 完成 3/4,阶段 2 完成 0/1(解锁中)。
// =============================================================
const MOCK_COMPLETED_COURSE_IDS_BY_DEGREE: Record<string, Set<string>> = {
  d1: new Set(['c1', 'c2', 'c3']), // 基础阶段 3 必修完成,c4 选修未开始
  d2: new Set(['c4']),
  d3: new Set([]),
};

// =============================================================
// 组件:进度环(简化版 — P0-6 ProgressRing 是 0-100 数字,这里要 svg 圆环)
// =============================================================
function ProgressRingSvg({
  percent,
  size = 56,
  strokeWidth = 5,
  trackClass = 'text-neutral-200 dark:text-neutral-200',
  fillClass = 'text-brand-500',
  label,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  trackClass?: string;
  fillClass?: string;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={fillClass}
        />
      </svg>
      <span
        className="absolute font-mono font-semibold text-neutral-900 dark:text-neutral-900"
        style={{ fontSize: size * 0.28 }}
      >
        {label ?? `${clamped}%`}
      </span>
    </div>
  );
}

// =============================================================
// 组件:星级(1-5)
// =============================================================
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'shrink-0',
            i < rating
              ? 'fill-cert-500 text-cert-500'
              : 'text-neutral-200 dark:text-neutral-200',
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

// =============================================================
// 组件:阶段卡(单个节点 — desktop 横向 / mobile 纵向复用)
// =============================================================
function StageCard({
  sp,
  isLast,
  isMobile,
  allCourses,
}: {
  sp: StageProgress;
  isLast: boolean;
  isMobile: boolean;
  allCourses: NanoDegreeWithPath['courses'];
}) {
  const { stage, status, completed, total } = sp;
  const token = STAGE_COLOR_TOKENS[stage.colorHint];
  const stageCourses = stage.courseIds
    .map((id) => allCourses.find((c) => c.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className={cn('relative', isMobile ? 'pl-12 pb-8 last:pb-0' : 'flex-1 min-w-0')}>
      {/* 连接线 / 箭头(纵向:左侧下箭头;横向:右侧箭头) */}
      {!isLast && (
        <>
          {/* 桌面端横向箭头 */}
          <div
            className="hidden md:block absolute top-7 -right-3 z-10 text-neutral-200 dark:text-neutral-200"
            aria-hidden="true"
          >
            <ChevronRight className="w-6 h-6" />
          </div>
          {/* 移动端纵向箭头 */}
          <div
            className="md:hidden absolute left-5 top-12 bottom-0 w-px bg-neutral-200 dark:bg-neutral-200"
            aria-hidden="true"
          />
          <div
            className="md:hidden absolute left-3.5 bottom-0 text-neutral-400"
            aria-hidden="true"
          >
            <ChevronRight className="w-4 h-4 -rotate-90" />
          </div>
        </>
      )}

      {/* 节点圆 + 阶段序号 */}
      <div className={cn('flex items-start gap-3', isMobile ? '' : 'flex-col')}>
        {/* 圆节点 */}
        <div className="relative shrink-0">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm transition-all',
              status === 'completed' && token.solid,
              status === 'in_progress' && cn('bg-neutral-0 dark:bg-neutral-100 border-2', token.border, token.text),
              status === 'locked' && 'bg-neutral-200 dark:bg-neutral-200 text-neutral-400',
              status === 'available' && cn('bg-neutral-0 dark:bg-neutral-100 border-2', token.border, token.text),
            )}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : status === 'locked' ? (
              <Lock className="w-4 h-4" />
            ) : (
              stage.courseIds.length > 0 ? completed + 1 : '·'
            )}
          </div>
          {status === 'in_progress' && (
            <span
              className={cn(
                'absolute inset-0 rounded-full ring-4 animate-pulse',
                token.ring,
              )}
              aria-hidden="true"
            />
          )}
        </div>

        {/* 文字区 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                'text-[10px] font-mono uppercase tracking-widest font-bold',
                status === 'locked' ? 'text-neutral-400' : token.text,
              )}
            >
              Stage {stage.name}
            </span>
            {status === 'in_progress' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500 text-neutral-0 font-medium">
                进行中
              </span>
            )}
            {status === 'completed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-500 text-neutral-0 font-medium">
                已完成
              </span>
            )}
            {status === 'locked' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-200 text-neutral-600 font-medium">
                未解锁
              </span>
            )}
          </div>
          <h3
            className={cn(
              'font-bold text-base leading-tight',
              status === 'locked' ? 'text-neutral-400' : 'text-neutral-900 dark:text-neutral-900',
            )}
          >
            {stage.title}
          </h3>
          <p
            className={cn(
              'mt-1 text-xs leading-relaxed',
              status === 'locked' ? 'text-neutral-400' : 'text-neutral-600 dark:text-neutral-600',
            )}
          >
            {stage.description}
          </p>
          <div
            className={cn(
              'mt-2 flex items-center gap-3 text-[10px] font-mono',
              status === 'locked' ? 'text-neutral-400' : 'text-neutral-600 dark:text-neutral-600',
            )}
          >
            <span>{stage.estimatedHours} 小时</span>
            {total > 0 && (
              <span>
                {completed} / {total} 课
              </span>
            )}
          </div>

          {/* 课程 chip 列表 */}
          {stageCourses.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {stageCourses.map((c) => {
                // 简化:如果阶段完成,所有课都显示 done
                const done = status === 'completed' || (stage.courseIds.indexOf(c.id) < completed);
                return (
                  <li
                    key={c.id}
                    className={cn(
                      'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md',
                      done
                        ? 'bg-success-100 dark:bg-success-500/15 text-success-500'
                        : 'bg-neutral-100 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900',
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                    )}
                    <span className="truncate flex-1">{c.title}</span>
                    <span className="font-mono text-[10px] opacity-70 shrink-0">
                      {c.duration}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {stageCourses.length === 0 && (
            <div className="mt-3 px-2.5 py-2 rounded-md border border-dashed border-cert-500/30 text-xs text-cert-500">
              🏆 端到端项目,通过评审即获证书
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// 组件:路径图(Section)— 横向 + 移动竖排
// =============================================================
function PathDiagram({
  stages,
  sp,
  allCourses,
}: {
  stages: ReturnType<typeof getDegreePathMeta>['stages'];
  sp: StageProgress[];
  allCourses: NanoDegreeWithPath['courses'];
}) {
  return (
    <div className="relative">
      {/* 移动端:纵向(每阶段一行,连接线下箭头) */}
      <div className="md:hidden">
        {sp.map((s, i) => (
          <StageCard
            key={s.stage.id}
            sp={s}
            isLast={i === sp.length - 1}
            isMobile
            allCourses={allCourses}
          />
        ))}
      </div>
      {/* 桌面/平板:横向(2 阶段一行,溢出滚动) */}
      <div className="hidden md:flex md:gap-6 md:overflow-x-auto md:pb-2 md:snap-x md:snap-mandatory">
        {sp.map((s, i) => (
          <div key={s.stage.id} className="snap-start shrink-0 w-[calc(50%-0.75rem)] lg:w-auto lg:flex-1 lg:min-w-0">
            <StageCard
              sp={s}
              isLast={i === sp.length - 1}
              isMobile={false}
              allCourses={allCourses}
            />
          </div>
        ))}
      </div>
      {/* legend 下方:整体进度 */}
      <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProgressRingSvg
            percent={computeOverallPercent(sp)}
            size={56}
            strokeWidth={5}
            fillClass="text-brand-500"
            trackClass="text-neutral-200 dark:text-neutral-200"
          />
          <div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-900">
              总体完成度 {computeOverallPercent(sp)}%
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-600">
              {stages.length} 个阶段 · {allCourses.length} 门课程 · {stages.reduce((s, x) => s + x.estimatedHours, 0)} 小时
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-success-100 dark:bg-success-500/15 text-success-500">
            <CheckCircle2 className="w-3 h-3" /> 已完成
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-500">
            <PlayCircle className="w-3 h-3" /> 进行中
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-100 text-neutral-600">
            <Lock className="w-3 h-3" /> 未解锁
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// 组件:排名图(同 10 学员进度条对比)
// =============================================================
function LeaderboardChart({
  data,
  myPercent,
}: {
  data: ReturnType<typeof getDegreePathMeta>['leaderboard'];
  myPercent: number;
}) {
  const max = Math.max(...data.map((d) => d.percent), myPercent, 1);
  return (
    <div className="space-y-2.5">
      {/* 我的位置(高亮) */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-brand-50 dark:bg-brand-900/20 border border-brand-500/30">
        <span className="w-7 h-7 rounded-full bg-brand-500 text-neutral-0 text-xs font-bold flex items-center justify-center font-mono shrink-0">
          你
        </span>
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 flex-1">
          你(当前)
        </span>
        <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-200 overflow-hidden max-w-[200px]">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${(myPercent / max) * 100}%` }}
          />
        </div>
        <span className="text-xs font-mono font-semibold text-brand-500 w-10 text-right">
          {myPercent}%
        </span>
      </div>
      {/* 10 学员对比 */}
      {data.map((row) => (
        <div key={row.rank} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors">
          <span
            className={cn(
              'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center font-mono shrink-0',
              row.rank === 1
                ? 'bg-cert-500 text-neutral-900'
                : row.rank <= 3
                  ? 'bg-cert-100 dark:bg-cert-500/20 text-cert-500'
                  : 'bg-neutral-200 dark:bg-neutral-200 text-neutral-600',
            )}
          >
            {row.rank}
          </span>
          <span className="text-sm text-neutral-900 dark:text-neutral-900 flex-1 truncate">
            {row.name}
          </span>
          <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-200 overflow-hidden max-w-[200px]">
            <div
              className={cn(
                'h-full transition-all',
                row.rank === 1 ? 'bg-cert-500' : 'bg-neutral-400',
              )}
              style={{ width: `${(row.percent / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-neutral-600 w-10 text-right">
            {row.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}

// =============================================================
// 组件:课程矩阵(table)
// =============================================================
function CourseMatrix({
  courses,
  courseMeta,
  completedIds,
}: {
  courses: NanoDegreeWithPath['courses'];
  courseMeta: ReturnType<typeof getDegreePathMeta>['courseMeta'];
  completedIds: Set<string>;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-50 text-neutral-600 dark:text-neutral-600">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-xs">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">课程</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs hidden sm:table-cell">难度</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs hidden md:table-cell">时长</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">学分</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">类型</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">状态</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c, i) => {
              const meta = courseMeta[c.id] ?? { isRequired: true, credits: 0 };
              const done = completedIds.has(c.id);
              return (
                <tr
                  key={c.id}
                  className="border-t border-neutral-200 dark:border-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/courses/${c.id}`}
                      className="font-medium text-neutral-900 dark:text-neutral-900 hover:text-brand-500 transition-colors"
                    >
                      {c.title}
                    </Link>
                    <div className="text-xs text-neutral-600 dark:text-neutral-600 mt-0.5 sm:hidden">
                      {c.level} · {c.duration}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900">
                      {c.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-neutral-600 dark:text-neutral-600 font-mono">
                    {c.duration}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-neutral-900 dark:text-neutral-900">
                    {meta.credits}
                  </td>
                  <td className="px-4 py-3">
                    {meta.isRequired ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500 text-neutral-0 font-medium">
                        必修
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-200 text-neutral-600 font-medium">
                        选修
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 完成
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                        <PlayCircle className="w-3.5 h-3.5" /> 未开始
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================
// 组件:证书预览(纯 SVG,无外部资源)
// =============================================================
function CertificatePreview({
  degreeTitle,
  signer,
  signerTitle,
  skills,
}: {
  degreeTitle: string;
  signer: string;
  signerTitle: string;
  skills: string[];
}) {
  return (
    <Card variant="outlined" padding="none" className="overflow-hidden">
      <div className="relative aspect-[1.414/1] bg-gradient-to-br from-neutral-0 to-brand-50 dark:from-neutral-100 dark:to-neutral-100 p-6 sm:p-8 flex flex-col">
        {/* 装饰边角 */}
        <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-brand-500" />
        <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-brand-500" />
        <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-brand-500" />
        <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-brand-500" />

        {/* OpenCSG logo / 标题 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand-500 flex items-center justify-center text-neutral-0 text-xs font-bold">
            O
          </div>
          <div>
            <div className="text-xs font-mono tracking-widest text-brand-500 font-bold">
              OPENCSG ACADEMY
            </div>
            <div className="text-[10px] text-neutral-600 dark:text-neutral-600">
              Nano Degree Certificate
            </div>
          </div>
        </div>

        {/* 主文 */}
        <div className="mt-auto">
          <div className="text-[10px] font-mono tracking-widest text-neutral-600 dark:text-neutral-600">
            CERTIFICATE OF COMPLETION
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-900 leading-tight">
            {degreeTitle}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-500"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* 签名 */}
        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-200 flex items-end justify-between">
          <div>
            <div className="font-mono italic text-sm text-neutral-900 dark:text-neutral-900">
              {signer}
            </div>
            <div className="text-[10px] text-neutral-600 dark:text-neutral-600">
              {signerTitle}
            </div>
          </div>
          <Trophy className="w-7 h-7 text-cert-500" />
        </div>
      </div>
    </Card>
  );
}

// =============================================================
// 主页面
// =============================================================
export function DegreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'path' | 'courses' | 'reviews'>('path');

  // 1) 拉真学位详情
  const { data: degree, isLoading } = useQuery({
    queryKey: ['degree', id],
    queryFn: async () => {
      const { data } = await api.get<NanoDegreeWithPath>(`/api/v1/degrees/${id}`);
      return data;
    },
    enabled: !!id,
    retry: 1,
  });

  // 2) 拉我的报名 — P0 时已建,但目前只返"course 级",学位级先 mock
  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/v1/enrollments/me');
        return data as Array<{ id: string; degreeId?: string | null; courseId?: string | null }>;
      } catch {
        return [] as Array<{ id: string; degreeId?: string | null; courseId?: string | null }>;
      }
    },
    enabled: !!user,
    retry: 0,
  });

  // 派生数据
  const meta = useMemo(() => (id ? getDegreePathMeta(id) : null), [id]);
  const completedIds = useMemo(
    () => (id ? MOCK_COMPLETED_COURSE_IDS_BY_DEGREE[id] ?? new Set<string>() : new Set<string>()),
    [id],
  );
  const stageProgress = useMemo<StageProgress[]>(
    () => (meta ? computeStageProgress(meta.stages, completedIds) : []),
    [meta, completedIds],
  );
  const overallPercent = useMemo(() => computeOverallPercent(stageProgress), [stageProgress]);

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
  if (!degree) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-900 mb-2">学位不存在</h2>
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
  if (!meta) return null;

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
      {/* ===== Top action bar ===== */}
      <section className="bg-neutral-0 dark:bg-neutral-100 border-b border-neutral-200 dark:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/degrees"
            className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-600 hover:text-brand-500 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back To Degrees
          </Link>
        </div>
      </section>

      {/* ===== Hero ===== */}
      <section className="relative bg-neutral-900 dark:bg-neutral-900 text-neutral-0 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-500 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-xp-500 blur-3xl opacity-50" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-500 text-neutral-0 text-[10px] font-mono uppercase tracking-widest font-bold">
              <Sparkles className="w-3 h-3" /> Nano Degree
            </span>
            {meta.level === 'bachelor' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-0 border border-neutral-800/50 font-medium">
                本科学位
              </span>
            )}
            {meta.level === 'master' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-xp-500 text-neutral-0 font-medium">
                研究生学位
              </span>
            )}
            {meta.level === 'phd' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cert-500 text-neutral-900 font-medium">
                博士方向
              </span>
            )}
            <span className="text-[10px] text-neutral-400 font-mono">
              / {meta.durationLabel} · 难度 {'★'.repeat(meta.difficulty) + '☆'.repeat(5 - meta.difficulty)}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-display-lg text-neutral-0 max-w-4xl leading-[1.05]">
            {degree.title}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-neutral-400 max-w-3xl leading-relaxed">
            {degree.description}
          </p>

          {/* 4 数据点 */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-800/50 border border-neutral-800/50 rounded-xl overflow-hidden">
            {[
              { icon: BookOpen, label: 'Courses', value: `${degree.stats.courseCount}` },
              { icon: GraduationCap, label: 'Chapters', value: `${degree.stats.totalChapters}` },
              { icon: Clock, label: 'Hours', value: `${degree.stats.estimatedHours}` },
              { icon: Users, label: 'Learners', value: `${degree.stats.totalLearners.toLocaleString()}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-neutral-900/50 backdrop-blur p-4 sm:p-6">
                <Icon className="w-5 h-5 mb-3 text-brand-300" />
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
                  {label}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-neutral-0">{value}</div>
              </div>
            ))}
          </div>

          {/* 学员路径状态(已报名时显示) */}
          {enrolled && (
            <div className="mt-8 flex flex-wrap items-center gap-4 p-4 rounded-xl bg-neutral-800/40 border border-brand-500/30">
              <ProgressRingSvg
                percent={overallPercent}
                size={64}
                strokeWidth={5}
                fillClass="text-brand-300"
                trackClass="text-neutral-800"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-0 font-medium">你在该学位的进度</div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {stageProgress.filter((s) => s.status === 'completed').length} / {stageProgress.length} 阶段完成
                  {stageProgress.find((s) => s.status === 'in_progress') && (
                    <> · 当前:<span className="text-brand-300">{stageProgress.find((s) => s.status === 'in_progress')?.stage.title}</span></>
                  )}
                </div>
              </div>
              <Link to="/dashboard/degrees">
                <Button variant="primary" size="sm">查看完整进度</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== 主体:左 8 / 右 4(sticky) ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-12">
          {/* === 1) 学习成果(学完你能) === */}
          {learningPoints.length > 0 && (
            <div>
              <SectionHeader eyebrow="01 Outcomes" title="学完你能" />
              <div className="mt-6 grid sm:grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-200 border border-neutral-200 dark:border-neutral-200 rounded-xl overflow-hidden">
                {learningPoints.map((p, i) => (
                  <div
                    key={i}
                    className="bg-neutral-0 dark:bg-neutral-100 p-5 flex items-start gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-md bg-brand-500 text-neutral-0 text-sm font-bold flex items-center justify-center font-mono">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <span className="text-sm leading-relaxed pt-1 text-neutral-900 dark:text-neutral-900">
                      {p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === 2) 路径图 / 课程矩阵 / 评价 — Tabs === */}
          <div>
            <SectionHeader
              eyebrow="02 Curriculum"
              title="学位路径"
              rightSlot={
                <div className="flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-100 p-1">
                  {(
                    [
                      { key: 'path', label: '路径图' },
                      { key: 'courses', label: `课程(${degree.courses.length})` },
                      { key: 'reviews', label: `评价(${meta.reviews.length})` },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                        activeTab === t.key
                          ? 'bg-neutral-0 dark:bg-neutral-100 text-brand-500 shadow-sm'
                          : 'text-neutral-600 dark:text-neutral-600 hover:text-brand-500',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              }
            />

            {activeTab === 'path' && (
              <div className="mt-6">
                <PathDiagram stages={meta.stages} sp={stageProgress} allCourses={degree.courses} />
              </div>
            )}

            {activeTab === 'courses' && (
              <div className="mt-6 space-y-6">
                <CourseMatrix
                  courses={degree.courses}
                  courseMeta={meta.courseMeta}
                  completedIds={completedIds}
                />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 mb-3">
                    同伴进度对比(Top 10)
                  </h3>
                  <LeaderboardChart data={meta.leaderboard} myPercent={overallPercent} />
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="mt-6 space-y-4">
                {/* 评分概览 */}
                <Card variant="outlined" padding="md" className="flex flex-wrap items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-neutral-900 dark:text-neutral-900 font-mono">
                      {(meta.reviews.reduce((s, r) => s + r.rating, 0) / meta.reviews.length).toFixed(1)}
                    </div>
                    <Stars
                      rating={Math.round(
                        meta.reviews.reduce((s, r) => s + r.rating, 0) / meta.reviews.length,
                      )}
                    />
                    <div className="text-[10px] text-neutral-600 dark:text-neutral-600 mt-1 font-mono">
                      {meta.reviews.length} 条评价
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px] text-xs text-neutral-600 dark:text-neutral-600 leading-relaxed">
                    <Quote className="w-4 h-4 text-brand-500 inline mr-1" />
                    学员对这个学位的整体评价集中在「项目含金量」「讲师实战背景」和「选修课设计」三个维度。96% 的学员认为毕业后能独立完成端到端 AI 应用。
                  </div>
                </Card>
                {/* 评价 list */}
                {meta.reviews.map((r) => (
                  <Card key={r.id} variant="outlined" padding="md">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-xp-500 text-neutral-0 text-sm font-bold flex items-center justify-center shrink-0">
                        {r.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-900">
                            {r.user}
                          </span>
                          <Stars rating={r.rating} size={12} />
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {r.date}
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-900">
                          {r.title}
                        </h4>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-600 leading-relaxed">
                          {r.body}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* === 3) 学位认证 === */}
          <div>
            <SectionHeader eyebrow="03 Certificate" title="学位认证" />
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <CertificatePreview
                degreeTitle={degree.title}
                signer={meta.certificate.signer}
                signerTitle={meta.certificate.signerTitle}
                skills={meta.certificate.skills}
              />
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 mb-3">
                  完成学位的要求
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {meta.stages.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-neutral-900 dark:text-neutral-900">
                      <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-medium">{s.title}:</span>{' '}
                        <span className="text-neutral-600 dark:text-neutral-600">
                          {s.courseIds.length === 0
                            ? '提交并通过端到端毕业项目'
                            : `完成 ${s.requiredCount} 门必修课(共 ${s.courseIds.length} 门可选)`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-start gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-xs text-neutral-900 dark:text-neutral-900">
                  <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    证书由 <strong>OpenCSG Academy</strong> 颁发,支持 LinkedIn / 简历直接验证;
                    区块链存证(2026 Q3 上线)。
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* === 4) 讲师墙 === */}
          <div>
            <SectionHeader eyebrow="04 Instructors" title="导师天团" />
            <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {meta.instructors.map((ins) => (
                <Card key={ins.id} variant="outlined" padding="md" className="hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full bg-gradient-to-br text-neutral-0 text-lg font-bold flex items-center justify-center shrink-0',
                        ins.gradientFrom,
                        ins.gradientTo,
                      )}
                    >
                      {ins.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 truncate">
                        {ins.name}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-600 truncate">
                        {ins.title}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-600 leading-relaxed">
                    {ins.bio}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 右侧 sticky(lg+) ===== */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card variant="elevated" padding="lg">
              <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-1">
                {isFree ? 'Free Program' : 'Tuition'}
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-900 mb-1">
                {isFree ? '免费' : `¥${Number(degree.price).toFixed(2)}`}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-600 mb-5">
                含 {meta.certificate.skills.length} 项核心技能 · {meta.durationLabel} 体系化
              </div>
              {enrolled ? (
                <Link to="/dashboard/degrees" className="block">
                  <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowUpRight className="w-4 h-4" />}>
                    已报名,继续学习
                  </Button>
                </Link>
              ) : user ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => setPurchaseOpen(true)}
                  rightIcon={<ArrowUpRight className="w-4 h-4" />}
                >
                  {isFree ? '免费报名' : '立即购买'}
                </Button>
              ) : (
                <Link to="/auth/login" className="block">
                  <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowUpRight className="w-4 h-4" />}>
                    登录后报名
                  </Button>
                </Link>
              )}

              <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-200">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-3">
                  这个学位包含
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    { icon: Trophy, label: `${meta.certificate.skills.length} 项核心技能认证` },
                    { icon: BookOpen, label: `${degree.courses.length} 门体系化课程(3 必修 + 2 选修)` },
                    { icon: Users, label: '1v1 导师 1 次 + 同行评审 3 次' },
                    { icon: Sparkles, label: 'OpenCSG 学院学位证书' },
                    { icon: ArrowUpRight, label: '黑客松直通车 + 实习内推' },
                  ].map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-start gap-2 text-neutral-900 dark:text-neutral-900">
                      <Icon className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card variant="outlined" padding="md">
              <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-2">
                适合人群
              </div>
              <p className="text-sm text-neutral-900 dark:text-neutral-900 leading-relaxed">
                {meta.level === 'bachelor' &&
                  '零基础 / 转行人员:3 个月内从零到一,具备独立完成 AI 应用的工程能力。'}
                {meta.level === 'master' &&
                  '有 1-2 年经验的工程师:5 个月内具备 LLM 生产级应用的架构与评估能力。'}
                {meta.level === 'phd' &&
                  'AI 创业者 / 技术 leader:6 个月内跑通从技术到商业的完整闭环。'}
              </p>
            </Card>
          </div>
        </aside>
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

// =============================================================
// 内部小组件:SectionHeader(eyebrow + title + 右侧 slot)
// =============================================================
function SectionHeader({
  eyebrow,
  title,
  rightSlot,
}: {
  eyebrow: string;
  title: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-brand-500 mb-2">
          / {eyebrow}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-900 leading-tight">
          {title}
        </h2>
      </div>
      {rightSlot}
    </div>
  );
}
