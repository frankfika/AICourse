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
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2 flex items-center gap-2">
            <Rocket className="w-3 h-3" /> / Admin · Hackathons
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">黑客松管理</h2>
        </div>
        <button
          onClick={() => {
            if (isCreating) resetForm();
            else setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> {isCreating ? '取消' : '新增黑客松'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="border-2 border-[#171717] bg-white p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-4">
            {editingId ? `/ Edit · ${form.title}` : '/ New Hackathon'}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="标题"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              required
            />
            <Field
              label="地点"
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />
            <Select
              label="状态"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v as HackathonStatus })}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <Field
              label="Banner URL"
              value={form.bannerUrl}
              onChange={(v) => setForm({ ...form, bannerUrl: v })}
            />
            <Field
              label="开始时间"
              type="datetime-local"
              value={form.startDate}
              onChange={(v) => setForm({ ...form, startDate: v })}
              required
            />
            <Field
              label="结束时间"
              type="datetime-local"
              value={form.endDate}
              onChange={(v) => setForm({ ...form, endDate: v })}
              required
            />
            <Field
              label="报名截止"
              type="datetime-local"
              value={form.registerDeadline}
              onChange={(v) => setForm({ ...form, registerDeadline: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="最小团队人数"
                type="number"
                value={String(form.minTeamSize)}
                onChange={(v) => setForm({ ...form, minTeamSize: Number(v) })}
              />
              <Field
                label="最大团队人数"
                type="number"
                value={String(form.maxTeamSize)}
                onChange={(v) => setForm({ ...form, maxTeamSize: Number(v) })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Field
              label="活动介绍"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              required
            />
          </div>
          <div className="mt-4">
            <Field
              label="比赛规则"
              value={form.rules}
              onChange={(v) => setForm({ ...form, rules: v })}
              multiline
            />
          </div>
          <div className="mt-4">
            <Field
              label="奖项设置"
              value={form.prizes}
              onChange={(v) => setForm({ ...form, prizes: v })}
              multiline
            />
          </div>
          <div className="flex gap-2 mt-6 pt-4 border-t border-[#EEEDE9]">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {editingId ? '保存修改' : '创建'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="border-2 border-[#171717] bg-white">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="col-span-12 md:col-span-1">#</div>
          <div className="col-span-12 md:col-span-4">Title</div>
          <div className="col-span-12 md:col-span-2">Status</div>
          <div className="col-span-12 md:col-span-2">Time</div>
          <div className="col-span-12 md:col-span-2">Team</div>
          <div className="col-span-12 md:col-span-1 text-right">Action</div>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#666666]">加载中...</div>
        ) : (
          hackathons?.map((h, i) => (
            <div
              key={h.id}
              className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm ${
                i < (hackathons?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
              } hover:bg-[#F5F4F0] transition-colors`}
            >
              <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="col-span-12 md:col-span-4 font-black tracking-tight truncate">{h.title}</div>
              <div className="col-span-12 md:col-span-2">
                <HackathonStatusBadge status={h.status} />
              </div>
              <div className="col-span-12 md:col-span-2 text-[10px] font-black uppercase tracking-widest text-[#666666]">
                {new Date(h.startDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                {' - '}
                {new Date(h.endDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </div>
              <div className="col-span-12 md:col-span-2 text-[10px] font-black uppercase tracking-widest text-[#666666]">
                {h.minTeamSize}-{h.maxTeamSize} 人
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-1">
                <button
                  onClick={() => startEdit(h)}
                  className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(h.id)}
                  className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!hackathons || hackathons.length === 0) && (
          <div className="p-16 text-center text-sm text-[#666666]">暂无黑客松</div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 flex items-center gap-1">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
