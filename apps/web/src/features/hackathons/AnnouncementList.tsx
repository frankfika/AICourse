import { Megaphone, Pin } from 'lucide-react';
import type { Announcement } from '@ai-academy/shared-types';

interface AnnouncementListProps {
  announcements?: Announcement[];
}

export function AnnouncementList({ announcements }: AnnouncementListProps) {
  if (!announcements?.length) {
    return (
      <div className="border-2 border-[#171717] bg-white text-center py-16">
        <Megaphone className="w-8 h-8 mx-auto mb-3 text-[#A3A3A3]" />
        <p className="text-sm text-[#666666]">暂无公告</p>
      </div>
    );
  }

  return (
    <div className="border-t border-l border-[#171717]">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`p-5 border-b border-r border-[#171717] ${
            a.isPinned ? 'bg-[#171717] text-white' : 'bg-white hover:bg-[#F5F4F0]'
          } transition-colors`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className={`text-lg font-black tracking-tight ${a.isPinned ? 'text-white' : 'text-[#171717]'}`}>
              {a.title}
            </h4>
            {a.isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/70 shrink-0">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </span>
            )}
          </div>
          <p className={`text-sm whitespace-pre-line leading-relaxed ${a.isPinned ? 'text-white/80' : 'text-[#666666]'}`}>
            {a.content}
          </p>
          <div className={`mt-3 pt-3 border-t text-xs font-black uppercase tracking-widest ${a.isPinned ? 'border-white/20 text-white/40' : 'border-[#EEEDE9] text-[#999999]'}`}>
            {new Date(a.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      ))}
    </div>
  );
}
