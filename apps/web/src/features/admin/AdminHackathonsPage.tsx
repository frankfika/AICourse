import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Rocket } from 'lucide-react';
import type { Hackathon, HackathonStatus } from '@opencsg/shared-types';
import { hackathonsApi } from '../../lib/hackathonsApi';
import { HackathonStatusBadge } from '../hackathons/HackathonStatusBadge';

const STATUS_OPTIONS: HackathonStatus[] = [
  'upcoming',
  'active',
  'judging',
  'finished',
  'cancelled',
];

const STATUS_LABELS: Record<HackathonStatus, string> = {
  upcoming: '报名中',
  active: '进行中',
  judging: '评审中',
  finished: '已结束',
  cancelled: '已取消',
};

function toDateTimeLocal(iso?: string | Date | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOString(local?: string) {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const EMPTY_FORM = {
  title: '',
  description: '',
  bannerUrl: '',
  status: 'upcoming' as HackathonStatus,
  startDate: '',
  endDate: '',
  registerDeadline: '',
  minTeamSize: 1,
  maxTeamSize: 5,
  location: '',
  rules: '',
  prizes: '',
};

export function AdminHackathonsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const editId = searchParams.get('edit');

  const { data: hackathons, isLoading } = useQuery({
    queryKey: ['admin-hackathons'],
    queryFn: () => hackathonsApi.getAll(),
  });

  useEffect(() => {
    if (editId && hackathons) {
      const h = hackathons.find((x) => x.id === editId);
      if (h) startEdit(h);
      setSearchParams({}, { replace: true });
    }
  }, [editId, hackathons, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => hackathonsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hackathons'] });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      hackathonsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hackathons'] });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
      queryClient.invalidateQueries({ queryKey: ['hackathon', editingId] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hackathonsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hackathons'] });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
    },
  });

  const startEdit = (h: Hackathon) => {
    setEditingId(h.id);
    setIsCreating(true);
    setForm({
      title: h.title,
      description: h.description,
      bannerUrl: h.bannerUrl || '',
      status: h.status,
      startDate: toDateTimeLocal(h.startDate),
      endDate: toDateTimeLocal(h.endDate),
      registerDeadline: toDateTimeLocal(h.registerDeadline),
      minTeamSize: h.minTeamSize,
      maxTeamSize: h.maxTeamSize,
      location: h.location || '',
      rules: h.rules || '',
      prizes: h.prizes || '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      startDate: toISOString(form.startDate)!,
      endDate: toISOString(form.endDate)!,
      registerDeadline: toISOString(form.registerDeadline) || null,
      minTeamSize: Number(form.minTeamSize),
      maxTeamSize: Number(form.maxTeamSize),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">黑客松管理</h2>
        <button
          onClick={() => {
            if (isCreating) resetForm();
            else setIsCreating(true);
          }}
          className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {isCreating ? '取消' : '新增黑客松'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-4 border-b border-[#EEEDE9] pb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              placeholder="标题"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
            />
            <input
              placeholder="地点"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as HackathonStatus })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <input
              placeholder="Banner URL"
              value={form.bannerUrl}
              onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#666666]">开始</label>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="flex-1 px-4 py-2 border border-[#EEEDE9] rounded-lg"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#666666]">结束</label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="flex-1 px-4 py-2 border border-[#EEEDE9] rounded-lg"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#666666]">报名截止</label>
              <input
                type="datetime-local"
                value={form.registerDeadline}
                onChange={(e) => setForm({ ...form, registerDeadline: e.target.value })}
                className="flex-1 px-4 py-2 border border-[#EEEDE9] rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="最小团队人数"
                value={form.minTeamSize}
                onChange={(e) => setForm({ ...form, minTeamSize: Number(e.target.value) })}
                className="flex-1 px-4 py-2 border border-[#EEEDE9] rounded-lg"
              />
              <span className="text-[#666666]">-</span>
              <input
                type="number"
                min={1}
                placeholder="最大团队人数"
                value={form.maxTeamSize}
                onChange={(e) => setForm({ ...form, maxTeamSize: Number(e.target.value) })}
                className="flex-1 px-4 py-2 border border-[#EEEDE9] rounded-lg"
              />
            </div>
          </div>
          <textarea
            placeholder="活动介绍"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
            required
          />
          <textarea
            placeholder="比赛规则"
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
          />
          <textarea
            placeholder="奖项设置"
            value={form.prizes}
            onChange={(e) => setForm({ ...form, prizes: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-[#171717] text-white rounded-full text-sm font-medium disabled:opacity-50"
            >
              {editingId ? '保存修改' : '创建'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EEEDE9]">
              <th className="text-left py-3 px-2">标题</th>
              <th className="text-left py-3 px-2">状态</th>
              <th className="text-left py-3 px-2">时间</th>
              <th className="text-left py-3 px-2">地点</th>
              <th className="text-left py-3 px-2">团队规模</th>
              <th className="text-right py-3 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#666666]">加载中...</td>
              </tr>
            ) : (
              hackathons?.map((h) => (
                <tr key={h.id} className="border-b border-[#F5F4F0]">
                  <td className="py-3 px-2 font-medium">{h.title}</td>
                  <td className="py-3 px-2">
                    <HackathonStatusBadge status={h.status} />
                  </td>
                  <td className="py-3 px-2 text-[#666666]">
                    {new Date(h.startDate).toLocaleDateString('zh-CN')} -
                    {' '}
                    {new Date(h.endDate).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="py-3 px-2 text-[#666666]">{h.location || '-'}</td>
                  <td className="py-3 px-2 text-[#666666]">
                    {h.minTeamSize}-{h.maxTeamSize} 人
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => startEdit(h)}
                      className="p-1 hover:bg-[#F5F4F0] rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(h.id)}
                      className="p-1 hover:bg-red-50 text-red-600 rounded ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
