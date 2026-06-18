import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ChevronRight } from 'lucide-react';
import type { HackathonListItem } from '@opencsg/shared-types';
import { HackathonStatusBadge } from './HackathonStatusBadge';

interface HackathonCardProps {
  hackathon: HackathonListItem;
  isOrganizer?: boolean;
}

export function HackathonCard({ hackathon, isOrganizer }: HackathonCardProps) {
  const formatMonth = (d: Date | string) =>
    new Date(d).toLocaleDateString('zh-CN', { month: 'short' });
  const formatDay = (d: Date | string) =>
    new Date(d).toLocaleDateString('zh-CN', { day: 'numeric' });
  const formatRange = (d: Date | string) =>
    new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <Link
      to={`/hackathons/${hackathon.id}`}
      className="group flex items-center gap-4 md:gap-6 bg-white rounded-2xl border border-[#EEEDE9] p-4 md:p-5 hover:shadow-md hover:border-[#D9D8D4] transition-all"
    >
      {/* Date block */}
      <div className="hidden sm:flex flex-col items-center justify-center min-w-[4.5rem] py-3 rounded-xl bg-[#F5F4F0] text-[#171717]">
        <span className="text-xs font-medium text-[#666666]">{formatMonth(hackathon.startDate)}</span>
        <span className="text-2xl font-bold leading-none mt-0.5">{formatDay(hackathon.startDate)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <HackathonStatusBadge status={hackathon.status} />
          {hackathon.myRegistration?.status === 'registered' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#171717] text-white">
              已报名
            </span>
          )}
          {isOrganizer && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              我主办的
            </span>
          )}
        </div>

        <h3 className="text-lg md:text-xl font-bold truncate mb-1 group-hover:underline decoration-2 underline-offset-4">
          {hackathon.title}
        </h3>
        <p className="text-sm text-[#666666] line-clamp-1 mb-2">
          {hackathon.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-[#666666]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatRange(hackathon.startDate)} - {formatRange(hackathon.endDate)}
          </span>
          {hackathon.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {hackathon.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {hackathon.minTeamSize}-{hackathon.maxTeamSize} 人
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="shrink-0 text-[#999999] group-hover:text-[#171717] group-hover:translate-x-1 transition-all">
        <ChevronRight className="w-6 h-6" />
      </div>
    </Link>
  );
}
