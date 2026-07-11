import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Trophy,
  ScrollText,
  Megaphone,
  UsersRound,
  FileText,
  Edit,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { HackathonStatusBadge } from './HackathonStatusBadge';
import { RegistrationButton } from './RegistrationButton';
import { AnnouncementList } from './AnnouncementList';
import { TeamPanel } from './TeamPanel';
import { SubmissionPanel } from './SubmissionPanel';
import type { HackathonWithDetails } from '@opencsg/shared-types';

const TABS = [
  { key: 'overview', label: '概览', icon: ScrollText },
  { key: 'announcements', label: '公告', icon: Megaphone },
  { key: 'teams', label: '队伍', icon: UsersRound },
  { key: 'submissions', label: '作品', icon: FileText },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: hackathon, isLoading } = useQuery<HackathonWithDetails>({
    queryKey: ['hackathon', id],
    queryFn: () => hackathonsApi.getById(id!),
    enabled: !!id,
  });

  const { data: announcements } = useQuery({
    queryKey: ['hackathon-announcements', id],
    queryFn: () => hackathonsApi.getAnnouncements(id!),
    enabled: !!id,
  });

  const formatDate = (d: Date | string) => new Date(d).toLocaleDateString('zh-CN');
  const formatDateTime = (d: Date | string) => new Date(d).toLocaleString('zh-CN');

  if (isLoading) {
    return (
      <div className="text-center py-32 text-[#666666]">加载中...</div>
    );
  }

  if (!hackathon) {
    return (
      <div className="text-center py-32">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
          / 404
        </div>
        <p className="text-2xl font-black tracking-tighter">黑客松不存在</p>
      </div>
    );
  }

  const isOrganizer = !!user && hackathon.organizerId === user.id;
  const isAdmin = user?.role === 'admin';
  const isRegistered = hackathon.myRegistration?.status === 'registered';

  const startDate = new Date(hackathon.startDate);
  const endDate = new Date(hackathon.endDate);
  const days = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="bg-[#F5F4F0] text-[#171717] animate-in fade-in duration-500">
      {/* Top action bar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/hackathons"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] hover:text-[#171717]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back To Hackathons
          </Link>
        </div>
      </section>

      {/* Hero — split banner + content */}
      <section className="border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Banner */}
          <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto border-b lg:border-b-0 lg:border-r border-[#171717] bg-[#EEEDE9] overflow-hidden">
            {hackathon.bannerUrl ? (
              <img src={hackathon.bannerUrl} alt={hackathon.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#999999]">No Banner</div>
            )}
          </div>

          {/* Content */}
          <div className="lg:col-span-5 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-[#171717] text-white">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <HackathonStatusBadge status={hackathon.status} className="border-white text-white bg-white text-[#171717]" />
              {isOrganizer && (
                <span className="inline-flex items-center px-2 py-0.5 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
                  Organizer
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.95] mb-6 uppercase">
              {hackathon.title}
            </h1>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-0 border border-white/20 mb-8">
              <div className="p-4 border-r border-b border-white/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Start
                </div>
                <div className="text-sm font-black tracking-tight">{formatDate(startDate)}</div>
              </div>
              <div className="p-4 border-b border-white/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> End
                </div>
                <div className="text-sm font-black tracking-tight">{formatDate(endDate)}</div>
              </div>
              {hackathon.location && (
                <div className="p-4 border-r border-white/20">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location
                  </div>
                  <div className="text-sm font-black tracking-tight truncate">{hackathon.location}</div>
                </div>
              )}
              <div className="p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Team Size
                </div>
                <div className="text-sm font-black tracking-tight">
                  {hackathon.minTeamSize}-{hackathon.maxTeamSize}
                </div>
              </div>
            </div>

            {/* Countdown / CTA */}
            <div className="flex flex-wrap items-center gap-3">
              {user ? <RegistrationButton hackathon={hackathon} /> : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors"
                >
                  <span>Login to Join</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
              {isAdmin && (
                <Link
                  to={`/admin/hackathons?edit=${hackathon.id}`}
                  className="inline-flex items-center gap-2 border border-white/30 text-white px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white/10"
                >
                  <Edit className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
            </div>

            {days > 0 && hackathon.status === 'upcoming' && (
              <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-2">
                <Clock className="w-3 h-3" /> 还有 {days} 天开始
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-[#171717] bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-6 flex overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }, i) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-4 px-5 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0 ${
                  active
                    ? 'text-[#171717] border-b-2 border-[#171717] -mb-px'
                    : 'text-[#666666] hover:text-[#171717]'
                } ${i < TABS.length - 1 ? 'border-r border-[#EEEDE9]' : ''}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tab content */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <BrutalPanel label="01 / Description" title="活动介绍">
                  <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.description}</p>
                </BrutalPanel>
                {hackathon.rules && (
                  <BrutalPanel label="02 / Rules" title="比赛规则">
                    <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.rules}</p>
                  </BrutalPanel>
                )}
              </div>
              <div className="space-y-6">
                {hackathon.prizes && (
                  <div className="border-2 border-[#171717] bg-white">
                    <div className="bg-[#171717] text-white p-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Prizes</span>
                    </div>
                    <div className="p-5">
                      <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.prizes}</p>
                    </div>
                  </div>
                )}
                <div className="border-2 border-[#171717] bg-white">
                  <div className="bg-[#171717] text-white p-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Judges</span>
                  </div>
                  <div className="p-5">
                    {hackathon.judges?.length ? (
                      <div className="divide-y divide-[#EEEDE9]">
                        {hackathon.judges.map((j) => (
                          <div key={j.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="text-sm font-black tracking-tight">{j.name}</div>
                            {j.title && <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-0.5">{j.title}</div>}
                            {j.bio && <div className="text-xs text-[#666666] mt-1 leading-relaxed">{j.bio}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#666666]">评委待定</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'announcements' && <AnnouncementList announcements={announcements} />}
          {activeTab === 'teams' && (
            <TeamPanel hackathonId={hackathon.id} maxTeamSize={hackathon.maxTeamSize} isRegistered={isRegistered} />
          )}
          {activeTab === 'submissions' && (
            <SubmissionPanel hackathonId={hackathon.id} isRegistered={isRegistered} />
          )}
        </div>
      </section>
    </div>
  );
}

function BrutalPanel({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#171717] bg-white">
      <div className="bg-[#171717] text-white p-4 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
