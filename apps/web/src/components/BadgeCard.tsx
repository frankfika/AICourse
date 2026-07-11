import { Award, Lock } from 'lucide-react';
import type { BadgeWithStatus } from '@opencsg/shared-types';

interface BadgeCardProps {
  badge: BadgeWithStatus;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: { iconBox: 'w-8 h-8', iconInner: 'w-3.5 h-3.5', card: 'p-2.5', title: 'text-[10px]', progress: 'text-[9px]' },
  md: { iconBox: 'w-12 h-12', iconInner: 'w-5 h-5', card: 'p-4', title: 'text-sm', progress: 'text-[10px]' },
  lg: { iconBox: 'w-16 h-16', iconInner: 'w-6 h-6', card: 'p-5', title: 'text-base', progress: 'text-xs' },
};

export function BadgeCard({ badge, size = 'md' }: BadgeCardProps) {
  const s = sizeClasses[size];
  const unlocked = badge.unlocked;
  const IconName = badge.icon;

  return (
    <div
      className={`relative border-2 border-[#171717] transition-all duration-300 ${
        unlocked ? 'bg-white' : 'bg-[#F5F4F0] opacity-70'
      } ${s.card}`}
      title={badge.description}
    >
      {!unlocked && (
        <div className="absolute top-1.5 right-1.5 text-[#999999]">
          <Lock className="w-3 h-3" />
        </div>
      )}
      <div
        className={`${s.iconBox} flex items-center justify-center mb-2 ${
          unlocked ? 'bg-[#171717] text-white' : 'bg-[#EEEDE9] text-[#999999]'
        }`}
      >
        {IconName === 'award' ? (
          <Award className={s.iconInner} />
        ) : (
          <span className="text-base">🏅</span>
        )}
      </div>
      <h4 className={`font-black tracking-tight ${s.title} leading-tight mb-0.5 line-clamp-1`}>
        {badge.name}
      </h4>
      <div className={`${s.progress} font-black uppercase tracking-widest`}>
        {unlocked ? (
          <span className="text-[#171717]">Unlocked</span>
        ) : (
          <span className="text-[#999999]">
            {badge.progress}/{badge.target}
          </span>
        )}
      </div>
    </div>
  );
}
