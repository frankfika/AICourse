import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Edit2, CheckCircle, Clock } from 'lucide-react';
import type { Submission, Team } from '@opencsg/shared-types';
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

interface SubmissionPanelProps {
  hackathonId: string;
  isRegistered: boolean;
}

const STATUS_LABELS: Record<Submission['status'], string> = {
  draft: '草稿',
  submitted: '已提交',
  under_review: '评审中',
  shortlisted: '入围',
  winner: '获奖',
  rejected: '未入围',
};

const STATUS_COLORS: Record<Submission['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  shortlisted: 'bg-purple-50 text-purple-700',
  winner: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

export function SubmissionPanel({ hackathonId, isRegistered }: SubmissionPanelProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    demoUrl: '',
    repoUrl: '',
    videoUrl: '',
    teamId: '',
    status: 'draft' as Submission['status'],
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['hackathon-submissions', hackathonId],
    queryFn: () => hackathonsApi.getMySubmissions(hackathonId),
    enabled: isRegistered,
  });

  const { data: teams } = useQuery({
    queryKey: ['hackathon-teams', hackathonId],
    queryFn: () => hackathonsApi.getTeams(hackathonId) as Promise<TeamWithMembers[]>,
  });

  const myTeamId = teams?.find((t) => t.members.some((m) => m.user.id === user?.id))?.id;

  const createMutation = useMutation({
    mutationFn: () => hackathonsApi.createSubmission(hackathonId, {
      ...form,
      teamId: form.teamId || myTeamId,
      status: form.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-submissions', hackathonId] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<typeof form> }) =>
      hackathonsApi.updateSubmission(hackathonId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-submissions', hackathonId] });
      setEditingId(null);
      resetForm();
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      demoUrl: '',
      repoUrl: '',
      videoUrl: '',
      teamId: '',
      status: 'draft',
    });
  };

  const startEdit = (s: Submission) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      description: s.description,
      demoUrl: s.demoUrl || '',
      repoUrl: s.repoUrl || '',
      videoUrl: s.videoUrl || '',
      teamId: s.teamId || '',
      status: s.status,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate();
    }
  };

  if (!isRegistered) {
    return (
      <div className="text-sm text-[#666666] bg-[#F5F4F0] rounded-xl p-4">
        报名后可提交作品。
      </div>
    );
  }

  if (isLoading) return <div className="text-center py-8 text-[#666666]">加载中...</div>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white border border-[#EEEDE9] rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-[#171717]">
          {editingId ? '编辑作品' : '提交新作品'}
        </h4>
        <input
          placeholder="作品标题"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          required
        />
        <textarea
          placeholder="作品描述"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          rows={3}
          required
        />
        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="Demo 链接"
            value={form.demoUrl}
            onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          />
          <input
            placeholder="代码仓库链接"
            value={form.repoUrl}
            onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          />
          <input
            placeholder="视频链接"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          />
          <select
            value={form.teamId || myTeamId || ''}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
          >
            <option value="">个人参赛</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>队伍：{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[#666666]">
            <input
              type="checkbox"
              checked={form.status === 'submitted'}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? 'submitted' : 'draft' })}
              className="w-4 h-4"
            />
            立即提交（否则保存为草稿）
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-5 py-2 bg-[#171717] text-white rounded-full text-sm font-bold disabled:opacity-50"
          >
            {editingId ? '保存修改' : '保存作品'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2 border border-[#EEEDE9] rounded-full text-sm font-bold"
            >
              取消
            </button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        {submissions?.map((s) => (
          <div key={s.id} className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-lg">{s.title}</h4>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[s.status]}`}>
                  {STATUS_LABELS[s.status]}
                </span>
              </div>
              <button
                onClick={() => startEdit(s)}
                className="p-2 hover:bg-[#F5F4F0] rounded-full"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#666666] whitespace-pre-line mb-3">{s.description}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {s.demoUrl && <a href={s.demoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Demo</a>}
              {s.repoUrl && <a href={s.repoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">仓库</a>}
              {s.videoUrl && <a href={s.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">视频</a>}
            </div>
            {s.score !== null && s.score !== undefined && (
              <div className="mt-3 text-sm">
                <span className="font-bold">评分：{s.score}</span>
                {s.feedback && <span className="text-[#666666] ml-2">评语：{s.feedback}</span>}
              </div>
            )}
          </div>
        ))}

        {!submissions?.length && !editingId && (
          <div className="text-center py-12 text-[#666666]">
            <FileText className="w-12 h-12 mx-auto text-[#999999] mb-3" />
            还没有作品，提交你的第一个作品吧！
          </div>
        )}
      </div>
    </div>
  );
}
