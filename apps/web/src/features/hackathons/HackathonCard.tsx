import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowUpRight } from 'lucide-react';
import type { HackathonListItem } from '@opencsg/shared-types';
import { HackathonStatusBadge } from './HackathonStatusBadge';

interface HackathonCardProps {
  hackathon: HackathonListItem;
  isOrganizer?: boolean;
}

export function HackathonCard({ hackathon, isOrganizer }: HackathonCardProps) {
  const formatRange = (d: Date | string) =>
    new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <Link
      to={`/hackathons/${hackathon.id}`}
      className="group grid grid-cols-12 items-center gap-4 md:gap-6 p-5 md:p-6 bg-white hover:bg-[#F5F4F0] transition-colors"
    >
      {/* Date stamp */}
      <div className="col-span-3 md:col-span-2 flex flex-col border border-[#171717] p-3 text-center bg-[#F5F4F0]">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#666666]">
          {new Date(hackathon.startDate).toLocaleDateString('zh-CN', { month: 'short' })}
        </span>
        <span className="text-2xl font-black tracking-tighter leading-none mt-0.5">
          {new Date(hackathon.startDate).getDate()}
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#666666] mt-0.5">
          {new Date(hackathon.endDate).getDate()}
        </span>
      </div>

      {/* Content */}
      <div className="col-span-8 md:col-span-9 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <HackathonStatusBadge status={hackathon.status} />
          {hackathon.myRegistration?.status === 'registered' && (
            <span className="inline-flex items-center px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
              已报名
            </span>
          )}
          {isOrganizer && (
            <span className="inline-flex items-center px-2 py-0.5 border border-[#171717] text-[10px] font-black uppercase tracking-widest">
              我主办的
            </span>
          )}
        </div>

        <h3 className="text-lg md:text-xl font-black tracking-tight leading-tight truncate mb-1 group-hover:underline decoration-2 underline-offset-4">
          {hackathon.title}
        </h3>
        <p className="text-sm text-[#666666] line-clamp-1 mb-2 leading-relaxed">
          {hackathon.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatRange(hackathon.startDate)} - {formatRange(hackathon.endDate)}
          </span>
          {hackathon.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {hackathon.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {hackathon.minTeamSize}-{hackathon.maxTeamSize} 人
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="col-span-1 flex items-center justify-end">
        <ArrowUpRight className="w-5 h-5 text-[#666666] group-hover:text-[#171717] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
      </div>
    </Link>
  );
}
