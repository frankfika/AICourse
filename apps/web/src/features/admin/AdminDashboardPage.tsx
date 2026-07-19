/**
 * AdminDashboardPage — P1-3 后台数据看板 (接真后端)
 *
 * GET /api/v1/admin/stats 返回:
 *   - 4 KPI(今日 GMV / 新增用户 / DAU / 订单总数)
 *   - 用户增长 30 天数据
 *   - 课程报名 Top 10
 *   - 学位完成率(从 totals.completionRate)
 *   - 待办计数
 *   - 系统状态(DB 状态 / API 版本)
 *
 * 4 个图表用纯 inline SVG 画(不引 recharts):
 *   - RevenueChart — 收入构成(按 costType 简化:全部 from 总订单)
 *   - UserGrowthChart — 用户增长 30 天折线
 *   - FunnelChart — 报名 / 完成 漏斗
 *   - DegreePieChart — 收入饼图
 *
 * 处理:
 *   - isLoading → Skeleton 4 个 KPI + 4 个图表
 *   - isError → QueryErrorState + 重试
 *   - 空数据 → "暂无数据" 占位
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sun,
  Moon,
  ScrollText,
  FileText,
  Sparkles as SparklesIcon,
  MessageCircle,
  Megaphone,
  FilePlus2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { QueryErrorState } from '../../components/QueryErrorState';
import { useTheme, useThemeStore } from '../../stores/themeStore';
import { adminApi, type AdminKpi } from '../../lib/adminApi';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-neutral-400',
};

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success-500',
  warning: 'text-warning-500',
  danger: 'text-danger-500',
  info: 'text-info-500',
  neutral: 'text-neutral-600',
};

// =============================================================
// Sparkline 组件
// =============================================================
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const w = 100;
  const h = 24;
  const stepX = w / Math.max(points.length - 1, 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - (p / max) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full h-6" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// =============================================================
// 主页面
// =============================================================
export function AdminDashboardPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const theme = useTheme();
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 60_000, // 1 分钟自动刷新
  });

  return (
    <div className="space-y-6">
      {/* ─── 顶部 ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">数据看板</h1>
          <p className="text-sm text-neutral-600 mt-0.5">
            实时数据 · 自动每 60 秒刷新
            {data?.system.database === 'down' && (
              <span className="ml-2 text-danger-500">· DB 异常</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100 text-xs">
            {(['today', '7d', '30d', 'custom'] as const).map((p) => {
              const label = p === 'today' ? '今日' : p === '7d' ? '7 天' : p === '30d' ? '30 天' : '自定义';
              const active = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1 rounded transition-colors',
                    active
                      ? 'bg-neutral-0 font-medium text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            aria-label="切换主题"
            leftIcon={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          >
            {isDark ? '浅色' : '深色'}
          </Button>
        </div>
      </div>

      {/* ─── 错误态 ─── */}
      {isError && <QueryErrorState error={error} onRetry={refetch} />}

      {/* ─── 4 KPI 卡 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} padding="md">
                <Skeleton className="h-3 w-1/2 mb-3" />
                <Skeleton className="h-8 w-2/3 mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </Card>
            ))
          : data?.kpis.map((k) => <KpiCard key={k.label} kpi={k} />)}
      </div>

      {/* ─── 4 图表 2x2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading || !data ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <RevenueChart
              totalGmv={Number(
                data.kpis.find((k) => k.label === '今日 GMV')?.value.replace(/[¥, ]/g, '') ?? '0',
              )}
            />
            <UserGrowthChart growth={data.userGrowth} />
            <FunnelChart
              active={data.totals.activeEnrollments}
              completed={data.totals.completedEnrollments}
            />
            <DegreePieChart topCourses={data.topCourses} />
          </>
        )}
      </div>

      {/* ─── 待办 + 系统状态 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 待办 */}
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900">待办事项</h3>
            <Link to="/admin/enterprise" className="text-xs text-brand-500 hover:underline">
              查看企业咨询 →
            </Link>
          </div>
          {data && (
            <div className="space-y-2">
              <TodoItem
                href="/admin/enterprise"
                title="待回复企业咨询"
                sub={`共 ${data.todos.pendingInquiries} 条新咨询, 1-2 工作日回邮`}
                chip={`${data.todos.pendingInquiries} 条`}
                chipTone={data.todos.pendingInquiries > 0 ? 'warning' : 'success'}
                dot={data.todos.pendingInquiries > 0 ? 'warning' : 'success'}
                icon={<MessageCircle className="w-3.5 h-3.5" />}
              />
              <TodoItem
                href="/admin/courses"
                title="草稿课程待发布"
                sub={`共 ${data.todos.draftCourses} 门草稿, 需审核后发布`}
                chip={`${data.todos.draftCourses} 门`}
                chipTone={data.todos.draftCourses > 0 ? 'info' : 'success'}
                dot={data.todos.draftCourses > 0 ? 'info' : 'success'}
                icon={<FilePlus2 className="w-3.5 h-3.5" />}
              />
              <TodoItem
                href="/admin/hackathons"
                title="本周新发布黑客松"
                sub="查看时间线、状态、参赛队伍"
                chip="查看"
                chipTone="info"
                dot="info"
                icon={<Megaphone className="w-3.5 h-3.5" />}
              />
              <TodoItem
                href="/admin/audit"
                title="审计日志"
                sub="操作记录追踪(admin 权限)"
                chip="Phase 2+"
                chipTone="neutral"
                dot="neutral"
                icon={<ScrollText className="w-3.5 h-3.5" />}
              />
            </div>
          )}
        </Card>

        {/* 系统状态 */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900">系统状态</h3>
            <ScrollText className="w-4 h-4 text-neutral-400" />
          </div>
          {data && (
            <div className="space-y-3 text-sm">
              <SystemRow
                name="数据库"
                value={data.system.database === 'ok' ? '正常' : '异常'}
                tone={data.system.database === 'ok' ? 'success' : 'danger'}
                dot={data.system.database === 'ok' ? 'success' : 'danger'}
              />
              <SystemRow
                name="API 版本"
                value={data.system.apiVersion}
                tone="neutral"
                dot="success"
              />
              <SystemRow
                name="总用户"
                value={data.totals.users.toLocaleString()}
                tone="neutral"
                dot="success"
              />
              <SystemRow
                name="总课程"
                value={data.totals.courses.toLocaleString()}
                tone="neutral"
                dot="success"
              />
              <SystemRow
                name="报名完成率"
                value={`${data.totals.completionRate.toFixed(1)}%`}
                tone={data.totals.completionRate >= 50 ? 'success' : 'warning'}
                dot={data.totals.completionRate >= 50 ? 'success' : 'warning'}
              />
              <div className="pt-3 mt-3 border-t border-neutral-200 flex items-center gap-2 text-xs text-neutral-600">
                <FileText className="w-3.5 h-3.5" />
                <span>审计日志:</span>
                <Link to="/admin/audit" className="text-brand-500 hover:underline">
                  查看 →
                </Link>
              </div>
            </div>
          )}
          <Link
            to="/admin/courses"
            className="mt-4 block text-center text-xs text-brand-500 hover:underline"
          >
            查看课程管理 →
          </Link>
        </Card>
      </div>
    </div>
  );
}

// =============================================================
// 子组件
// =============================================================
function KpiCard({ kpi }: { kpi: AdminKpi }) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between text-xs text-neutral-600">
        <span>{kpi.label}</span>
        {kpi.deltaTone === 'up' && (
          <span className="text-success-500 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            {kpi.delta}
          </span>
        )}
        {kpi.deltaTone === 'down' && (
          <span className="text-danger-500 flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3" />
            {kpi.delta}
          </span>
        )}
        {kpi.deltaTone === 'warning' && (
          <span className="text-warning-500 flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            预算 {kpi.delta}
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-bold font-mono text-neutral-900">{kpi.value}</div>
      <div className="mt-1 text-xs text-neutral-600">{kpi.sub}</div>
    </Card>
  );
}

function TodoItem({
  href,
  title,
  sub,
  chip,
  chipTone,
  dot,
  icon,
}: {
  href: string;
  title: string;
  sub: string;
  chip: string;
  chipTone: Tone;
  dot: Tone;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
    >
      <span
        className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center',
          TONE_DOT[dot].replace('bg-', 'bg-').replace('500', '100'),
        )}
      >
        <span className={TONE_TEXT[dot]}>{icon}</span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 truncate">{title}</div>
        <div className="text-xs text-neutral-600">{sub}</div>
      </div>
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded',
          chipTone === 'warning' && 'bg-warning-100 text-warning-500',
          chipTone === 'info' && 'bg-info-100 text-info-500',
          chipTone === 'success' && 'bg-success-100 text-success-500',
          chipTone === 'danger' && 'bg-danger-100 text-danger-500',
          chipTone === 'neutral' && 'bg-neutral-100 text-neutral-600',
        )}
      >
        {chip}
      </span>
    </Link>
  );
}

function SystemRow({
  name,
  value,
  tone,
  dot,
}: {
  name: string;
  value: string;
  tone: Tone;
  dot: Tone;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-neutral-900">
        <span className={cn('w-2 h-2 rounded-full', TONE_DOT[dot])} aria-hidden="true" />
        <span>{name}</span>
      </div>
      <span className={cn('font-mono text-xs', TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card padding="md">
      <Skeleton className="h-3 w-1/4 mb-3" />
      <Skeleton variant="rectangle" className="h-32 w-full" />
    </Card>
  );
}

// =============================================================
// 4 图表(简化版)
// =============================================================
function RevenueChart({ totalGmv }: { totalGmv: number }) {
  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">今日收入</h3>
      <p className="text-xs text-neutral-600 mt-0.5">按订单状态分布</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-bold font-mono text-neutral-900">
            ¥ {totalGmv.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-600 mt-1">今日已支付 GMV</div>
        </div>
        <div className="flex flex-col items-end justify-center gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-500" />
            <span className="text-neutral-600">已支付</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning-500" />
            <span className="text-neutral-600">待支付</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function UserGrowthChart({ growth }: { growth: { date: string; count: number }[] }) {
  if (growth.length === 0) {
    return (
      <Card padding="md">
        <h3 className="font-semibold text-sm text-neutral-900">用户增长(30 天)</h3>
        <p className="text-sm text-neutral-600 mt-6 text-center">暂无新增用户</p>
      </Card>
    );
  }
  const max = Math.max(...growth.map((g) => g.count), 1);
  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">用户增长(30 天)</h3>
      <p className="text-xs text-neutral-600 mt-0.5">共 {growth.reduce((s, g) => s + g.count, 0)} 人</p>
      <svg viewBox="0 0 300 100" className="mt-4 w-full h-32" preserveAspectRatio="none">
        {growth.map((g, i) => {
          const x = (i / Math.max(growth.length - 1, 1)) * 300;
          const h = (g.count / max) * 90;
          return (
            <rect
              key={g.date}
              x={x - 4}
              y={100 - h}
              width={8}
              height={h}
              fill="var(--brand-500-rgb)"
              opacity={0.6}
            />
          );
        })}
      </svg>
    </Card>
  );
}

function FunnelChart({ active, completed }: { active: number; completed: number }) {
  const total = active + completed;
  const rate = total > 0 ? (completed / total) * 100 : 0;
  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">报名完成率</h3>
      <p className="text-xs text-neutral-600 mt-0.5">{total.toLocaleString()} 总报名</p>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">进行中</span>
          <span className="font-mono text-neutral-900">{active.toLocaleString()}</span>
        </div>
        <div className="h-3 rounded-full bg-neutral-100 overflow-hidden flex">
          <div
            className="h-full bg-success-500"
            style={{ width: `${rate}%` }}
          />
          <div
            className="h-full bg-warning-500"
            style={{ width: `${100 - rate}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">已完成</span>
          <span className="font-mono text-neutral-900">
            {completed.toLocaleString()} ({rate.toFixed(1)}%)
          </span>
        </div>
      </div>
    </Card>
  );
}

function DegreePieChart({
  topCourses,
}: {
  topCourses: { id: string; title: string; enrollmentCount: number }[];
}) {
  const total = topCourses.reduce((s, c) => s + c.enrollmentCount, 0);
  if (total === 0) {
    return (
      <Card padding="md">
        <h3 className="font-semibold text-sm text-neutral-900">课程报名 Top</h3>
        <p className="text-sm text-neutral-600 mt-6 text-center">暂无报名数据</p>
      </Card>
    );
  }
  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">课程报名 Top {topCourses.length}</h3>
      <p className="text-xs text-neutral-600 mt-0.5">共 {total.toLocaleString()} 报名</p>
      <div className="mt-4 space-y-1.5 text-xs">
        {topCourses.slice(0, 5).map((c) => {
          const pct = (c.enrollmentCount / total) * 100;
          return (
            <div key={c.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0 truncate text-neutral-900">{c.title}</div>
              <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-12 text-right font-mono text-neutral-600">
                {c.enrollmentCount}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
