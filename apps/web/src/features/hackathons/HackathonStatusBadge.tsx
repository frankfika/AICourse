import type { HackathonStatus } from '@opencsg/shared-types';

const LABELS: Record<HackathonStatus, string> = {
  upcoming: '报名中',
  active: '进行中',
  judging: '评审中',
  finished: '已结束',
  cancelled: '已取消',
};

const STYLES: Record<HackathonStatus, string> = {
  upcoming: 'bg-[#171717] text-white border-[#171717]',
  active: 'bg-white text-[#171717] border-[#171717]',
  judging: 'bg-[#171717] text-white border-[#171717]',
  finished: 'bg-white text-[#666666] border-[#A3A3A3]',
  cancelled: 'bg-white text-[#171717] border-[#171717] line-through',
};

interface HackathonStatusBadgeProps {
  status: HackathonStatus;
  className?: string;
}

export function HackathonStatusBadge({ status, className = '' }: HackathonStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border ${STYLES[status]} ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}
