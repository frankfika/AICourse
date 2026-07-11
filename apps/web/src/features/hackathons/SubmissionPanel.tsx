import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Edit2, ExternalLink, Github, Video } from 'lucide-react';
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

const STATUS_STYLES: Record<Submission['status'], string> = {
  draft: 'border border-[#171717] text-[#171717] bg-white',
  submitted: 'bg-[#171717] text-white',
  under_review: 'bg-[#171717] text-white',
  shortlisted: 'bg-[#171717] text-white',
  winner: 'bg-[#171717] text-white',
  rejected: 'border border-[#A3A3A3] text-[#666666] bg-white line-through',
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
    setForm({ title: '', description: '', demoUrl: '', repoUrl: '', videoUrl: '', teamId: '', status: 'draft' });
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
    if (editingId) updateMutation.mutate({ id: editingId, payload: form });
    else createMutation.mutate();
  };

  if (!isRegistered) {
    return (
      <div className="border-2 border-[#171717] bg-[#F5F4F0] p-6 text-sm font-medium text-[#171717]">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] mr-2">/ Notice</span>
        报名后可提交作品。
      </div>
    );
  }

  if (isLoading) return <div className="text-center py-12 text-[#666666]">加载中...</div>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="border-2 border-[#171717] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
            {editingId ? '/ Edit Submission' : '/ New Submission'}
          </div>
        </div>
        <input
          placeholder="作品标题"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          required
        />
        <textarea
          placeholder="作品描述"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors resize-none"
          rows={3}
          required
        />
        <div className="grid md:grid-cols-2 gap-3">
          <input
            placeholder="Demo URL"
            value={form.demoUrl}
            onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          />
          <input
            placeholder="Repo URL"
            value={form.repoUrl}
            onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          />
          <input
            placeholder="视频 URL"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          />
          <select
            value={form.teamId || myTeamId || ''}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors bg-white"
          >
            <option value="">个人参赛</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>队伍：{t.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.status === 'submitted'}
            onChange={(e) => setForm({ ...form, status: e.target.checked ? 'submitted' : 'draft' })}
            className="w-4 h-4 accent-[#171717]"
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
            立即提交（否则保存为草稿）
          </span>
        </label>
        <div className="flex gap-2 pt-4 border-t border-[#EEEDE9]">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {editingId ? '保存修改' : '保存作品'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </form>

      <div className="space-y-0 border-t border-[#171717]">
        {submissions?.map((s) => (
          <div key={s.id} className="border-b border-[#171717] bg-white p-5 hover:bg-[#F5F4F0] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className="text-lg font-black tracking-tight">{s.title}</h4>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ${STATUS_STYLES[s.status]}`}>
                  {STATUS_LABELS[s.status]}
                </span>
              </div>
              <button
                onClick={() => startEdit(s)}
                className="p-1.5 hover:bg-[#171717] hover:text-white transition-colors"
                title="编辑"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-[#666666] whitespace-pre-line mb-3 leading-relaxed">{s.description}</p>
            <div className="flex flex-wrap gap-3 text-sm pt-3 border-t border-[#EEEDE9]">
              {s.demoUrl && (
                <a href={s.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline">
                  <ExternalLink className="w-3 h-3" /> Demo
                </a>
              )}
              {s.repoUrl && (
                <a href={s.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline">
                  <Github className="w-3 h-3" /> Repo
                </a>
              )}
              {s.videoUrl && (
                <a href={s.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline">
                  <Video className="w-3 h-3" /> Video
                </a>
              )}
            </div>
            {s.score !== null && s.score !== undefined && (
              <div className="mt-3 pt-3 border-t border-[#EEEDE9] text-sm">
                <span className="font-black tracking-tight">评分：{s.score}</span>
                {s.feedback && <span className="text-[#666666] ml-2">评语：{s.feedback}</span>}
              </div>
            )}
          </div>
        ))}

        {!submissions?.length && !editingId && (
          <div className="border-2 border-[#171717] bg-white text-center py-16">
            <FileText className="w-8 h-8 mx-auto mb-3 text-[#A3A3A3]" />
            <p className="text-sm text-[#666666]">还没有作品，提交你的第一个作品吧！</p>
          </div>
        )}
      </div>
    </div>
  );
}
