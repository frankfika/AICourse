/**
 * AdminDashboardPage — P0-7 后台数据看板
 *
 * 设计参考: review/mocks/mock-admin-overview.html
 *
 * 布局:
 *   - 顶部标题 + 时间段切换 + 主题切换
 *   - 4 张 KPI 卡(今日 GMV / 新增用户 / 活跃用户 / AI token 成本)
 *   - 4 张图表(收入曲线 / 用户增长 / 报名漏斗 / 学位完成率) 2x2
 *   - 待办事项(2/3 列)+ 系统状态(1/3 列)
 *
 * 图表用纯 inline SVG 画,不引 recharts(避免 5KB+ 第三方包)。
 * 4 KPI / 4 图表 / 待办 / 系统状态 全部 hardcode mock + TODO comment。
 *
 * 暗色模式:走 token (bg-neutral-* / text-neutral-* / border-neutral-*)。
 *
 * 审计 log:后端 audit module 只有 log() 没有 read API(参见
 * apps/api/src/modules/audit/audit-log.service.ts:1-24),
 * 所以"系统状态"里 "审计日志" 入口标"暂无审计日志接入"。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, useThemeStore } from '../../stores/themeStore';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sun,
  Moon,
  FileText,
  ScrollText,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

// ──────────────────────────────────────────────────────────────────────────
// Mock 数据 — TODO: 接 /api/v1/admin/stats
// ──────────────────────────────────────────────────────────────────────────

const KPI_MOCK = [
  {
    label: '今日 GMV',
    value: '¥ 84,260',
    delta: '+12.4%',
    deltaTone: 'up' as const,
    sub: '较昨日 +¥ 9,300',
    sparkline: [20, 18, 22, 15, 17, 12, 15, 8, 11, 5, 3],
    sparkColor: 'var(--brand-500-rgb)',
  },
  {
    label: '新增用户',
    value: '342',
    delta: '+6.2%',
    deltaTone: 'up' as const,
    sub: '其中付费 38 · 11.1%',
    sparkline: [22, 20, 18, 15, 17, 12, 10, 8, 6, 4, 2],
    sparkColor: 'var(--brand-500-rgb)',
  },
  {
    label: '活跃学员(DAU)',
    value: '4,128',
    delta: '-2.1%',
    deltaTone: 'down' as const,
    sub: '平均学习时长 38 min',
    sparkline: [8, 12, 10, 15, 12, 18, 15, 20, 18, 22, 25],
    sparkColor: 'var(--danger-500-rgb)',
  },
  {
    label: 'AI token 成本',
    value: '$ 1,243',
    delta: '78%',
    deltaTone: 'warning' as const,
    sub: '月度预算 $ 1,600',
    progress: 78,
  },
] as const;

const TODO_MOCK = [
  {
    href: '/admin/hackathons',
    dot: 'danger' as const,
    title: '黑客松作品待审 · Spring 2026 Agent Builders',
    sub: '12 份提交 · 距截止 4 天',
    chip: '紧急',
    chipTone: 'danger' as const,
  },
  {
    href: '/admin/users',
    dot: 'warning' as const,
    title: '退款申请待处理',
    sub: '3 单 · 最高金额 ¥ 1,200',
    chip: '3 待审',
    chipTone: 'warning' as const,
  },
  {
    href: '/admin/hackathons',
    dot: 'info' as const,
    title: '站点公告待发送',
    sub: '学位路径图 v2 上线',
    chip: '1 待发',
    chipTone: 'info' as const,
  },
  {
    href: '/admin/users',
    dot: 'success' as const,
    title: '讲师申请待审',
    sub: '2 份 · 资料齐全',
    chip: '2 待审',
    chipTone: 'success' as const,
  },
] as const;

const SYSTEM_STATUS_MOCK: { name: string; value: string; tone: Tone; dot: Tone; chip?: boolean }[] = [
  { name: 'API 健康', value: '99.98%', tone: 'success', dot: 'success' },
  { name: '数据库', value: '42ms', tone: 'neutral', dot: 'success' },
  { name: '队列深度', value: '128 / 500', tone: 'warning', dot: 'warning' },
  { name: '缓存命中', value: '94.2%', tone: 'success', dot: 'success' },
  { name: '错误率(1h)', value: '0.02%', tone: 'success', dot: 'success' },
  { name: 'Stripe webhook', value: '2 失败', tone: 'danger', dot: 'danger', chip: true },
];

// ──────────────────────────────────────────────────────────────────────────
// 小型工具组件
// ──────────────────────────────────────────────────────────────────────────

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const FUNNEL_MOCK: { label: string; count: number; pct: number; opacity: number; conv?: string }[] = [
  { label: '浏览课程详情', count: 8420, pct: 100, opacity: 30 },
  { label: '点击"立即报名"', count: 1240, pct: 14.7, conv: '14.7%', opacity: 50 },
  { label: '完成支付', count: 826, pct: 9.8, conv: '66.6%', opacity: 70 },
  { label: '开始学习', count: 742, pct: 8.8, conv: '89.8%', opacity: 100 },
];

const DEGREE_PIE: { name: string; pct: number; count: number; color: 'brand' | 'xp' | 'cert' }[] = [
  { name: 'AI 工程师基础', pct: 68, count: 280, color: 'brand' },
  { name: 'LLM 应用工程师', pct: 22, count: 91, color: 'xp' },
  { name: 'AI 创业者', pct: 10, count: 41, color: 'cert' },
];

// 30 天柱图 mock(条形高度比例)
const BAR_HEIGHTS = [
  40, 50, 45, 60, 65, 55, 75, 80, 70, 90, 85, 100, 105, 95, 115, 120, 110, 125, 135, 130, 145, 140, 150,
  145, 160, 165, 155, 170, 175, 180,
];

// ──────────────────────────────────────────────────────────────────────────
// 小型工具组件
// ──────────────────────────────────────────────────────────────────────────

const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  brand: 'bg-brand-500',
  neutral: 'bg-neutral-400',
};

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success-500',
  warning: 'text-warning-500',
  danger: 'text-danger-500',
  info: 'text-info-500',
  brand: 'text-brand-500',
  neutral: 'text-neutral-600',
};

const TONE_CHIP: Record<Tone, string> = {
  success: 'bg-success-500/10 text-success-500',
  warning: 'bg-warning-500/10 text-warning-500',
  danger: 'bg-danger-500/10 text-danger-500',
  info: 'bg-info-500/10 text-info-500',
  brand: 'bg-brand-500/10 text-brand-500',
  neutral: 'bg-neutral-200 text-neutral-600',
};

function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ' +
        TONE_CHIP[tone] +
        ' ' +
        className
      }
    >
      {children}
    </span>
  );
}

function Sparkline({
  points,
  color,
}: {
  points: readonly number[];
  color: string;
}) {
  // viewBox 0 0 100 30, points 已是 (y 值,0-30),我们从 0-30 算 path。
  // 简单做法:把 points 映射到 11 个 x 位置 0,10,20,...100
  const w = 100;
  const h = 30;
  const n = points.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const d = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  return (
    <svg
      className="mt-3 w-full h-8"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} stroke={`rgb(${color})`} strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4 张图表组件(纯 SVG inline)
// ──────────────────────────────────────────────────────────────────────────

function RevenueChart() {
  // 30d 收入曲线:3 条折线(课程/学位/企业) + 课程底色渐变
  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm text-neutral-900">收入曲线 · 30 天</h3>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-500" />课程
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-xp-500" />学位
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cert-500" />企业
          </span>
        </div>
      </div>
      <svg
        className="mt-4 w-full h-48"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dash-rev-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--brand-500-rgb))" stopOpacity="0.3" />
            <stop offset="1" stopColor="rgb(var(--brand-500-rgb))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="50" x2="600" y2="50" stroke="rgb(var(--neutral-200-rgb))" strokeDasharray="2 2" />
        <line x1="0" y1="100" x2="600" y2="100" stroke="rgb(var(--neutral-200-rgb))" strokeDasharray="2 2" />
        <line x1="0" y1="150" x2="600" y2="150" stroke="rgb(var(--neutral-200-rgb))" strokeDasharray="2 2" />
        <path
          d="M0,150 C50,140 100,135 150,120 C200,110 250,115 300,95 C350,80 400,85 450,65 C500,55 550,60 600,40 L600,200 L0,200 Z"
          fill="url(#dash-rev-fill)"
        />
        <path
          d="M0,150 C50,140 100,135 150,120 C200,110 250,115 300,95 C350,80 400,85 450,65 C500,55 550,60 600,40"
          stroke="rgb(var(--brand-500-rgb))"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M0,170 C50,160 100,150 150,145 C200,135 250,140 300,125 C350,115 400,120 450,105 C500,95 550,100 600,80"
          stroke="rgb(var(--xp-500-rgb))"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M0,185 C50,180 100,175 150,170 C200,165 250,168 300,160 C350,155 400,158 450,150 C500,145 550,148 600,140"
          stroke="rgb(var(--cert-500-rgb))"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-neutral-400 font-mono">
        <span>04.13</span>
        <span>04.20</span>
        <span>04.27</span>
        <span>05.04</span>
        <span>05.11</span>
      </div>
    </Card>
  );
}

function UserGrowthChart() {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-neutral-900">用户增长 · 30 天</h3>
        <span className="text-xs text-neutral-600">
          累计 <span className="font-mono font-medium text-neutral-900">12,432</span>
        </span>
      </div>
      <svg
        className="mt-4 w-full h-48"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="rgb(var(--brand-500-rgb))">
          {BAR_HEIGHTS.map((h, i) => (
            <rect key={i} x={i * 20} y={200 - h} width={18} height={h} rx={1} />
          ))}
        </g>
      </svg>
    </Card>
  );
}

function FunnelChart() {
  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">课程报名漏斗 · 7 天</h3>
      <div className="mt-4 space-y-3">
        {FUNNEL_MOCK.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs mb-1 text-neutral-600">
              <span>{row.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-neutral-900">{row.count.toLocaleString()}</span>
                {row.conv && <span className="text-neutral-400">{row.conv}</span>}
              </span>
            </div>
            <div className="h-6 rounded bg-brand-500/10 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded bg-brand-500"
                style={{ width: `${row.pct}%`, opacity: row.opacity / 100 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DegreePieChart() {
  // 圆环 + 3 段,百分比转 stroke-dasharray
  const total = 100;
  const offsets: number[] = [];
  let acc = 0;
  for (const seg of DEGREE_PIE) {
    offsets.push(acc);
    acc += seg.pct;
  }
  const colorMap: Record<string, string> = {
    brand: 'rgb(var(--brand-500-rgb))',
    xp: 'rgb(var(--xp-500-rgb))',
    cert: 'rgb(var(--cert-500-rgb))',
  };

  return (
    <Card padding="md">
      <h3 className="font-semibold text-sm text-neutral-900">学位完成率</h3>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="rgb(var(--neutral-200-rgb))"
              strokeWidth="3"
            />
            {DEGREE_PIE.map((seg, i) => (
              <circle
                key={seg.name}
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={colorMap[seg.color]}
                strokeWidth="3"
                strokeDasharray={`${seg.pct} ${total - seg.pct}`}
                strokeDashoffset={-offsets[i]}
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-neutral-900">412</div>
              <div className="text-[10px] text-neutral-600">总毕业</div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          {DEGREE_PIE.map((seg) => (
            <div key={seg.name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: colorMap[seg.color] }}
                aria-hidden="true"
              />
              <span className="flex-1 text-neutral-900">{seg.name}</span>
              <span className="font-mono text-neutral-600 text-xs">
                {seg.pct}% · {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 主页面
// ──────────────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  // P1-2 修复:跟 Layout / DashboardLayout 共享同一份 themeStore
  // 之前独立 useState 跟实际 <html class="dark"> 可能不一致
  const theme = useTheme();
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      {/* ─── 顶部 ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">数据看板</h1>
          <p className="text-sm text-neutral-600 mt-0.5">
            2026.05.12 (周二) · 实时数据 · 数据延迟 5 分钟
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
                  className={
                    'px-3 py-1 rounded transition-colors ' +
                    (active
                      ? 'bg-neutral-0 font-medium text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900')
                  }
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

      {/* ─── 4 KPI 卡 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_MOCK.map((k) => (
          <Card key={k.label} padding="md">
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span>{k.label}</span>
              {'deltaTone' in k && k.deltaTone === 'up' && (
                <span className="text-success-500 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {k.delta}
                </span>
              )}
              {'deltaTone' in k && k.deltaTone === 'down' && (
                <span className="text-danger-500 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" />
                  {k.delta}
                </span>
              )}
              {'deltaTone' in k && k.deltaTone === 'warning' && (
                <span className="text-warning-500 flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  预算 {k.delta}
                </span>
              )}
            </div>
            <div className="mt-2 text-3xl font-bold font-mono text-neutral-900">{k.value}</div>
            <div className="mt-1 text-xs text-neutral-600">{k.sub}</div>
            {'sparkline' in k && k.sparkline && (
              <Sparkline points={k.sparkline} color={k.sparkColor} />
            )}
            {'progress' in k && k.progress != null && (
              <div className="mt-3 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full bg-warning-500"
                  style={{ width: `${k.progress}%` }}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ─── 4 图表 2x2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart />
        <UserGrowthChart />
        <FunnelChart />
        <DegreePieChart />
      </div>

      {/* ─── 待办 + 系统状态 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 待办 */}
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900">待办事项</h3>
            <Link to="/admin/hackathons" className="text-xs text-brand-500 hover:underline">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {TODO_MOCK.map((t) => (
              <Link
                key={t.title}
                to={t.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <span
                  className={'w-2 h-2 rounded-full flex-shrink-0 ' + TONE_DOT[t.dot]}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900 truncate">{t.title}</div>
                  <div className="text-xs text-neutral-600">{t.sub}</div>
                </div>
                <Chip tone={t.chipTone}>{t.chip}</Chip>
              </Link>
            ))}
          </div>
        </Card>

        {/* 系统状态 */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900">系统状态</h3>
            <ScrollText className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-3 text-sm">
            {SYSTEM_STATUS_MOCK.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-900">
                  <span className={'w-2 h-2 rounded-full ' + TONE_DOT[s.dot]} aria-hidden="true" />
                  <span>{s.name}</span>
                </div>
                {s.chip ? (
                  <Chip tone={s.tone}>{s.value}</Chip>
                ) : (
                  <span className={'font-mono text-xs ' + TONE_TEXT[s.tone]}>{s.value}</span>
                )}
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-neutral-200 flex items-center gap-2 text-xs text-neutral-600">
              <FileText className="w-3.5 h-3.5" />
              <span>审计日志:</span>
              <span className="text-warning-500">暂无审计日志接入</span>
            </div>
          </div>
          <Link
            to="/admin/hackathons"
            className="mt-4 block text-center text-xs text-brand-500 hover:underline"
          >
            查看详细 →
          </Link>
        </Card>
      </div>
    </div>
  );
}
