import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { aiApi } from '../../lib/aiApi';
import { AiGeneratePanel } from '../../components/AiGeneratePanel';

interface Degree {
  id: string;
  title: string;
  costType: string;
  price: number;
  status: string;
  courses: { course: { title: string } }[];
}

export function AdminDegreesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    learningPoints: '',
    price: 0,
    icon: 'sparkles',
    costType: 'paid',
    thumbnail: '',
  });

  const { data: degrees } = useQuery({
    queryKey: ['admin-degrees'],
    queryFn: async () => {
      const { data } = await api.get<Degree[]>('/api/v1/degrees');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/v1/degrees', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-degrees'] });
      queryClient.invalidateQueries({ queryKey: ['degrees'] });
      setIsCreating(false);
      setForm({ title: '', description: '', learningPoints: '', price: 0, icon: 'sparkles', costType: 'paid', thumbnail: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/degrees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-degrees'] });
      queryClient.invalidateQueries({ queryKey: ['degrees'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      price: Number(form.price),
      learningPoints: JSON.stringify(form.learningPoints.split('\n').filter(Boolean)),
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
            / Admin · Degrees
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">学位管理</h2>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增学位
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="border-2 border-[#171717] bg-white p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-4">
            / New Degree
          </div>

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

          <Field
            label="学位标题"
            required
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
          />
          <div className="mt-4">
            <Field
              label="学位描述"
              multiline
              required
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <Field
              label="价格"
              type="number"
              value={String(form.price)}
              onChange={(v) => setForm({ ...form, price: Number(v) })}
            />
            <Field
              label="图标 (lucide 名)"
              value={form.icon}
              onChange={(v) => setForm({ ...form, icon: v })}
            />
            <div>
              <Label>类型</Label>
              <select
                value={form.costType}
                onChange={(e) => setForm({ ...form, costType: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9]"
              >
                <option value="free">免费</option>
                <option value="paid">付费</option>
                <option value="charity">公益</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Field
              label="封面图 URL"
              value={form.thumbnail}
              onChange={(v) => setForm({ ...form, thumbnail: v })}
            />
          </div>
          <div className="mt-4">
            <Field
              label="学习要点（每行一个）"
              multiline
              value={form.learningPoints}
              onChange={(v) => setForm({ ...form, learningPoints: v })}
            />
          </div>
          <div className="flex gap-2 mt-6 pt-4 border-t border-[#EEEDE9]">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              保存学位
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Degree list */}
      <div className="border-2 border-[#171717] bg-white">
        <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Price</div>
          <div className="col-span-1">Courses</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {degrees?.map((degree, i) => (
          <div
            key={degree.id}
            className={`grid grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (degrees?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#F5F4F0] transition-colors`}
          >
            <div className="col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-6 font-black tracking-tight truncate">{degree.title}</div>
            <div className="col-span-2 text-xs">
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  degree.costType === 'free'
                    ? 'bg-[#171717] text-white'
                    : 'border border-[#171717]'
                }`}
              >
                {degree.costType}
              </span>
            </div>
            <div className="col-span-1 font-bold text-sm">
              {degree.costType === 'free' ? '—' : `¥${degree.price}`}
            </div>
            <div className="col-span-1 font-bold text-sm">{degree.courses.length}</div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <button
                onClick={() => deleteMutation.mutate(degree.id)}
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
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 block">
      {children}
    </label>
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
      <Label>
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9]"
        />
      )}
    </div>
  );
}
