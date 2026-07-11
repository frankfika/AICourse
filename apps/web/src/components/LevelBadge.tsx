interface LevelBadgeProps {
  level: number;
  points: number;
  currentLevelPoints: number;
  nextLevelPoints: number;
  pointsToNextLevel: number;
}

export function LevelBadge({
  level = 1,
  points = 0,
  currentLevelPoints = 0,
  nextLevelPoints = 100,
  pointsToNextLevel = 100,
}: Partial<LevelBadgeProps>) {
  const range = nextLevelPoints - currentLevelPoints;
  const progress = range > 0 ? ((points - currentLevelPoints) / range) * 100 : 100;

  return (
    <div className="border-2 border-[#171717] bg-white">
      <div className="p-6 border-b border-[#171717]">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-3">
          / Level
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-6xl font-black tracking-tighter leading-none">
              Lv.{level}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-2">
              Current Level
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black tracking-tighter">{points}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-1">
              Total Points
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
          <span>{currentLevelPoints} pts</span>
          <span>{nextLevelPoints} pts</span>
        </div>
        <div className="h-3 bg-[#EEEDE9] overflow-hidden">
          <div
            className="h-full bg-[#171717] transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#171717]">
          距升级还需 {pointsToNextLevel} 积分
        </div>
      </div>
    </div>
  );
}
