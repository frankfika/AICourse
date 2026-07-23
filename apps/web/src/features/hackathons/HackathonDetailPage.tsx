import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ScrollText,
  Megaphone,
  Edit,
  ArrowUpRight,
} from 'lucide-react';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { HackathonStatusBadge } from './HackathonStatusBadge';
import { AnnouncementList } from './AnnouncementList';
import type { HackathonWithDetails } from '@opencsg/shared-types';
import { usePageSettings, useI18n, pickPage } from '../../lib/cms';
import { Seo } from '../../components/Seo';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { LazyImage } from '../../components/ui/LazyImage';

const TABS = [
  { key: 'overview', label: '概览', icon: ScrollText },
  { key: 'announcements', label: '公告', icon: Megaphone },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  // CMS-driven copy
  const { t } = useI18n();
  const { data: pageData } = usePageSettings('hackathons', [
    'detail.back', 'detail.cta_registration', 'detail.panel_label_desc', 'detail.panel_label_rules', 'detail.empty_judges',
  ]);
  const back = pickPage(pageData, 'detail.back', 'zh-CN', t('hackathon.detail.back', 'Back To Hackathons'));
  const ctaDefault = pickPage(pageData, 'detail.cta_registration', 'zh-CN', t('hackathon.cta.registration', '前往报名'));
  const panelDesc = pickPage(pageData, 'detail.panel_label_desc', 'zh-CN', t('hackathon.panel.desc', '01 / Description'));
  const panelRules = pickPage(pageData, 'detail.panel_label_rules', 'zh-CN', t('hackathon.panel.rules', '02 / Rules'));
  const emptyJudges = pickPage(pageData, 'detail.empty_judges', 'zh-CN', t('hackathon.panel.empty_judges', '评委待定'));

  if (isLoading) {
    return (
      <div className="text-center py-32 text-[#666666]">{t('common.loading', '加载中...')}</div>
    );
  }

  if (!hackathon) {
    return (
      <div className="text-center py-32">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
          / 404
        </div>
        <p className="text-2xl font-black tracking-tighter">{t('hackathon.not_found', '黑客松不存在')}</p>
      </div>
    );
  }

  const startDate = new Date(hackathon.startDate);
  const endDate = new Date(hackathon.endDate);
  // 基础信息 (描述 / 规则 / 奖品 / 评委) 已经在 tab 里, hero 只挂 1 个外链 CTA。
  // 报名 / 了解更多 / 官网 等都走同一个链接, label 可配, 留空用 CMS default。
  const regUrl = hackathon.registrationUrl;
  const regLabel = (hackathon.registrationLabel || '').trim() || ctaDefault;

  return (
    <div className="bg-[#F5F4F0] text-[#171717] animate-in fade-in duration-500">
      <Seo
        title={hackathon.title}
        description={hackathon.description?.slice(0, 200) ?? '黑客松详情'}
        path={`/hackathons/${hackathon.id}`}
        image={hackathon.bannerUrl || undefined}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: hackathon.title,
          description: hackathon.description,
          startDate: new Date(hackathon.startDate).toISOString(),
          endDate: new Date(hackathon.endDate).toISOString(),
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: hackathon.location
            ? { '@type': 'Place', name: hackathon.location }
            : { '@type': 'VirtualLocation', url: hackathon.registrationUrl || undefined },
          organizer: { '@type': 'Organization', name: 'OpenCSG Academy' },
        }}
      />
      {/* Top action bar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/hackathons"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] hover:text-[#171717]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {back}
          </Link>
        </div>
      </section>

      {/* Hero — split banner + content */}
      <section className="border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Banner */}
          <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto border-b lg:border-b-0 lg:border-r border-[#171717] bg-[#EEEDE9] overflow-hidden">
            {hackathon.bannerUrl ? (
              <LazyImage
                src={hackathon.bannerUrl}
                alt={hackathon.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#999999]">No Banner</div>
            )}
          </div>

          {/* Content */}
          <div className="lg:col-span-5 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-[#171717] text-white">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <HackathonStatusBadge status={hackathon.status} className="border-white text-white bg-white text-[#171717]" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] mb-6 uppercase">
              {hackathon.title}
            </h1>

            {/* 基础信息 (banner + 这些字段都是 admin 提前填好的) */}
            <div className="grid grid-cols-2 gap-0 border border-white/20 mb-8">
              <div className="p-4 border-r border-b border-white/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {t('hackathon.stat.start', 'Start')}
                </div>
                <div className="text-sm font-black tracking-tight">{formatDate(startDate)}</div>
              </div>
              <div className="p-4 border-b border-white/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {t('hackathon.stat.end', 'End')}
                </div>
                <div className="text-sm font-black tracking-tight">{formatDate(endDate)}</div>
              </div>
              {hackathon.location && (
                <div className="p-4 border-r border-white/20">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {t('hackathon.stat.location', 'Location')}
                  </div>
                  <div className="text-sm font-black tracking-tight truncate">{hackathon.location}</div>
                </div>
              )}
              <div className="p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {t('hackathon.stat.team_size', 'Team Size')}
                </div>
                <div className="text-sm font-black tracking-tight">
                  {hackathon.minTeamSize}-{hackathon.maxTeamSize}
                </div>
              </div>
            </div>

            {/* 1 个外链 CTA: 报名 / 了解更多 都走这一个, admin 配链接 + 可选 label。
                没配链接就显示 fallback 提示, 引导用户看下方公告。 */}
            <div className="flex flex-col gap-3">
              {regUrl ? (
                <a
                  href={regUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors"
                >
                  <span>{regLabel}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              ) : (
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  {t('hackathon.cta.empty', '组织者暂未配置外链, 详情请见下方公告')}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs — P1-3 用公共 Tabs,加 role/aria-selected */}
      <section className="border-b border-[#171717] bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-6 flex overflow-x-auto">
          <Tabs<TabKey>
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="黑客松详情"
            items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
            idPrefix="hackathon-detail"
            className="flex"
            itemClassName={(_, active) =>
              `py-4 px-5 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#171717] ${
                active
                  ? 'text-[#171717] border-b-2 border-[#171717] -mb-px'
                  : 'text-[#666666] hover:text-[#171717]'
              }`
            }
          />
        </div>
      </section>

      {/* Tab content */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TabPanel value={activeTab} tabKey="overview" idPrefix="hackathon-detail">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <BrutalPanel label={panelDesc} title={t('hackathon.panel.desc.title', '活动介绍')}>
                  <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.description}</p>
                </BrutalPanel>
                {hackathon.rules && (
                  <BrutalPanel label={panelRules} title={t('hackathon.panel.rules.title', '比赛规则')}>
                    <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.rules}</p>
                  </BrutalPanel>
                )}
              </div>
              <div className="space-y-6">
                {hackathon.prizes && (
                  <div className="border-2 border-[#171717] bg-white">
                    <div className="bg-[#171717] text-white p-4 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('hackathon.prizes.label', 'Prizes')}</span>
                    </div>
                    <div className="p-5">
                      <p className="text-[#171717] whitespace-pre-line leading-relaxed">{hackathon.prizes}</p>
                    </div>
                  </div>
                )}
                <div className="border-2 border-[#171717] bg-white">
                  <div className="bg-[#171717] text-white p-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('hackathon.judges.label', 'Judges')}</span>
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
                      <p className="text-xs text-[#666666]">{emptyJudges}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value={activeTab} tabKey="announcements" idPrefix="hackathon-detail">
            <AnnouncementList announcements={announcements} />
          </TabPanel>
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
