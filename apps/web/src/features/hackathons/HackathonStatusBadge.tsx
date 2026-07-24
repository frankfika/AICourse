import type { HackathonStatus } from '@ai-academy/shared-types';
import { useEnum } from '../../lib/cms';

// Fallback(API 失败时) —— 跟 review/cms-audit-labels.md §3 hackathon_status 当前值一致
const FALLBACK_LABEL: Record<HackathonStatus, string> = {
  upcoming: '报名中',
  active: '进行中',
  judging: '评审中',
  finished: '已结束',
  cancelled: '已取消',
};
const FALLBACK_STYLE: Record<HackathonStatus, string> = {
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
  const { getLabel, getColor } = useEnum('hackathon_status');
  const apiColor = getColor(status);
  // 优先 API colorClass(可能有 dark mode),fallback 走原 brutalist 硬编码
  const styleClass = apiColor ?? FALLBACK_STYLE[status];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border ${styleClass} ${className}`}
    >
      {getLabel(status)}
    </span>
  );
}
