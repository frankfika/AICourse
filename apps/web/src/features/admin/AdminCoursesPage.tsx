/**
 * AdminCoursesPage — v1.3.0 全部接真后端(无 mock)
 *
 * 两种模式(由 URL ?tab= 决定):
 *   1) /admin/courses           → 列表模式(保留原 AdminCoursesPage 的 list + 新增/导入)
 *   2) /admin/courses?tab=...   → 编辑模式(4 tab:info / chapters / pricing / publish)
 *
 * 4 tab 全部接真后端:
 *   - info      PATCH /api/v1/courses/:id          基本信息
 *   - chapters  GET/POST/PATCH/DELETE /chapters + /lessons + /resources
 *                                                 章节树 + 课时 CRUD + 每课时资源 CRUD
 *   - pricing   PATCH /api/v1/courses/:id (costType + price)
 *   - publish   PATCH /api/v1/courses/:id (status)
 *
 * v1.2.0 起:无前端 mock,无 hardcode 数据,所有写操作走后端。
 * v1.3.0 起:资源管理从「课程级 P2 占位 tab」迁到「课时面板内」,因为 Resource model 是 lesson 级。
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Link2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Eye,
  Save,
  Send,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Tag as TagIcon,
  Clock as ClockIcon,
  User as UserIcon,
  Code,
  Bold,
  Italic,
  Type,
  ImagePlus,
  Paperclip,
  Sparkle,
  Pencil,
  Calendar,
  Lock,
  Unlock,
  ExternalLink,
} from 'lucide-react';
import api from '../../lib/api';
import { aiApi } from '../../lib/aiApi';
import { AiGeneratePanel } from '../../components/AiGeneratePanel';
import { coursesAdminApi, type Chapter, type ChapterLesson, type ChapterResource, type ResourceType } from '../../lib/coursesAdminApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnum } from '../../lib/cms';

// ──────────────────────────────────────────────────────────────────────────
// 1) 列表模式(原 AdminCoursesPage,几乎原样保留)
// ──────────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  instructor: string;
  costType: string;
  courseType: string;
  price: number;
  status: string;
}

function CourseListView() {
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
    courseType: 'own',
    externalUrl: '',
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
        courseType: 'own',
        externalUrl: '',
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

  const courseTypeLabel = (t: string) => {
    switch (t) {
      case 'own': return '自有';
      case 'partner': return '合作';
      case 'public': return '公开';
      case 'third_party': return '第三方';
      default: return t;
    }
  };

  const courseTypeBadgeClass = (t: string) => {
    switch (t) {
      case 'own': return 'bg-[#171717] text-white';
      case 'partner': return 'bg-[#4B5563] text-white';
      case 'public': return 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50';
      case 'third_party': return 'bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50';
      default: return 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2">
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
          className="inline-flex items-center gap-2 px-5 py-3 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 text-xs font-black uppercase tracking-widest hover:bg-[#171717] hover:text-white transition-colors"
        >
          <Link2 className="w-4 h-4" /> 从 URL 导入
        </button>
      </div>

      {isImporting && (
        <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2">
            / Import Course From URL
          </div>
          <p className="text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-4 leading-relaxed">
            支持 YouTube（youtube.com / youtu.be）和 Bilibili（bilibili.com）公开视频。
            系统会自动抓取标题、封面、作者，并通过 AI 生成描述、学习要点、难度和标签，作为草稿保存，需审核后发布。
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800"
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
              className="px-6 py-3 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
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
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2">
              / Batch Import（一次最多 20 条）
            </div>
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.bilibili.com/video/BV...\n（每行一条 URL）'}
              rows={4}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-xs font-mono focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 resize-none"
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
                className="px-6 py-3 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
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
        <form onSubmit={handleSubmit} className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-4">
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
                courseType: draft.courseType ?? 'own',
                externalUrl: draft.externalUrl ?? '',
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
                className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800"
              >
                <option value="Beginner">入门</option>
                <option value="Intermediate">进阶</option>
                <option value="Advanced">高级</option>
                <option value="Expert">专家</option>
              </select>
            </div>
            <Field label="时长（如：45 分钟）" required value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
            <div>
              <Label>付费类型</Label>
              <select
                value={form.costType}
                onChange={(e) => setForm({ ...form, costType: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800"
              >
                <option value="free">免费</option>
                <option value="paid">付费</option>
                <option value="charity">公益</option>
              </select>
            </div>
            <div>
              <Label>课程来源</Label>
              <select
                value={form.courseType}
                onChange={(e) => setForm({ ...form, courseType: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800"
              >
                <option value="own">自有课程</option>
                <option value="partner">合作课程</option>
                <option value="public">公开课程</option>
                <option value="third_party">第三方课程</option>
              </select>
            </div>
            <Field
              label="价格"
              type="number"
              value={String(form.price)}
              onChange={(v) => setForm({ ...form, price: Number(v) })}
            />
            <Field
              label="外部链接（第三方课程必填）"
              value={form.externalUrl}
              onChange={(v) => setForm({ ...form, externalUrl: v })}
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
              className="px-6 py-3 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Course list */}
      <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400">
          <div className="col-span-12 md:col-span-1">#</div>
          <div className="col-span-12 md:col-span-4">Title</div>
          <div className="col-span-12 md:col-span-2">Instructor</div>
          <div className="col-span-12 md:col-span-1">Cost</div>
          <div className="col-span-12 md:col-span-1">Price</div>
          <div className="col-span-12 md:col-span-2">Source</div>
          <div className="col-span-12 md:col-span-1 text-right">Action</div>
        </div>
        {courses?.map((course, i) => (
          <div
            key={course.id}
            className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (courses?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors`}
          >
            <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-12 md:col-span-4 font-black tracking-tight truncate">
              <Link
                to={`/admin/courses?tab=info&id=${course.id}`}
                className="hover:underline"
              >
                {course.title}
              </Link>
            </div>
            <div className="col-span-12 md:col-span-2 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 text-xs">{course.instructor}</div>
            <div className="col-span-12 md:col-span-1 text-xs">
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  course.costType === 'free'
                    ? 'bg-[#171717] text-white'
                    : course.costType === 'charity'
                    ? 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50'
                    : 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50'
                }`}
              >
                {course.costType}
              </span>
            </div>
            <div className="col-span-12 md:col-span-1 font-bold text-sm">
              {course.costType === 'free' ? '—' : `¥${course.price}`}
            </div>
            <div className="col-span-12 md:col-span-2 text-xs">
              <span className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${courseTypeBadgeClass(course.courseType)}`}>
                {courseTypeLabel(course.courseType)}
              </span>
            </div>
            <div className="col-span-12 md:col-span-1 flex items-center justify-start md:justify-end gap-1">
              <Link
                to={`/admin/courses?tab=info&id=${course.id}`}
                className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                title="编辑"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
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
            <p className="text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">暂无课程，点击"新增课程"或使用 AI 智能填充快速创建</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2) 编辑模式:5 tab(v1.1.0 全部接真后端,无 mock)
// ──────────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'chapters' | 'pricing' | 'publish';

interface CourseForEdit {
  id: string;
  title: string;
  description: string;
  learningPoints: string; // JSON 字符串
  instructor: string;
  level: string;
  duration: string;
  thumbnail: string;
  tags: string; // JSON 字符串
  costType: 'free' | 'paid' | 'charity';
  courseType: 'own' | 'partner' | 'public' | 'third_party';
  externalUrl: string | null;
  price: number;
  status: 'draft' | 'published' | 'unpublished';
  publishedAt: string | null;
}

function useCourseEdit(courseId: string | undefined) {
  const queryClient = useQueryClient();
  const enabled = !!courseId;

  const courseQuery = useQuery({
    queryKey: ['admin-course-edit', courseId],
    queryFn: async () => {
      const { data } = await api.get<CourseForEdit>(`/api/v1/courses/${courseId}`);
      return data;
    },
    enabled,
  });

  const chaptersQuery = useQuery({
    queryKey: ['admin-course-chapters', courseId],
    queryFn: () => coursesAdminApi.listChapters(courseId!),
    enabled,
  });

  const updateCourse = useMutation({
    mutationFn: (payload: Partial<CourseForEdit> & { learningPoints?: string[]; tags?: string[] }) =>
      coursesAdminApi.updateCourse(courseId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-edit', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  return { courseQuery, chaptersQuery, updateCourse };
}

// ──────────────────────────────────────────────────────────────────────
// InfoTab — 基本信息(接 PATCH /api/v1/courses/:id 真后端)
// ──────────────────────────────────────────────────────────────────────

function InfoTab({ courseId }: { courseId: string }) {
  const { courseQuery, updateCourse } = useCourseEdit(courseId);
  const course = courseQuery.data;
  const { getLabel: getLevelLabel } = useEnum('course_level');
  const [form, setForm] = useState<{
    title: string;
    description: string;
    instructor: string;
    level: string;
    duration: string;
    thumbnail: string;
  }>({ title: '', description: '', instructor: '', level: 'Beginner', duration: '', thumbnail: '' });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title ?? '',
        description: course.description ?? '',
        instructor: course.instructor ?? '',
        level: course.level ?? 'Beginner',
        duration: course.duration ?? '',
        thumbnail: course.thumbnail ?? '',
      });
    }
  }, [course?.id, course?.title, course?.description, course?.instructor, course?.level, course?.duration, course?.thumbnail]);

  if (courseQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">加载中…</div>;
  }
  if (courseQuery.isError) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        加载失败：{(courseQuery.error as any)?.message ?? '未知错误'}
      </div>
    );
  }

  const save = () => {
    updateCourse.mutate(form, {
      onSuccess: () => alert('已保存'),
      onError: (e: any) => alert('保存失败：' + (e?.response?.data?.message ?? e?.message ?? '未知错误')),
    });
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
        <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-4">主要信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BrutalField
            label="课程标题"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
          />
          <BrutalField
            label="讲师"
            value={form.instructor}
            onChange={(v) => setForm({ ...form, instructor: v })}
            required
          />
          <BrutalSelect
            label="难度"
            value={form.level}
            onChange={(v) => setForm({ ...form, level: v })}
            options={[
              { value: 'Beginner', label: getLevelLabel('Beginner') || '入门' },
              { value: 'Intermediate', label: getLevelLabel('Intermediate') || '进阶' },
              { value: 'Advanced', label: getLevelLabel('Advanced') || '高级' },
              { value: 'Expert', label: getLevelLabel('Expert') || '专家' },
            ]}
          />
          <BrutalField
            label="总时长"
            value={form.duration}
            onChange={(v) => setForm({ ...form, duration: v })}
            placeholder="如 6.5h"
          />
          <div className="md:col-span-2">
            <BrutalField
              label="封面图 URL"
              value={form.thumbnail}
              onChange={(v) => setForm({ ...form, thumbnail: v })}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-1.5 block">课程描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 transition-colors resize-none"
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <BrutalButton
            variant="primary"
            size="sm"
            onClick={save}
            disabled={updateCourse.isPending}
          >
            {updateCourse.isPending ? '保存中…' : '保存修改'}
          </BrutalButton>
          {updateCourse.isSuccess && (
            <span className="text-xs bg-[#171717] text-white px-2 py-0.5 font-black uppercase tracking-widest">已保存</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ChaptersTab — 章节树 + 课时管理(全部接真后端)
// ──────────────────────────────────────────────────────────────────────

function ChaptersTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const { chaptersQuery } = useCourseEdit(courseId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeLesson, setActiveLesson] = useState<{ chapterId: string; lesson: ChapterLesson } | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  const chapters = chaptersQuery.data ?? [];

  const totalLessons = chapters.reduce((s, c) => s + c.lessons.length, 0);

  const createChapter = useMutation({
    mutationFn: (title: string) => coursesAdminApi.createChapter(courseId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters', courseId] });
      setNewChapterTitle('');
    },
  });

  const deleteChapter = useMutation({
    mutationFn: (id: string) => coursesAdminApi.deleteChapter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters', courseId] });
    },
  });

  const deleteLesson = useMutation({
    mutationFn: ({ lessonId }: { chapterId: string; lessonId: string }) =>
      coursesAdminApi.deleteLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters', courseId] });
    },
  });

  const addLesson = useMutation({
    mutationFn: ({ chapterId, title }: { chapterId: string; title: string }) =>
      coursesAdminApi.createLesson(chapterId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters', courseId] });
    },
  });

  if (chaptersQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">加载章节中…</div>;
  }
  if (chaptersQuery.isError) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        加载失败：{(chaptersQuery.error as any)?.message ?? '未知错误'}
      </div>
    );
  }

  const [mobileChaptersOpen, setMobileChaptersOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 overflow-hidden min-h-[500px]">
      {/* 章节树 — < lg 默认 hidden,点 mobile 按钮后显示在 lesson 编辑区上方 */}
      <aside className={`bg-white dark:bg-neutral-100 dark:bg-neutral-100 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 flex flex-col ${mobileChaptersOpen ? 'border-2' : 'hidden lg:flex border-r-0 lg:border-r-2'}`}>
        <div className="p-3 border-b border-[#171717] dark:border-neutral-50 dark:border-neutral-50">
          <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-2">章节大纲</h3>
          <div className="flex items-center gap-1">
            <input
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="新章节标题"
              className="flex-1 h-8 px-2 text-xs border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 focus:outline-none focus:border-[#171717] dark:border-neutral-50"
            />
            <BrutalButton
              variant="primary"
              size="sm"
              disabled={!newChapterTitle.trim() || createChapter.isPending}
              onClick={() => createChapter.mutate(newChapterTitle.trim())}
            >
              + 章节
            </BrutalButton>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.length === 0 && (
            <div className="text-[10px] text-[#A3A3A3] italic p-3 text-center">
              暂无章节 · 在上方添加
            </div>
          )}
          {chapters.map((c, idx) => {
            const isOpen = expanded[c.id] ?? idx === 0;
            return (
              <div key={c.id}>
                <div className="flex items-center gap-1 p-1.5 hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setExpanded({ ...expanded, [c.id]: !isOpen })}
                    className="p-0.5"
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center bg-neutral-200 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-medium text-sm text-[#171717] dark:text-neutral-50 dark:text-neutral-50 truncate" title={c.title}>
                    {c.title}
                  </span>
                  <span className="text-[10px] text-[#666666] dark:text-neutral-400 dark:text-neutral-400 font-mono">{c.lessons.length}</span>
                  <button
                    onClick={() => {
                      if (confirm(`删除章节「${c.title}」？将级联软删其下 ${c.lessons.length} 个课时`)) {
                        deleteChapter.mutate(c.id);
                      }
                    }}
                    className="p-1 text-[#A3A3A3] hover:text-[#171717] dark:text-neutral-50 hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800"
                    title="删除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isOpen && (
                  <div className="ml-6 pl-2 border-l border-[#171717] dark:border-neutral-50 dark:border-neutral-50 space-y-0.5 mt-1">
                    {c.lessons.map((l) => (
                      <div
                        key={l.id}
                        className={`flex items-center gap-1 p-1.5 text-xs cursor-pointer transition-colors ${
                          activeLesson?.lesson.id === l.id
                            ? 'bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 font-medium'
                            : 'hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 text-neutral-700'
                        }`}
                        onClick={() => {
                          setActiveLesson({ chapterId: c.id, lesson: l });
                          setMobileChaptersOpen(false);
                        }}
                      >
                        <VideoIcon className="w-3.5 h-3.5 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 shrink-0" />
                        <span className="flex-1 truncate" title={l.title}>{l.title}</span>
                        {l.isPreview && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#171717] dark:text-neutral-50 dark:text-neutral-50 bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 px-1 py-0.5">
                            试看
                          </span>
                        )}
                      </div>
                    ))}
                    <NewLessonRow chapterId={c.id} onAdd={(title) => addLesson.mutate({ chapterId: c.id, title })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400">
          共 {chapters.length} 章 · {totalLessons} 课时
        </div>
      </aside>

      <div className="bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 p-4">
        {/* mobile 章节树 toggle — < lg 显示,≥ lg 隐藏 */}
        <div className="lg:hidden mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileChaptersOpen(!mobileChaptersOpen)}
            aria-expanded={mobileChaptersOpen}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
          >
            {mobileChaptersOpen ? '收起章节' : `章节(${chapters.length})`}
          </button>
          {activeLesson && (
            <span className="text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 truncate">
              当前编辑:{activeLesson.lesson.title}
            </span>
          )}
        </div>
        {activeLesson ? (
          <LessonDetail
            lesson={activeLesson.lesson}
            onDelete={() => {
              if (confirm(`删除课时「${activeLesson.lesson.title}」？`)) {
                deleteLesson.mutate(
                  { chapterId: activeLesson.chapterId, lessonId: activeLesson.lesson.id },
                  { onSuccess: () => setActiveLesson(null) },
                );
              }
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">
            <div className="text-center">
              <VideoIcon className="w-10 h-10 mx-auto mb-2 text-[#A3A3A3]" />
              点击左侧课时查看 / 编辑元数据
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewLessonRow({ chapterId: _chapterId, onAdd }: { chapterId: string; onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left p-1.5 text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 hover:text-white hover:bg-[#171717] transition-colors"
      >
        + 添加课时
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 p-1">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim());
            setTitle('');
            setOpen(false);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setTitle('');
          }
        }}
        placeholder="新课时标题"
        className="flex-1 h-7 px-2 text-xs border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 focus:outline-none focus:border-[#171717] dark:border-neutral-50"
      />
      <button
        onClick={() => {
          if (title.trim()) {
            onAdd(title.trim());
            setTitle('');
            setOpen(false);
          }
        }}
        className="px-2 h-7 bg-[#171717] text-white text-xs"
      >
        +
      </button>
      <button
        onClick={() => { setOpen(false); setTitle(''); }}
        className="px-1 h-7 text-[#A3A3A3] hover:text-[#171717] dark:text-neutral-50"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function LessonDetail({ lesson, onDelete }: { lesson: ChapterLesson; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? '');
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? '');
  const [isPreview, setIsPreview] = useState(lesson.isPreview);

  // 资源管理(v1.3.0)
  const [addingResource, setAddingResource] = useState(false);
  const [newResource, setNewResource] = useState<{ title: string; url: string; type: ResourceType }>({
    title: '',
    url: '',
    type: 'pdf',
  });

  useEffect(() => {
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setVideoUrl(lesson.videoUrl ?? '');
    setIsPreview(lesson.isPreview);
  }, [lesson.id]);

  // 资源:优先用 lesson.resources(章节树一次拉到位),否则单独拉
  const resourcesQuery = useQuery({
    queryKey: ['admin-lesson-resources', lesson.id],
    queryFn: () => coursesAdminApi.listResources(lesson.id),
    initialData: lesson.resources,
  });

  const save = useMutation({
    mutationFn: () =>
      coursesAdminApi.updateLesson(lesson.id, { title, description, videoUrl, isPreview }),
  });

  const createResource = useMutation({
    mutationFn: () => coursesAdminApi.createResource(lesson.id, { ...newResource, isLocked: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lesson-resources', lesson.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters'] });
      setAddingResource(false);
      setNewResource({ title: '', url: '', type: 'pdf' });
    },
  });

  const deleteResource = useMutation({
    mutationFn: (id: string) => coursesAdminApi.deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lesson-resources', lesson.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-course-chapters'] });
    },
  });

  const resources = resourcesQuery.data ?? [];

  return (
    <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
      <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-4">课时详情</h3>
      <div className="space-y-3">
        <BrutalField label="标题" value={title} onChange={setTitle} required />
        <BrutalField
          label="视频 URL"
          value={videoUrl}
          onChange={setVideoUrl}
          placeholder="https://cdn.opencsg.ai/lessons/...mp4"
        />
        <div>
          <label className="text-sm font-medium text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-1.5 block">描述 / 笔记</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 transition-colors resize-none"
            placeholder="支持 Markdown（生产环境可接渲染器）"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-[#171717] dark:text-neutral-50 dark:text-neutral-50">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
            className="w-4 h-4 accent-[#171717]"
          />
          <span>设为试看课时（未报名可看）</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2 pt-4 border-t border-[#171717] dark:border-neutral-50 dark:border-neutral-50">
        <BrutalButton
          variant="primary"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? '保存中…' : '保存课时'}
        </BrutalButton>
        <BrutalButton variant="danger" size="sm" onClick={onDelete}>
          删除课时
        </BrutalButton>
        {save.isSuccess && <span className="text-xs bg-[#171717] text-white px-2 py-0.5 font-black uppercase tracking-widest">已保存</span>}
        {save.isError && <span className="text-xs text-red-600">保存失败</span>}
      </div>

      {/* 资源管理 v1.3.0 */}
      <div className="mt-6 pt-4 border-t border-[#171717] dark:border-neutral-50 dark:border-neutral-50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50">附加资源 · {resources.length}</h4>
          {!addingResource && (
            <BrutalButton
              variant="secondary"
              size="sm"
              onClick={() => setAddingResource(true)}
            >
              添加资源
            </BrutalButton>
          )}
        </div>

        {addingResource && (
          <div className="border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                autoFocus
                value={newResource.title}
                onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                placeholder="资源标题"
                className="px-3 py-2 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm bg-white dark:bg-neutral-100 dark:bg-neutral-100 focus:outline-none focus:border-[#171717] dark:border-neutral-50"
              />
              <select
                value={newResource.type}
                onChange={(e) => setNewResource({ ...newResource, type: e.target.value as ResourceType })}
                className="px-3 py-2 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm bg-white dark:bg-neutral-100 dark:bg-neutral-100 focus:outline-none focus:border-[#171717] dark:border-neutral-50"
              >
                <option value="pdf">PDF</option>
                <option value="code">代码</option>
                <option value="link">链接</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
              <input
                value={newResource.url}
                onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                placeholder="https://..."
                className="px-3 py-2 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm bg-white dark:bg-neutral-100 dark:bg-neutral-100 focus:outline-none focus:border-[#171717] dark:border-neutral-50 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <BrutalButton
                variant="primary"
                size="sm"
                disabled={!newResource.title || !newResource.url || createResource.isPending}
                onClick={() => createResource.mutate()}
              >
                {createResource.isPending ? '保存中…' : '保存'}
              </BrutalButton>
              <BrutalButton
                variant="danger"
                size="sm"
                onClick={() => {
                  setAddingResource(false);
                  setNewResource({ title: '', url: '', type: 'pdf' });
                }}
              >
                取消
              </BrutalButton>
            </div>
          </div>
        )}

        {resources.length === 0 && !addingResource ? (
          <div className="border border-dashed border-[#171717] dark:border-neutral-50 dark:border-neutral-50 rounded p-6 text-center text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400">
            暂无资源 · 点击「添加资源」挂 PDF / 代码 / 链接
          </div>
        ) : (
          <div className="space-y-1.5">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 p-2 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 group"
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 bg-neutral-900 text-white text-[10px] font-black uppercase"
                  title={r.type}
                >
                  {r.type.slice(0, 3)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#171717] dark:text-neutral-50 dark:text-neutral-50 truncate" title={r.title}>
                    {r.title}
                  </div>
                  <div className="text-[10px] font-mono text-[#666666] dark:text-neutral-400 dark:text-neutral-400 truncate" title={r.url}>
                    {r.url}
                  </div>
                </div>
                {r.isLocked ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#666666] dark:text-neutral-400 dark:text-neutral-400"
                    title="报名后解锁"
                  >
                    <Lock className="w-3 h-3" /> 锁
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800 text-[#171717] dark:text-neutral-50 dark:text-neutral-50"
                    title="公开"
                  >
                    <Unlock className="w-3 h-3" /> 公开
                  </span>
                )}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 hover:bg-neutral-100 hover:text-[#171717] dark:text-neutral-50"
                  title="在新窗口打开"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => {
                    if (confirm(`删除资源「${r.title}」?`)) {
                      deleteResource.mutate(r.id);
                    }
                  }}
                  className="p-1.5 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ResourcesTab — v1.3.0 起资源管理迁到 LessonDetail 内
// (resource 是 lesson 级而非 course 级,放在课时面板更准确)
// 保留函数兼容 router 引用,改返回 EmptyState 避免误点
// ──────────────────────────────────────────────────────────────────────

function ResourcesTab({ courseId: _courseId }: { courseId: string }) {
  return (
    <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
      <div className="border-2 border-dashed border-[#171717] dark:border-neutral-50 dark:border-neutral-50 p-12 text-center">
        <FileText className="w-10 h-10 mx-auto mb-2 text-[#A3A3A3]" />
        <p className="text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">资源已迁到「章节大纲」tab</p>
        <p className="text-[10px] text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mt-1">
          在章节大纲里选中具体课时,在右侧课时详情面板的「附加资源」段管理
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PricingTab — 价格(接 PATCH /api/v1/courses/:id 真后端)
// ──────────────────────────────────────────────────────────────────────

function PricingTab({ courseId }: { courseId: string }) {
  const { courseQuery, updateCourse } = useCourseEdit(courseId);
  const course = courseQuery.data;
  const [costType, setCostType] = useState<'free' | 'paid' | 'charity'>('free');
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (course) {
      setCostType(course.costType);
      setPrice(course.price);
    }
  }, [course?.id, course?.costType, course?.price]);

  if (courseQuery.isLoading) return <div className="p-8 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">加载中…</div>;

  const save = () => {
    updateCourse.mutate(
      { costType, price: costType === 'free' ? 0 : price },
      { onSuccess: () => alert('已保存') },
    );
  };

  const plans = [
    { id: 'free' as const, title: '免费', sub: '全部章节对所有人开放', priceHint: '¥ 0' },
    { id: 'paid' as const, title: '付费买断', sub: '一次付费，永久学习', priceHint: `¥ ${price}` },
    { id: 'charity' as const, title: '公益', sub: '自由付费，部分收入捐赠', priceHint: '¥ 0+ 自定' },
  ];

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
        <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-1">价格模式</h3>
        <p className="text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-4">选择主要定价方式</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map((p) => {
            const active = costType === p.id;
            return (
              <label
                key={p.id}
                className={`p-4 border-2 cursor-pointer transition-colors ${
                  active ? 'border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-[#EEEDE9] dark:bg-neutral-800 dark:bg-neutral-800' : 'border-[#171717] dark:border-neutral-50 dark:border-neutral-50 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="plan"
                    checked={active}
                    onChange={() => setCostType(p.id)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  <span className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50">{p.title}</span>
                </div>
                <p className="mt-1 text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400">{p.sub}</p>
                <p className="mt-2 text-base font-mono font-bold text-[#171717] dark:text-neutral-50 dark:text-neutral-50">{p.priceHint}</p>
              </label>
            );
          })}
        </div>
      </div>

      {costType === 'paid' && (
        <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
          <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 mb-4">买断定价</h3>
          <BrutalField
            label="售价 (¥)"
            type="number"
            value={String(price)}
            onChange={(v) => setPrice(Number(v))}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <BrutalButton variant="primary" size="sm" onClick={save} disabled={updateCourse.isPending}>
          {updateCourse.isPending ? '保存中…' : '保存修改'}
        </BrutalButton>
        {updateCourse.isSuccess && <span className="text-xs bg-[#171717] text-white px-2 py-0.5 font-black uppercase tracking-widest">已保存</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PublishTab — 发布设置(接 PATCH /api/v1/courses/:id 真后端)
// ──────────────────────────────────────────────────────────────────────

function PublishTab({ courseId }: { courseId: string }) {
  const { courseQuery, updateCourse } = useCourseEdit(courseId);
  const course = courseQuery.data;
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (course) setIsPublished(course.status === 'published');
  }, [course?.id, course?.status]);

  if (courseQuery.isLoading) return <div className="p-8 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">加载中…</div>;

  const save = () => {
    updateCourse.mutate(
      { status: isPublished ? 'published' : 'unpublished' },
      { onSuccess: () => alert(isPublished ? '已发布' : '已下架') },
    );
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#171717] dark:border-neutral-50 dark:border-neutral-50 bg-white dark:bg-neutral-100 dark:bg-neutral-100 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50">上下架状态</h3>
            <p className="text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mt-1">
              {isPublished ? '课程已发布，正在招生中' : '课程未发布，只有内部可见'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublished((p) => !p)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              isPublished ? 'bg-[#EEEDE9] dark:bg-neutral-8000' : 'bg-neutral-200'
            }`}
            aria-pressed={isPublished}
            aria-label="上下架"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white dark:bg-neutral-100 dark:bg-neutral-100 rounded-full shadow transition-transform ${
                isPublished ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <BrutalButton variant="primary" size="sm" onClick={save} disabled={updateCourse.isPending}>
          {updateCourse.isPending ? '处理中…' : isPublished ? '发布课程' : '下架课程'}
        </BrutalButton>
        {updateCourse.isSuccess && <span className="text-xs bg-[#171717] text-white px-2 py-0.5 font-black uppercase tracking-widest">已保存</span>}
      </div>
    </div>
  );
}

// ── 编辑模式主组件 ──────────────────────────────────────────────────────

function CourseEditView({ courseId, tab }: { courseId?: string; tab: Tab }) {
  const { courseQuery, chaptersQuery } = useCourseEdit(courseId);
  const course = courseQuery.data;
  const chapters = chaptersQuery.data ?? [];
  const [currentTab, setCurrentTab] = useState<Tab>(tab);

  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);

  if (!courseId) {
    return (
      <div className="p-12 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">
        请在 URL 中提供 <code>?id=...</code> 参数
      </div>
    );
  }

  const TABS_DYNAMIC: { id: Tab; label: string; count?: string }[] = [
    { id: 'info', label: '基本信息' },
    { id: 'chapters', label: '章节大纲', count: `${chapters.length} 章` },
    { id: 'pricing', label: '价格 / 试看' },
    { id: 'publish', label: '发布设置' },
  ];

  return (
    <div className="-mx-6 -my-8">
      <header className="bg-white dark:bg-neutral-100 dark:bg-neutral-100 border-b border-[#171717] dark:border-neutral-50 dark:border-neutral-50 sticky top-0 z-30">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/admin/courses"
              className="text-[#666666] dark:text-neutral-400 dark:text-neutral-400 hover:text-[#171717] dark:text-neutral-50 shrink-0"
              aria-label="返回课程列表"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-neutral-300">/</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#171717] dark:text-neutral-50 dark:text-neutral-50 truncate">
                {courseQuery.isLoading ? '加载中…' : course?.title ?? '未知课程'}
              </div>
              <div className="text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400 flex items-center gap-2 flex-wrap">
                <span>
                  课程 ID: <span className="font-mono">{courseId}</span>
                </span>
                {course && (
                  <>
                    <span>·</span>
                    <span
                      className={
                        course.status === 'published'
                          ? 'bg-[#171717] text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-0.5'
                          : 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#666666] dark:text-neutral-400 dark:text-neutral-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-0.5'
                      }
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          course.status === 'published' ? 'bg-[#171717]' : 'bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50'
                        }`}
                      />
                      {course.status === 'published' ? '已发布' : '未发布'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <BrutalButton variant="secondary" size="sm">
              预览
            </BrutalButton>
            <Link to={`/courses/${courseId}`} target="_blank">
              <BrutalButton variant="secondary" size="sm">
                查看公开页
              </BrutalButton>
            </Link>
          </div>
        </div>
        <div className="px-4 sm:px-6 flex gap-6 overflow-x-auto text-sm">
          {TABS_DYNAMIC.map((t) => {
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCurrentTab(t.id)}
                className={`py-3 border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 font-medium'
                    : 'border-transparent text-[#666666] dark:text-neutral-400 dark:text-neutral-400 hover:text-[#171717] dark:text-neutral-50'
                }`}
              >
                {t.label}
                {t.count && <span className="ml-1 text-xs text-[#666666] dark:text-neutral-400 dark:text-neutral-400">· {t.count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 pb-12">
        {courseQuery.isLoading && currentTab !== 'chapters' ? (
          <div className="p-8 text-center text-sm text-[#666666] dark:text-neutral-400 dark:text-neutral-400">加载课程中…</div>
        ) : courseQuery.isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            加载失败：{(courseQuery.error as any)?.message ?? '未知错误'}
          </div>
        ) : (
          <>
            {currentTab === 'info' && <InfoTab courseId={courseId} />}
            {currentTab === 'chapters' && <ChaptersTab courseId={courseId} />}
            {currentTab === 'pricing' && <PricingTab courseId={courseId} />}
            {currentTab === 'publish' && <PublishTab courseId={courseId} />}
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 路由层:根据 ?tab 决定走哪种 view
// ──────────────────────────────────────────────────────────────────────────

const VALID_TABS: Tab[] = ['info', 'chapters', 'pricing', 'publish'];

export function AdminCoursesPage() {
  const [params] = useSearchParams();
  const tab = params.get('tab') as Tab | null;
  const courseId = params.get('id') ?? undefined;

  const isEditMode = tab && VALID_TABS.includes(tab);

  if (isEditMode) {
    return <CourseEditView courseId={courseId} tab={tab as Tab} />;
  }
  return <CourseListView />;
}

// ── 列表模式用到的 Field / Label 组件(原 AdminCoursesPage 已有) ──
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2 block">
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
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800"
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Brutalist 表单组件 — 跟 AdminBadgesPage / AdminDashboardPage 同风格
// 黑白硬边、无圆角、统一 tracking-widest 标签
// ──────────────────────────────────────────────────────────────────────

function BrutalField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2 flex items-center gap-1">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 transition-colors resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 transition-colors"
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
      <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 dark:text-neutral-400 mb-2 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white dark:bg-neutral-100 dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-sm focus:outline-none focus:bg-[#EEEDE9] dark:bg-neutral-800 dark:focus:bg-neutral-800 transition-colors"
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

function BrutalButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-colors disabled:opacity-50';
  const sizeCls = size === 'sm' ? 'px-4 py-2 text-[10px]' : 'px-6 py-3 text-xs';
  const variantCls = {
    primary: 'bg-[#171717] text-white hover:bg-[#262626]',
    secondary: 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800',
    danger: 'border border-[#171717] dark:border-neutral-50 dark:border-neutral-50 text-[#171717] dark:text-neutral-50 dark:text-neutral-50 hover:bg-[#171717] hover:text-white',
  }[variant];
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizeCls} ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
}

function BrutalIconButton({
  onClick,
  children,
  title,
  className = '',
  danger,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 ${danger ? 'text-[#A3A3A3] hover:text-red-600 hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800' : 'text-[#A3A3A3] hover:text-[#171717] dark:text-neutral-50 hover:bg-[#EEEDE9] dark:bg-neutral-800 dark:hover:bg-neutral-800 dark:hover:bg-neutral-800'} transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
