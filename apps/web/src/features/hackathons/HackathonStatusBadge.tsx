import type { HackathonStatus } from '@opencsg/shared-types';

const LABELS: Record<HackathonStatus, string> = {
  upcoming: '报名中',
  active: '进行中',
  judging: '评审中',
  finished: '已结束',
  cancelled: '已取消',
};

const STYLES: Record<HackathonStatus, string> = {
  upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  judging: 'bg-amber-50 text-amber-700 border-amber-200',
  finished: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

interface HackathonStatusBadgeProps {
  status: HackathonStatus;
  className?: string;
}

export function HackathonStatusBadge({ status, className = '' }: HackathonStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${STYLES[status]} ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}
