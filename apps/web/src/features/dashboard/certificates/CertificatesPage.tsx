/**
 * CertificatesPage — P1-8 我的证书
 *
 * 设计:
 *   - 顶部: 统计 (总数 / 课程 / 学位 / 黑客松)
 *   - 4 tab: 全部 / 课程 / 学位 / 黑客松
 *   - 证书卡片网格: 缩略图(brutalist 黑底 + serial) + 标题 + 类型 + 编号 + 颁发时间 + 操作(查看/下载/验证)
 *   - 卡片 hover: 提升 shadow + 边框 #171717
 *
 * 响应式:
 *   - < sm: 1 列
 *   - md (768+): 2 列
 *   - lg (1024+): 3 列
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  ArrowLeft,
  Eye,
  Download,
  ShieldCheck,
  GraduationCap,
  Code2,
  Trophy,
} from 'lucide-react';
import type { Certificate, CertificateType } from '@ai-academy/shared-types';
import { certificatesApi } from '../../../lib/certificatesApi';
import { useToast } from '../../../components/auth/Toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Card } from '../../../components/ui/Card';
import { QueryErrorState } from '../../../components/QueryErrorState';
import { cn } from '../../../lib/cn';

type TabKey = 'all' | 'course' | 'degree' | 'hackathon';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: 'all', label: '全部', icon: <Award className="w-3.5 h-3.5" /> },
  { key: 'course', label: '课程', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { key: 'degree', label: '学位', icon: <Code2 className="w-3.5 h-3.5" /> },
  { key: 'hackathon', label: '黑客松', icon: <Trophy className="w-3.5 h-3.5" /> },
];

const TYPE_LABEL: Record<CertificateType, string> = {
  course: '课程证书',
  degree: '学位证书',
  hackathon: '参赛证书',
};

const TYPE_BG: Record<CertificateType, string> = {
  course: 'bg-gradient-to-br from-[#171717] to-[#262626]',
  degree: 'bg-gradient-to-br from-[#171717] to-[#262626]',
  hackathon: 'bg-gradient-to-br from-[#171717] to-[#262626]',
};

export function CertificatesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const { showToast } = useToast();

  const { data: certs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['certificates', 'me'],
    queryFn: () => certificatesApi.getMyCertificates(),
  });

  const filtered = useMemo(() => {
    if (activeTab === 'all') return certs;
    return certs.filter((c) => c.type === activeTab);
  }, [certs, activeTab]);

  const stats = useMemo(() => {
    return {
      all: certs.length,
      course: certs.filter((c) => c.type === 'course').length,
      degree: certs.filter((c) => c.type === 'degree').length,
      hackathon: certs.filter((c) => c.type === 'hackathon').length,
    };
  }, [certs]);

  const handleDownload = (cert: Certificate) => {
    showToast('证书已发送到你的邮箱 (mock)', 'info');
    // 静默 noop: mock
    void cert;
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 顶部 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/dashboard"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
            aria-label="返回学习中心"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-cert-500" />
            <h1 className="text-2xl font-bold">我的证书</h1>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="总证书" value={stats.all} highlight />
          <StatCard label="课程" value={stats.course} />
          <StatCard label="学位" value={stats.degree} />
          <StatCard label="黑客松" value={stats.hackathon} />
        </div>

        {/* 4 tab */}
        <div className="border-b border-neutral-200 dark:border-neutral-200 mb-6 -mx-4 sm:mx-0">
          <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
                  activeTab === t.key
                    ? 'border-[#171717] text-[#171717]'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900',
                )}
              >
                {t.icon}
                {t.label}
                <span className="text-xs text-neutral-400">
                  ({t.key === 'all' ? stats.all : stats[t.key]})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容 */}
        {isError ? (
          <QueryErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangle" className="h-72 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Award className="w-6 h-6" />}
            title={activeTab === 'all' ? '还没有证书' : `还没有${TABS.find((t) => t.key === activeTab)?.label}证书`}
            description="完成课程或学位后, 证书会自动签发到这里"
            action={
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626] transition-colors text-sm font-medium"
              >
                去完成课程
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cert) => (
              <CertificateCard
                key={cert.id}
                cert={cert}
                onDownload={() => handleDownload(cert)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 统计卡片
// ============================================================
function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card padding="md" variant="default">
      <div className="text-xs text-neutral-600 dark:text-neutral-600">{label}</div>
      <div
        className={cn(
          'mt-1 text-3xl font-bold',
          highlight ? 'text-[#171717]' : 'text-neutral-900 dark:text-neutral-900',
        )}
      >
        {value}
      </div>
    </Card>
  );
}

// ============================================================
// 证书卡片
// ============================================================
function CertificateCard({
  cert,
  onDownload,
}: {
  cert: Certificate;
  onDownload: () => void;
}) {
  const typeKey = (cert.type as CertificateType) ?? 'course';
  const issuedDate = new Date(cert.issuedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const serialShort = cert.serialNumber.replace(/^OCSG-/, '');

  return (
    <Card padding="none" variant="default" hoverable>
      {/* 证书缩略图(渐变 + serial) */}
      <div
        className={cn(
          'relative aspect-[4/3] rounded-t-xl bg-gradient-to-br flex items-center justify-center overflow-hidden',
          TYPE_BG[typeKey] ?? TYPE_BG.course,
        )}
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />
        <div className="relative text-center px-4">
          <Award className="w-10 h-10 text-white mx-auto mb-2" />
          <div className="text-white/80 text-xs font-mono tracking-wider mb-1">
            AI Academy
          </div>
          <div className="text-white text-base font-bold leading-tight">
            {TYPE_LABEL[typeKey] ?? '证书'}
          </div>
          <div className="mt-3 text-white/90 text-[10px] font-mono tracking-wider">
            {cert.serialNumber}
          </div>
        </div>
      </div>

      {/* 信息 */}
      <div className="p-4">
        <h3 className="text-sm font-semibold truncate" title={cert.title}>
          {cert.title}
        </h3>
        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-600 flex items-center gap-1.5">
          <span>编号: {serialShort}</span>
        </div>
        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-600">
          颁发: {issuedDate}
        </div>
        {cert.holderName && (
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-600">
            持证人: {cert.holderName}
          </div>
        )}

        {/* 操作 */}
        <div className="mt-3 flex items-center gap-1.5">
          <Link
            to={`/dashboard/certificates/${cert.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 h-8 px-2 text-xs font-medium rounded-md bg-[#171717] text-white hover:bg-[#262626] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            查看
          </Link>
          <button
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-1 h-8 px-2 text-xs font-medium rounded-md bg-neutral-100 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900 hover:bg-neutral-200 transition-colors"
            title="下载证书 (mock)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">下载</span>
          </button>
          <Link
            to={`/verify/${cert.serialNumber}`}
            className="inline-flex items-center justify-center gap-1 h-8 px-2 text-xs font-medium rounded-md bg-info-100 text-info-500 hover:bg-info-500/20 transition-colors"
            title="公开验证"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">验证</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}
