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
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">徽章管理</h2>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 新增徽章
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-4 border-b border-[#EEEDE9] pb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              placeholder="唯一标识 code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
              disabled={!!editingId}
            />
            <input
              placeholder="徽章名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
            />
            <input
              placeholder="图标名（如 award）"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <input
              placeholder="分组 category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <select
              value={form.criteriaType}
              onChange={(e) => setForm({ ...form, criteriaType: e.target.value as BadgeCriteriaType })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            >
              {criteriaTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="达成阈值"
              value={form.criteriaValue}
              onChange={(e) => setForm({ ...form, criteriaValue: Number(e.target.value) })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              min={1}
            />
            <input
              type="number"
              placeholder="解锁奖励积分"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              min={0}
            />
            <input
              type="number"
              placeholder="排序"
              value={form.orderIndex}
              onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
          </div>
          <textarea
            placeholder="徽章描述 / 解锁条件说明"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            启用
          </label>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#171717] text-white rounded-full text-sm font-medium">
              {editingId ? '更新' : '保存'}
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
              <th className="text-left py-3 px-2">徽章</th>
              <th className="text-left py-3 px-2">类型</th>
              <th className="text-left py-3 px-2">条件</th>
              <th className="text-left py-3 px-2">奖励积分</th>
              <th className="text-left py-3 px-2">状态</th>
              <th className="text-right py-3 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {badges?.map((badge) => (
              <tr key={badge.id} className="border-b border-[#F5F4F0]">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#F5F4F0] rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{badge.name}</div>
                      <div className="text-xs text-[#666666]">{badge.code}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-[#666666]">{badge.category}</td>
                <td className="py-3 px-2">
                  {criteriaTypeOptions.find((o) => o.value === badge.criteriaType)?.label} ≥ {badge.criteriaValue}
                </td>
                <td className="py-3 px-2">{badge.points}</td>
                <td className="py-3 px-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      badge.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {badge.isActive ? '启用' : '禁用'}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => startEdit(badge)} className="p-1 hover:bg-[#F5F4F0] rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(badge.id)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
