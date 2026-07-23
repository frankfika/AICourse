import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Sparkles } from 'lucide-react';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import api from '../../lib/api';
import { aiApi } from '../../lib/aiApi';
import { AiGeneratePanel } from '../../components/AiGeneratePanel';
import { AdminField, AdminSelect, AdminButton } from './components/AdminForm';

interface Degree {
  id: string;
  title: string;
  description?: string;
  learningPoints?: string | string[];
  icon?: string;
  costType: string;
  price: number;
  thumbnail?: string;
  status: string;
  courses: { course: { title: string } }[];
}

const EMPTY_FORM = {
  title: '',
  description: '',
  learningPoints: '',
  price: 0,
  icon: 'sparkles',
  costType: 'paid',
  thumbnail: '',
};

function learningPointsToString(v: string | string[] | undefined): string {
  if (!v) return '';
  if (Array.isArray(v)) return v.join('\n');
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.join('\n');
  } catch {
    // 不是 JSON 字符串,直接返回
  }
  return v;
}

function learningPointsToPayload(v: string): string[] {
  return v.split('\n').map((s) => s.trim()).filter(Boolean);
}

export function AdminDegreesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState<Degree | null>(null);

  const { data: degrees } = useQuery({
    queryKey: ['admin-degrees'],
    queryFn: async () => {
      const { data } = await api.get<Degree[]>('/api/v1/degrees');
      return data;
    },
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setIsCreating(false);
    setEditingId(null);
  };

  const startEdit = (degree: Degree) => {
    setEditingId(degree.id);
    setForm({
      title: degree.title ?? '',
      description: degree.description ?? '',
      learningPoints: learningPointsToString(degree.learningPoints),
      price: degree.price ?? 0,
      icon: degree.icon ?? 'sparkles',
      costType: degree.costType ?? 'paid',
      thumbnail: degree.thumbnail ?? '',
    });
    setIsCreating(true);
  };

  const createMutation = useApiMutation({
    mutationFn: (payload: any) => api.post('/api/v1/degrees', payload),
    successMessage: '学位已创建',
    invalidateKeys: [['admin-degrees'], ['degrees']],
    onSuccess: () => resetForm(),
  });

  // P2-4c: 学位更新 mutation
  const updateMutation = useApiMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.patch(`/api/v1/degrees/${id}`, payload),
    successMessage: '学位已更新',
    invalidateKeys: [['admin-degrees'], ['degrees']],
    onSuccess: () => resetForm(),
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/degrees/${id}`),
    successMessage: '学位已删除',
    invalidateKeys: [['admin-degrees'], ['degrees']],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: Number(form.price),
      learningPoints: JSON.stringify(learningPointsToPayload(form.learningPoints)),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = isCreating || !!editingId;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] dark:text-neutral-400 mb-2">
            / Admin · Degrees
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">学位管理</h2>
        </div>
        <button
          onClick={() => {
            if (isFormOpen) resetForm();
            else setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> {isFormOpen ? '取消' : '新增学位'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100 p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 mb-4">
            {editingId ? '/ Edit Degree' : '/ New Degree'}
          </div>

          {!editingId && (
            <AiGeneratePanel
              type="degree"
              placeholder="例：AI 全栈工程师 / 金融大模型应用专家 / 智能体开发"
              onGenerate={(topic, hint) => aiApi.generateDegree(topic, hint)}
              onApply={(draft) => {
                setForm({
                  title: draft.title ?? '',
                  description: draft.description ?? '',
                  learningPoints: draft.learningPoints ?? '',
                  price: draft.price ?? 0,
                  icon: draft.icon ?? 'sparkles',
                  costType: draft.costType ?? 'paid',
                  thumbnail: draft.thumbnail ?? '',
                });
              }}
            />
          )}

          <AdminField
            label="学位标题"
            required
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
          />
          <div className="mt-4">
            <AdminField
              label="学位描述"
              multiline
              required
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <AdminField
              label="价格"
              type="number"
              value={String(form.price)}
              onChange={(v) => setForm({ ...form, price: Number(v) })}
            />
            <AdminField
              label="图标 (lucide 名)"
              value={form.icon}
              onChange={(v) => setForm({ ...form, icon: v })}
            />
            <AdminSelect
              label="类型"
              value={form.costType}
              onChange={(v) => setForm({ ...form, costType: v })}
              options={[
                { value: 'free', label: '免费' },
                { value: 'paid', label: '付费' },
                { value: 'charity', label: '公益' },
              ]}
            />
          </div>
          <div className="mt-4">
            <AdminField
              label="封面图 URL"
              value={form.thumbnail}
              onChange={(v) => setForm({ ...form, thumbnail: v })}
            />
          </div>
          <div className="mt-4">
            <AdminField
              label="学习要点（每行一个）"
              multiline
              rows={4}
              value={form.learningPoints}
              onChange={(v) => setForm({ ...form, learningPoints: v })}
            />
          </div>
          <div className="flex gap-2 mt-6 pt-4 border-t border-[#EEEDE9]">
            <AdminButton type="submit" disabled={isSubmitting}>
              {editingId ? '保存修改' : '保存学位'}
            </AdminButton>
            <AdminButton type="button" variant="secondary" onClick={resetForm}>
              取消
            </AdminButton>
          </div>
        </form>
      )}

      {/* Degree list */}
      <div className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] dark:border-neutral-50 text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400">
          <div className="col-span-12 md:col-span-1">#</div>
          <div className="col-span-12 md:col-span-5">Title</div>
          <div className="col-span-12 md:col-span-2">Type</div>
          <div className="col-span-12 md:col-span-1">Price</div>
          <div className="col-span-12 md:col-span-1">Courses</div>
          <div className="col-span-12 md:col-span-2 text-right">Action</div>
        </div>
        {degrees?.map((degree, i) => (
          <div
            key={degree.id}
            className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (degrees?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#F5F4F0] dark:hover:bg-neutral-800 transition-colors`}
          >
            <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-12 md:col-span-5 font-black tracking-tight truncate">{degree.title}</div>
            <div className="col-span-12 md:col-span-2 text-xs">
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  degree.costType === 'free'
                    ? 'bg-[#171717] text-white'
                    : 'border border-[#171717] dark:border-neutral-50'
                }`}
              >
                {degree.costType}
              </span>
            </div>
            <div className="col-span-12 md:col-span-1 font-bold text-sm">
              {degree.costType === 'free' ? '—' : `¥${degree.price}`}
            </div>
            <div className="col-span-12 md:col-span-1 font-bold text-sm">{degree.courses.length}</div>
            <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-1">
              <button
                onClick={() => startEdit(degree)}
                disabled={isFormOpen && editingId === degree.id}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors disabled:opacity-30"
                title="编辑"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPendingDelete(degree)}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(!degrees || degrees.length === 0) && (
          <div className="p-16 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-3 text-[#A3A3A3]" />
            <p className="text-sm text-[#666666]">暂无学位，点击"新增学位"或使用 AI 智能填充快速创建</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const id = pendingDelete.id;
          setPendingDelete(null);
          await deleteMutation.mutateAsync(id);
        }}
        title="确认删除该学位?"
        description={
          pendingDelete
            ? `「${pendingDelete.title}」将彻底删除,关联的 ${pendingDelete.courses.length} 门课程报名将失效。不可恢复。`
            : ''
        }
        variant="danger"
        confirmText="确认删除"
      />
    </div>
  );
}
