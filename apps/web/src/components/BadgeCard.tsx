import { Award, Lock } from 'lucide-react';
import type { BadgeWithStatus } from '@opencsg/shared-types';

interface BadgeCardProps {
  badge: BadgeWithStatus;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: { icon: 'w-8 h-8', card: 'p-3', title: 'text-xs' },
  md: { icon: 'w-12 h-12', card: 'p-4', title: 'text-sm' },
  lg: { icon: 'w-16 h-16', card: 'p-5', title: 'text-base' },
};

export function BadgeCard({ badge, size = 'md' }: BadgeCardProps) {
  const s = sizeClasses[size];
  const unlocked = badge.unlocked;
  const IconName = badge.icon;

  return (
    <div
      className={`relative border rounded-2xl transition-all duration-300 ${
        unlocked
          ? 'bg-white border-[#EEEDE9] hover:border-[#171717] animate-in zoom-in duration-300'
          : 'bg-[#F5F4F0] border-[#EEEDE9] opacity-70'
      } ${s.card}`}
      title={badge.description}
    >
      {!unlocked && (
        <div className="absolute top-2 right-2 text-[#999999]">
          <Lock className="w-3 h-3" />
        </div>
      )}
      <div
        className={`${s.icon} rounded-xl flex items-center justify-center mb-3 ${
          unlocked ? 'bg-[#171717] text-white' : 'bg-[#EEEDE9] text-[#999999]'
        }`}
      >
        {IconName === 'award' ? (
          <Award className="w-1/2 h-1/2" />
        ) : (
          <span className="text-lg">🏅</span>
        )}
      </div>
      <h4 className={`font-bold ${s.title} mb-1`}>{badge.name}</h4>
      <p className="text-xs text-[#666666] line-clamp-2 mb-2">{badge.description}</p>
      <div className="text-xs text-[#999999]">
        {unlocked ? (
          <span className="text-emerald-600 font-medium">已解锁</span>
        ) : (
          <span>进度 {badge.progress}/{badge.target}</span>
        )}
      </div>
    </div>
  );
}
