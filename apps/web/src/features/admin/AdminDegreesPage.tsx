import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';

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
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">学位管理</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 新增学位
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-4 border-b border-[#EEEDE9] pb-6">
          <input
            placeholder="学位标题"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            required
          />
          <textarea
            placeholder="学位描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
            required
          />
          <div className="grid md:grid-cols-3 gap-4">
            <input
              type="number"
              placeholder="价格"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <input
              placeholder="图标"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
            <select
              value={form.costType}
              onChange={(e) => setForm({ ...form, costType: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            >
              <option value="free">免费</option>
              <option value="paid">付费</option>
              <option value="charity">公益</option>
            </select>
          </div>
          <input
            placeholder="封面图 URL"
            value={form.thumbnail}
            onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
          />
          <textarea
            placeholder="学习要点，每行一个"
            value={form.learningPoints}
            onChange={(e) => setForm({ ...form, learningPoints: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
          />
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#171717] text-white rounded-full text-sm font-medium">保存</button>
            <button type="button" onClick={() => setIsCreating(false)} className="px-6 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium">取消</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EEEDE9]">
              <th className="text-left py-3 px-2">标题</th>
              <th className="text-left py-3 px-2">类型</th>
              <th className="text-left py-3 px-2">价格</th>
              <th className="text-left py-3 px-2">课程数</th>
              <th className="text-right py-3 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {degrees?.map((degree) => (
              <tr key={degree.id} className="border-b border-[#F5F4F0]">
                <td className="py-3 px-2 font-medium">{degree.title}</td>
                <td className="py-3 px-2">{degree.costType}</td>
                <td className="py-3 px-2">{degree.price}</td>
                <td className="py-3 px-2">{degree.courses.length}</td>
                <td className="py-3 px-2 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(degree.id)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
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
