interface ActivityHeatmapProps {
  data: { date: string; count: number }[];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  // 补齐到 52 周（364 天），从周日开始
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

  const cells: { date: string; count: number }[] = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(endOfWeek);
    d.setDate(endOfWeek.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const found = data.find((item) => item.date === date);
    cells.push({ date, count: found?.count ?? 0 });
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const getLevel = (count: number) => {
    if (count === 0) return 'bg-[#EEEDE9]';
    if (count <= maxCount * 0.25) return 'bg-[#171717]/30';
    if (count <= maxCount * 0.5) return 'bg-[#171717]/55';
    if (count <= maxCount * 0.75) return 'bg-[#171717]/80';
    return 'bg-[#171717]';
  };

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-flex gap-[3px] min-w-full">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} 个课时`}
                className={`w-3 h-3 rounded-sm ${getLevel(day.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-[#999999]">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-[#EEEDE9]" />
        <div className="w-3 h-3 rounded-sm bg-[#171717]/30" />
        <div className="w-3 h-3 rounded-sm bg-[#171717]/55" />
        <div className="w-3 h-3 rounded-sm bg-[#171717]/80" />
        <div className="w-3 h-3 rounded-sm bg-[#171717]" />
        <span>多</span>
      </div>
    </div>
  );
}
