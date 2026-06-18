interface LevelBadgeProps {
  level: number;
  points: number;
  currentLevelPoints: number;
  nextLevelPoints: number;
  pointsToNextLevel: number;
}

export function LevelBadge({
  level,
  points,
  currentLevelPoints,
  nextLevelPoints,
  pointsToNextLevel,
}: LevelBadgeProps) {
  const range = nextLevelPoints - currentLevelPoints;
  const progress = range > 0 ? ((points - currentLevelPoints) / range) * 100 : 100;

  return (
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-[#666666]">当前等级</div>
          <div className="text-3xl font-bold">Lv.{level}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-[#666666]">总积分</div>
          <div className="text-3xl font-bold">{points}</div>
        </div>
      </div>
      <div className="h-2 bg-[#F5F4F0] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#171717] rounded-full transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-[#666666] text-right">
        距升级还需 {pointsToNextLevel} 积分
      </div>
    </div>
  );
}
