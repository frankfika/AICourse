import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Award } from 'lucide-react';
import { badgesApi } from '../../lib/badgesApi';
import type { Badge, BadgeCriteriaType } from '@opencsg/shared-types';

const criteriaTypeOptions: { value: BadgeCriteriaType; label: string }[] = [
  { value: 'course_completed', label: '完成课程' },
  { value: 'lessons_completed', label: '累计课时' },
  { value: 'streak_days', label: '连续学习天数' },
  { value: 'first_enrollment', label: '首次报名' },
  { value: 'practice_completed', label: '完成实践项目' },
  { value: 'points_reached', label: '积分达到' },
];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  icon: 'award',
  category: 'general',
  criteriaType: 'lessons_completed' as BadgeCriteriaType,
  criteriaValue: 1,
  points: 0,
  isActive: true,
  orderIndex: 0,
};

export function AdminBadgesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: badges } = useQuery({
    queryKey: ['admin-badges'],
    queryFn: () => badgesApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: badgesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
      queryClient.invalidateQueries({ queryKey: ['my-badges'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) => badgesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
      queryClient.invalidateQueries({ queryKey: ['my-badges'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: badgesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
      queryClient.invalidateQueries({ queryKey: ['my-badges'] });
    },
  });

  const resetForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (badge: Badge) => {
    setEditingId(badge.id);
    setForm({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      criteriaType: badge.criteriaType,
      criteriaValue: badge.criteriaValue,
      points: badge.points,
      isActive: badge.isActive,
      orderIndex: badge.orderIndex,
    });
    setIsCreating(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      criteriaValue: Number(form.criteriaValue),
      points: Number(form.points),
      orderIndex: Number(form.orderIndex),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
            / Admin · Badges
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">徽章管理</h2>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增徽章
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="border-2 border-[#171717] bg-white p-6 mb-8"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-4">
            {editingId ? `/ Edit Badge · ${form.code}` : '/ New Badge'}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <BrutalField
              label="唯一标识 Code"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v })}
              required
              disabled={!!editingId}
            />
            <BrutalField
              label="徽章名称"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <BrutalField
              label="图标名（如 award）"
              value={form.icon}
              onChange={(v) => setForm({ ...form, icon: v })}
            />
            <BrutalField
              label="分组 Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
            />
            <BrutalSelect
              label="达成条件类型"
              value={form.criteriaType}
              onChange={(v) => setForm({ ...form, criteriaType: v as BadgeCriteriaType })}
              options={criteriaTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
            <BrutalField
              label="达成阈值"
              type="number"
              value={String(form.criteriaValue)}
              onChange={(v) => setForm({ ...form, criteriaValue: Number(v) })}
            />
            <BrutalField
              label="解锁奖励积分"
              type="number"
              value={String(form.points)}
              onChange={(v) => setForm({ ...form, points: Number(v) })}
            />
            <BrutalField
              label="排序"
              type="number"
              value={String(form.orderIndex)}
              onChange={(v) => setForm({ ...form, orderIndex: Number(v) })}
            />
          </div>
          <div className="mt-4">
            <BrutalField
              label="描述 / 解锁条件"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              required
              multiline
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 border-2 border-[#171717] accent-[#171717]"
            />
            <span className="font-black uppercase tracking-widest text-[10px]">启用</span>
          </label>
          <div className="flex gap-2 mt-6 pt-4 border-t border-[#EEEDE9]">
            <button
              type="submit"
              className="px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
            >
              {editingId ? '更新' : '保存'}
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
          <div className="col-span-12 md:col-span-4">Badge</div>
          <div className="col-span-12 md:col-span-2">Condition</div>
          <div className="col-span-12 md:col-span-1">Pts</div>
          <div className="col-span-12 md:col-span-2">Status</div>
          <div className="col-span-12 md:col-span-2 text-right">Action</div>
        </div>
        {badges?.map((badge, i) => (
          <div
            key={badge.id}
            className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (badges?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#F5F4F0] transition-colors`}
          >
            <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-9 h-9 bg-[#171717] text-white flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-black tracking-tight truncate">{badge.name}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                  {badge.code}
                </div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-2 text-xs">
              {criteriaTypeOptions.find((o) => o.value === badge.criteriaType)?.label} ≥ {badge.criteriaValue}
            </div>
            <div className="col-span-12 md:col-span-1 font-black tracking-tighter text-sm">{badge.points}</div>
            <div className="col-span-12 md:col-span-2">
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  badge.isActive
                    ? 'bg-[#171717] text-white'
                    : 'border border-[#171717] text-[#171717]'
                }`}
              >
                {badge.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-1">
              <button
                onClick={() => startEdit(badge)}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                title="编辑"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(badge.id)}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(!badges || badges.length === 0) && (
          <div className="p-16 text-center text-sm text-[#666666]">暂无徽章</div>
        )}
      </div>
    </div>
  );
}

function BrutalField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  multiline,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
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
          disabled={disabled}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors resize-none disabled:opacity-50"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors disabled:opacity-50"
        />
      )}
    </div>
  );
}

function BrutalSelect({
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
