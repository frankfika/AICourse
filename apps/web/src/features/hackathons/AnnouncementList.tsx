import { Megaphone, Pin } from 'lucide-react';
import type { Announcement } from '@opencsg/shared-types';

interface AnnouncementListProps {
  announcements?: Announcement[];
}

export function AnnouncementList({ announcements }: AnnouncementListProps) {
  if (!announcements?.length) {
    return (
      <div className="text-center py-12 text-[#666666]">
        <Megaphone className="w-12 h-12 mx-auto text-[#999999] mb-3" />
        暂无公告
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`bg-white border rounded-2xl p-5 ${
            a.isPinned ? 'border-[#171717]' : 'border-[#EEEDE9]'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="font-bold text-[#171717]">{a.title}</h4>
            {a.isPinned && (
              <span className="flex items-center gap-1 text-xs font-bold text-[#171717]">
                <Pin className="w-3.5 h-3.5" /> 置顶
              </span>
            )}
          </div>
          <p className="text-sm text-[#666666] whitespace-pre-line">{a.content}</p>
          <div className="mt-3 text-xs text-[#999999]">
            {new Date(a.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      ))}
    </div>
  );
}
