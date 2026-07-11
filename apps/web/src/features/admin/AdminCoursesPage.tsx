import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Sparkles, Link2 } from 'lucide-react';
import api from '../../lib/api';
import { aiApi } from '../../lib/aiApi';
import { AiGeneratePanel } from '../../components/AiGeneratePanel';

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
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
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

  const importMutation = useMutation({
    mutationFn: (url: string) => api.post('/api/v1/courses/import-from-url', { url }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsImporting(false);
      setImportUrl('');
      const s = res.data?.status;
      if (s === 'duplicate') {
        alert(
          `该视频已导入过：${res.data?.course?.title ?? ''}\n课程 ID：${res.data?.course?.id ?? ''}`,
        );
      } else {
        alert(
          `已生成草稿：${res.data?.draft?.title ?? ''}\n\n下一步：在课程管理中审核并点击发布。`,
        );
      }
    },
    onError: (err: any) => {
      alert(
        `导入失败：${err?.response?.data?.message ?? err?.message ?? '未知错误'}\n\n请确认 URL 属于 youtube.com / youtu.be / bilibili.com`,
      );
    },
  });

  const batchImportMutation = useMutation({
    mutationFn: (urls: string[]) =>
      api.post('/api/v1/courses/import-batch-from-urls', { urls }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setBatchUrls('');
      const { created, duplicate, failed, results } = res.data ?? {};
      const summary = `批量导入完成：\n成功 ${created} / 重复 ${duplicate} / 失败 ${failed}\n\n${(results ?? [])
        .map((r: any) => `${r.url} → ${r.status}${r.error ? ` (${r.error})` : ''}`)
        .join('\n')}`;
      alert(summary);
    },
    onError: (err: any) => {
      alert(
        `批量导入失败：${err?.response?.data?.message ?? err?.message ?? '未知错误'}`,
      );
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

  const handleImport = () => {
    if (!importUrl.trim()) return;
    importMutation.mutate(importUrl.trim());
  };

  const handleBatchImport = () => {
    const urls = batchUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    if (urls.length > 20) {
      alert('一次最多 20 条 URL');
      return;
    }
    batchImportMutation.mutate(urls);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
            / Admin · Courses
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">课程管理</h2>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增课程
        </button>
        <button
          onClick={() => setIsImporting(!isImporting)}
          className="inline-flex items-center gap-2 px-5 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#171717] hover:text-white transition-colors"
        >
          <Link2 className="w-4 h-4" /> 从 URL 导入
        </button>
      </div>

      {isImporting && (
        <div className="border-2 border-[#171717] bg-white p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
            / Import Course From URL
          </div>
          <p className="text-xs text-[#666666] mb-4 leading-relaxed">
            支持 YouTube（youtube.com / youtu.be）和 Bilibili（bilibili.com）公开视频。
            系统会自动抓取标题、封面、作者，并通过 AI 生成描述、学习要点、难度和标签，作为草稿保存，需审核后发布。
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9]"
              autoFocus
            />
            <button
              onClick={handleImport}
              disabled={importMutation.isPending || !importUrl.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {importMutation.isPending ? '抓取中…' : '抓取并生成草稿'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsImporting(false);
                setImportUrl('');
              }}
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
          {importMutation.isError && (
            <div className="mt-3 text-xs text-red-600">
              {(importMutation.error as any)?.response?.data?.message ??
                (importMutation.error as any)?.message ??
                '抓取失败'}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-[#EEEDE9]">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
              / Batch Import（一次最多 20 条）
            </div>
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.bilibili.com/video/BV...\n（每行一条 URL）'}
              rows={4}
              className="w-full px-4 py-3 bg-white border border-[#171717] text-xs font-mono focus:outline-none focus:bg-[#EEEDE9] resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleBatchImport}
                disabled={batchImportMutation.isPending || !batchUrls.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {batchImportMutation.isPending ? '批量抓取中…' : '批量抓取'}
              </button>
              <button
                type="button"
                onClick={() => setBatchUrls('')}
                className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
              >
                清空
              </button>
            </div>
            {batchImportMutation.isError && (
              <div className="mt-3 text-xs text-red-600">
                {(batchImportMutation.error as any)?.response?.data?.message ??
                  (batchImportMutation.error as any)?.message ??
                  '批量抓取失败'}
              </div>
            )}
          </div>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleSubmit} className="border-2 border-[#171717] bg-white p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-4">
            / New Course
          </div>

          {/* AI Panel */}
          <AiGeneratePanel
            type="course"
            placeholder="例：RAG 系统实战：从零搭建企业知识库"
            onGenerate={(topic, hint) => aiApi.generateCourse(topic, hint)}
            onApply={(draft) => {
              setForm({
                title: draft.title ?? '',
                description: draft.description ?? '',
                learningPoints: draft.learningPoints ?? '',
                instructor: draft.instructor ?? '',
                level: draft.level ?? 'Beginner',
                duration: draft.duration ?? '',
                thumbnail: draft.thumbnail ?? '',
                tags: draft.tags ?? '',
                costType: draft.costType ?? 'free',
                price: draft.price ?? 0,
              });
            }}
          />

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="课程标题" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="讲师" required value={form.instructor} onChange={(v) => setForm({ ...form, instructor: v })} />
            <div>
              <Label>难度</Label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9]"
              >
                <option value="Beginner">入门</option>
                <option value="Intermediate">进阶</option>
                <option value="Advanced">高级</option>
                <option value="Expert">专家</option>
              </select>
            </div>
            <Field label="时长（如：45 分钟）" required value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
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
            <Field
              label="价格"
              type="number"
              value={String(form.price)}
              onChange={(v) => setForm({ ...form, price: Number(v) })}
            />
          </div>
          <div className="mt-4">
            <Field
              label="课程描述"
              multiline
              required
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
          </div>
          <div className="mt-4">
            <Field
              label="封面图 URL"
              value={form.thumbnail}
              onChange={(v) => setForm({ ...form, thumbnail: v })}
              required
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
          <div className="mt-4">
            <Field
              label="标签（用逗号分隔）"
              value={form.tags}
              onChange={(v) => setForm({ ...form, tags: v })}
            />
          </div>
          <div className="flex gap-2 mt-6 pt-4 border-t border-[#EEEDE9]">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              保存课程
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

      {/* Course list */}
      <div className="border-2 border-[#171717] bg-white">
        <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Instructor</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Price</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {courses?.map((course, i) => (
          <div
            key={course.id}
            className={`grid grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (courses?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#F5F4F0] transition-colors`}
          >
            <div className="col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-5 font-black tracking-tight truncate">{course.title}</div>
            <div className="col-span-2 text-[#666666] text-xs">{course.instructor}</div>
            <div className="col-span-2 text-xs">
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  course.costType === 'free'
                    ? 'bg-[#171717] text-white'
                    : course.costType === 'charity'
                    ? 'border border-[#171717]'
                    : 'border border-[#171717]'
                }`}
              >
                {course.costType}
              </span>
            </div>
            <div className="col-span-1 font-bold text-sm">
              {course.costType === 'free' ? '—' : `¥${course.price}`}
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <button
                onClick={() => deleteMutation.mutate(course.id)}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(!courses || courses.length === 0) && (
          <div className="p-16 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-3 text-[#A3A3A3]" />
            <p className="text-sm text-[#666666]">暂无课程，点击"新增课程"或使用 AI 智能填充快速创建</p>
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
