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

  if (isLoading) return <div className="text-center py-8 text-[#666666]">加载中...</div>;

  return (
    <div className="space-y-6">
      {!isRegistered && (
        <div className="text-sm text-[#666666] bg-[#F5F4F0] rounded-xl p-4">
          报名后即可创建或加入队伍。
        </div>
      )}

      {isRegistered && !myTeamId && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-full text-sm font-bold hover:bg-[#333333]"
        >
          <Plus className="w-4 h-4" /> 创建队伍
        </button>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-[#EEEDE9] rounded-2xl p-5 space-y-4">
          <input
            placeholder="队伍名称"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
            required
          />
          <input
            placeholder="队伍口号（可选）"
            value={teamSlogan}
            onChange={(e) => setTeamSlogan(e.target.value)}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-[#171717] text-white rounded-full text-sm font-bold disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-5 py-2 border border-[#EEEDE9] rounded-full text-sm font-bold"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {teams?.map((team) => {
          const isMember = team.members.some((m) => m.user.id === user?.id);
          const isFull = team.members.length >= maxTeamSize;
          return (
            <div key={team.id} className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-lg">{team.name}</h4>
                  {team.slogan && <p className="text-sm text-[#666666]">{team.slogan}</p>}
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#F5F4F0] text-[#666666]">
                  {team.members.length}/{maxTeamSize}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {team.members.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F4F0] text-[#171717]"
                  >
                    {m.role === 'captain' && <Crown className="w-3 h-3 text-amber-600" />}
                    {m.user.name}
                  </span>
                ))}
              </div>

              {isRegistered && (
                <div className="flex gap-2">
                  {isMember ? (
                    <button
                      onClick={() => leaveMutation.mutate(team.id)}
                      disabled={leaveMutation.isPending}
                      className="flex items-center gap-1 px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-bold text-[#666666] hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5" /> 退出
                    </button>
                  ) : !myTeamId && !isFull ? (
                    <button
                      onClick={() => joinMutation.mutate(team.id)}
                      disabled={joinMutation.isPending}
                      className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-bold disabled:opacity-50"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> 加入
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!teams?.length && isRegistered && !showCreate && (
        <div className="text-center py-12 text-[#666666]">
          <Users className="w-12 h-12 mx-auto text-[#999999] mb-3" />
          还没有队伍，快来创建第一支队伍吧！
        </div>
      )}
    </div>
  );
}
