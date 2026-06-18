import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import api from '../../lib/api';

interface Course {
  id: string;
  title: string;
  instructor: string;
  costType: string;
  price: number;
  status: string;
}

export function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    learningPoints: '',
    instructor: '',
    level: 'Beginner',
    duration: '',
    thumbnail: '',
    tags: '',
    costType: 'free',
    price: 0,
  });

  const { data: courses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/v1/courses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsCreating(false);
      setForm({
        title: '',
        description: '',
        learningPoints: '',
        instructor: '',
        level: 'Beginner',
        duration: '',
        thumbnail: '',
        tags: '',
        costType: 'free',
        price: 0,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      price: Number(form.price),
      learningPoints: JSON.stringify(form.learningPoints.split('\n').filter(Boolean)),
      tags: JSON.stringify(form.tags.split(',').map((t) => t.trim()).filter(Boolean)),
    });
  };

  return (
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">课程管理</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 新增课程
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-4 border-b border-[#EEEDE9] pb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              placeholder="课程标题"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
            />
            <input
              placeholder="讲师"
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
            />
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            >
              <option value="Beginner">入门</option>
              <option value="Intermediate">进阶</option>
              <option value="Advanced">高级</option>
              <option value="Expert">专家</option>
            </select>
            <input
              placeholder="时长，如 45 分钟"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
              required
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
            <input
              type="number"
              placeholder="价格"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="px-4 py-2 border border-[#EEEDE9] rounded-lg"
            />
          </div>
          <textarea
            placeholder="课程描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
            required
          />
          <textarea
            placeholder="封面图 URL"
            value={form.thumbnail}
            onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={2}
            required
          />
          <textarea
            placeholder="学习要点，每行一个"
            value={form.learningPoints}
            onChange={(e) => setForm({ ...form, learningPoints: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
            rows={3}
          />
          <input
            placeholder="标签，用逗号分隔"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg"
          />
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#171717] text-white rounded-full text-sm font-medium">
              保存
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
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
              <th className="text-left py-3 px-2">讲师</th>
              <th className="text-left py-3 px-2">类型</th>
              <th className="text-left py-3 px-2">价格</th>
              <th className="text-left py-3 px-2">状态</th>
              <th className="text-right py-3 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {courses?.map((course) => (
              <tr key={course.id} className="border-b border-[#F5F4F0]">
                <td className="py-3 px-2 font-medium">{course.title}</td>
                <td className="py-3 px-2 text-[#666666]">{course.instructor}</td>
                <td className="py-3 px-2">{course.costType}</td>
                <td className="py-3 px-2">{course.price}</td>
                <td className="py-3 px-2">{course.status}</td>
                <td className="py-3 px-2 text-right">
                  <button className="p-1 hover:bg-[#F5F4F0] rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(course.id)}
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
