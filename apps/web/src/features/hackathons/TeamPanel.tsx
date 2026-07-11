import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, UserPlus, LogOut, Crown } from 'lucide-react';
import type { Team } from '@opencsg/shared-types';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { useAuthStore } from '../../stores/authStore';

interface TeamMemberWithUser {
  id: string;
  role: 'captain' | 'member';
  user: { id: string; name: string; avatarUrl?: string | null };
}

interface TeamWithMembers extends Team {
  members: TeamMemberWithUser[];
}

interface TeamPanelProps {
  hackathonId: string;
  maxTeamSize: number;
  isRegistered: boolean;
}

export function TeamPanel({ hackathonId, maxTeamSize, isRegistered }: TeamPanelProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSlogan, setTeamSlogan] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['hackathon-teams', hackathonId],
    queryFn: () => hackathonsApi.getTeams(hackathonId) as Promise<TeamWithMembers[]>,
  });

  const createMutation = useMutation({
    mutationFn: () => hackathonsApi.createTeam(hackathonId, { name: teamName, slogan: teamSlogan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-teams', hackathonId] });
      setShowCreate(false);
      setTeamName('');
      setTeamSlogan('');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (teamId: string) => hackathonsApi.joinTeam(hackathonId, teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hackathon-teams', hackathonId] }),
  });

  const leaveMutation = useMutation({
    mutationFn: (teamId: string) => hackathonsApi.leaveTeam(hackathonId, teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hackathon-teams', hackathonId] }),
  });

  const myTeamId = teams?.find((t) => t.members.some((m) => m.user.id === user?.id))?.id;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    createMutation.mutate();
  };

  if (isLoading) return <div className="text-center py-12 text-[#666666]">加载中...</div>;

  return (
    <div className="space-y-6">
      {!isRegistered && (
        <div className="border-2 border-[#171717] bg-[#F5F4F0] p-5 text-sm font-medium text-[#171717]">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] mr-2">
            / Notice
          </span>
          报名后即可创建或加入队伍。
        </div>
      )}

      {isRegistered && !myTeamId && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> 创建队伍
        </button>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="border-2 border-[#171717] bg-white p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
            / New Team
          </div>
          <input
            placeholder="队伍名称"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
            required
          />
          <input
            placeholder="队伍口号（可选）"
            value={teamSlogan}
            onChange={(e) => setTeamSlogan(e.target.value)}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-0 border-t border-l border-[#171717]">
        {teams?.map((team, i) => {
          const isMember = team.members.some((m) => m.user.id === user?.id);
          const isFull = team.members.length >= maxTeamSize;
          return (
            <div
              key={team.id}
              className={`p-5 border-b border-r border-[#171717] hover:bg-[#F5F4F0] transition-colors ${
                isMember ? 'bg-[#F5F4F0]' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-black tracking-tight">{team.name}</h4>
                  {team.slogan && <p className="text-sm text-[#666666] mt-1">{team.slogan}</p>}
                </div>
                <span className="inline-flex items-center px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
                  {team.members.length}/{maxTeamSize}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {team.members.map((m) => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 ${
                      m.role === 'captain'
                        ? 'bg-[#171717] text-white'
                        : 'border border-[#171717] text-[#171717]'
                    }`}
                  >
                    {m.role === 'captain' && <Crown className="w-3 h-3" />}
                    {m.user.name}
                  </span>
                ))}
              </div>

              {isRegistered && (
                <div className="flex gap-2 pt-4 border-t border-[#EEEDE9]">
                  {isMember ? (
                    <button
                      onClick={() => leaveMutation.mutate(team.id)}
                      disabled={leaveMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-3 h-3" /> 退出
                    </button>
                  ) : !myTeamId && !isFull ? (
                    <button
                      onClick={() => joinMutation.mutate(team.id)}
                      disabled={joinMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-[#171717] text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
                    >
                      <UserPlus className="w-3 h-3" /> 加入
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!teams?.length && isRegistered && !showCreate && (
        <div className="border-2 border-[#171717] bg-white text-center py-16">
          <Users className="w-8 h-8 mx-auto mb-3 text-[#A3A3A3]" />
          <p className="text-sm text-[#666666]">还没有队伍，快来创建第一支队伍吧！</p>
        </div>
      )}
    </div>
  );
}
