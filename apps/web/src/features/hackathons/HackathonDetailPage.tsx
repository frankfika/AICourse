import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Trophy,
  ScrollText,
  Megaphone,
  UsersRound,
  FileText,
  Edit,
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
      <div className="max-w-7xl mx-auto px-6 py-12 text-center text-[#666666]">
        加载中...
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center text-[#666666]">
        黑客松不存在
      </div>
    );
  }

  const isOrganizer = !!user && hackathon.organizerId === user.id;
  const isAdmin = user?.role === 'admin';
  const isRegistered = hackathon.myRegistration?.status === 'registered';

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <Link
        to="/hackathons"
        className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#171717] mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> 返回列表
      </Link>

      <div className="relative rounded-3xl overflow-hidden bg-white border border-[#EEEDE9] mb-8">
        <div className="h-48 md:h-72 overflow-hidden bg-[#F5F4F0]">
          {hackathon.bannerUrl ? (
            <img
              src={hackathon.bannerUrl}
              alt={hackathon.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#999999]">
              暂无封面
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HackathonStatusBadge status={hackathon.status} />
                {isOrganizer && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    我主办的
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{hackathon.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#666666]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(hackathon.startDate)} - {formatDate(hackathon.endDate)}
                </span>
                {hackathon.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {hackathon.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {hackathon.minTeamSize}-{hackathon.maxTeamSize} 人
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user && <RegistrationButton hackathon={hackathon} />}
              {isAdmin && (
                <Link
                  to={`/admin/hackathons?edit=${hackathon.id}`}
                  className="flex items-center gap-1 px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-bold hover:border-[#171717]"
                >
                  <Edit className="w-4 h-4" /> 管理
                </Link>
              )}
            </div>
          </div>

          {hackathon.registerDeadline && (
            <div className="text-sm text-[#666666] mb-2">
              报名截止：{formatDateTime(hackathon.registerDeadline)}
            </div>
          )}

          {hackathon.organizer && (
            <div className="text-sm text-[#666666]">
              主办方：{hackathon.organizer.name}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6 border-b border-[#EEEDE9] mb-8 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === key
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#666666]'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-3">活动介绍</h3>
                <p className="text-[#666666] whitespace-pre-line">{hackathon.description}</p>
              </section>
              {hackathon.rules && (
                <section className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-3">比赛规则</h3>
                  <p className="text-[#666666] whitespace-pre-line">{hackathon.rules}</p>
                </section>
              )}
            </div>

            <div className="space-y-6">
              {hackathon.prizes && (
                <section className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-lg">奖项设置</h3>
                  </div>
                  <p className="text-[#666666] whitespace-pre-line">{hackathon.prizes}</p>
                </section>
              )}

              <section className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-3">评委</h3>
                {hackathon.judges?.length ? (
                  <div className="space-y-4">
                    {hackathon.judges.map((j) => (
                      <div key={j.id}>
                        <div className="font-bold">{j.name}</div>
                        {j.title && <div className="text-sm text-[#666666]">{j.title}</div>}
                        {j.bio && <div className="text-sm text-[#999999] mt-1">{j.bio}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#666666]">评委待定</p>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'announcements' && <AnnouncementList announcements={announcements} />}

        {activeTab === 'teams' && (
          <TeamPanel
            hackathonId={hackathon.id}
            maxTeamSize={hackathon.maxTeamSize}
            isRegistered={isRegistered}
          />
        )}

        {activeTab === 'submissions' && (
          <SubmissionPanel hackathonId={hackathon.id} isRegistered={isRegistered} />
        )}
      </div>
    </div>
  );
}
