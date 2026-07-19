/**
 * AdminCoursesPage — P0-8 课程编辑(扩展)
 *
 * 两种模式(由 URL ?tab= 决定):
 *   1) /admin/courses           → 列表模式(保留原 AdminCoursesPage 的 list + 新增/导入)
 *   2) /admin/courses?tab=...   → 编辑模式(5 tab:info / chapters / resources / pricing / publish)
 *
 * 设计参考: review/mocks/mock-admin-course-edit.html
 *
 * 5 tab:
 *   - info      基本信息(标题/副标题/讲师/难度/时长/标签/试看/封面)
 *   - chapters  章节大纲(左侧 Chapter→Lesson 树,中间编辑器,右侧字段面板,纯前端 mock)
 *   - resources 资源(简化)
 *   - pricing   价格(免费/买断/订阅 3 radio card)
 *   - publish   发布(上下架 switch + 发布时间 picker)
 *
 * 后端 P0-8 暂未实现:
 *   - 章节树 CRUD 纯前端 mock,标 TODO
 *   - 数据 hardcode,标 TODO: 接 /api/v1/courses/{id}/chapters
 *   - 富文本用 textarea + 预览,不上 Tiptap/Lexical
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
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';
import { aiApi } from '../../lib/aiApi';
import { AiGeneratePanel } from '../../components/AiGeneratePanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
      case 'public': return 'border border-[#171717] text-[#171717]';
      case 'third_party': return 'bg-[#EEEDE9] text-[#171717] border border-[#171717]';
      default: return 'border border-[#171717]';
    }
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
              <Label>付费类型</Label>
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
            <div>
              <Label>课程来源</Label>
              <select
                value={form.courseType}
                onChange={(e) => setForm({ ...form, courseType: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9]"
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
              className="px-6 py-3 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Course list */}
      <div className="border-2 border-[#171717] bg-white">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
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
            } hover:bg-[#F5F4F0] transition-colors`}
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
            <div className="col-span-12 md:col-span-2 text-[#666666] text-xs">{course.instructor}</div>
            <div className="col-span-12 md:col-span-1 text-xs">
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
            <p className="text-sm text-[#666666]">暂无课程，点击"新增课程"或使用 AI 智能填充快速创建</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2) 编辑模式:5 tab
// ──────────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'chapters' | 'resources' | 'pricing' | 'publish';

const TABS: { id: Tab; label: string; count?: string }[] = [
  { id: 'info', label: '基本信息' },
  { id: 'chapters', label: '章节大纲', count: '5 章' },
  { id: 'resources', label: '资源', count: '12' },
  { id: 'pricing', label: '价格 / 试看' },
  { id: 'publish', label: '发布设置' },
];

// ── Mock 课程数据(P0-8 后端未接) ─────────────────────────────────────
const MOCK_COURSE = {
  id: 'c_01h8f3kq',
  title: '用 LangChain 搭建第一个 Agent',
  status: 'published' as 'published' | 'draft' | 'unpublished',
  savedAt: '2 分钟前',
};

interface MockLesson {
  id: string;
  title: string;
  isPreview: boolean;
  isCompleted: boolean;
  isProject?: boolean;
  duration?: string;
  active?: boolean;
}

interface MockChapter {
  id: string;
  index: number;
  title: string;
  lessons: MockLesson[];
  defaultOpen: boolean;
}

const MOCK_CHAPTERS: MockChapter[] = [
  {
    id: 'ch1',
    index: 1,
    title: '第一章 · Agent 心智模型',
    defaultOpen: true,
    lessons: [
      { id: 'l11', title: '1.1 什么是 Agent', isPreview: true, isCompleted: true },
      { id: 'l12', title: '1.2 LLM 如何"思考"', isPreview: true, isCompleted: true },
      { id: 'l13', title: '1.3 第一个最小 Agent(命令行版)', isPreview: false, isCompleted: false, duration: '8:15', active: true },
      { id: 'l14', title: '1.4 ReAct:Reason + Act', isPreview: false, isCompleted: false, duration: '22:08' },
      { id: 'l15', title: '1.5 调试 Agent', isPreview: false, isCompleted: false, duration: '15:30' },
      { id: 'l16', title: '1.6 章节项目', isPreview: false, isCompleted: false, isProject: true },
    ],
  },
  { id: 'ch2', index: 2, title: '第二章 · Tool Calling', defaultOpen: false, lessons: [] },
  { id: 'ch3', index: 3, title: '第三章 · Memory', defaultOpen: false, lessons: [] },
  { id: 'ch4', index: 4, title: '第四章 · Chain', defaultOpen: false, lessons: [] },
  { id: 'ch5', index: 5, title: '第五章 · 期末项目', defaultOpen: false, lessons: [] },
];

// ── 基本信息 tab ────────────────────────────────────────────────────────
function InfoTab() {
  const [title, setTitle] = useState(MOCK_COURSE.title);
  const [subtitle, setSubtitle] = useState('5 分钟跑通,30 行代码,人人能学');
  const [instructor, setInstructor] = useState('张天飞');
  const [level, setLevel] = useState('Beginner');
  const [duration, setDuration] = useState('6.5h');
  const [tags, setTags] = useState('LangChain, Agent, LLM, Python');
  const [previewLesson, setPreviewLesson] = useState('1.1');
  const [coverFile, setCoverFile] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">主要信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="课程标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Input
              label="副标题"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              hint="一句话说清卖点,展示在卡片下方"
            />
            <Input
              label="讲师"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              leftIcon={<UserIcon className="w-4 h-4" />}
              required
            />
            <div>
              <label className="text-sm font-medium text-neutral-900 mb-1.5 block">难度</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-neutral-200 bg-neutral-0 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="Beginner">入门</option>
                <option value="Intermediate">进阶</option>
                <option value="Advanced">高级</option>
                <option value="Expert">专家</option>
              </select>
            </div>
            <Input
              label="总时长"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              leftIcon={<ClockIcon className="w-4 h-4" />}
            />
            <Input
              label="标签"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              leftIcon={<TagIcon className="w-4 h-4" />}
              hint="用逗号分隔,最多 8 个"
            />
          </div>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">试看设置</h3>
          <p className="text-xs text-neutral-600 mb-3">
            未报名用户可试看选中的课时。最多 3 节。
          </p>
          <div className="space-y-2">
            {['1.1 什么是 Agent', '1.2 LLM 如何"思考"', '1.3 第一个最小 Agent'].map(
              (lesson) => (
                <label
                  key={lesson}
                  className="flex items-center gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={previewLesson === lesson}
                    onChange={() => setPreviewLesson(lesson)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-sm text-neutral-900 flex-1">{lesson}</span>
                  {previewLesson === lesson && (
                    <span className="text-[10px] font-medium text-success-500 bg-success-500/10 px-2 py-0.5 rounded-full">
                      试看
                    </span>
                  )}
                </label>
              ),
            )}
          </div>
        </Card>
      </div>

      <Card padding="md" className="lg:col-span-1">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">封面图</h3>
        <div className="aspect-video w-full rounded-lg bg-neutral-100 border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden">
          {coverFile ? (
            <img
              src={coverFile}
              alt="封面预览"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center px-4">
              <ImageIcon className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
              <p className="text-xs text-neutral-600">支持 JPG/PNG,16:9,≤2MB</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-200 text-sm hover:border-brand-500 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>选择文件</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // mock:不真传,只读 dataURL 做本地预览
                  const reader = new FileReader();
                  reader.onload = () => setCoverFile(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
          {coverFile && (
            <Button variant="ghost" size="sm" onClick={() => setCoverFile(null)}>
              移除
            </Button>
          )}
        </div>
        <p className="mt-3 text-[10px] text-warning-500">
          ⚠ TODO: P0-8 后端暂未实现,封面仅本地预览,保存草稿不会真上传
        </p>
      </Card>
    </div>
  );
}

// ── 章节大纲 tab ────────────────────────────────────────────────────────
function ChapterTreeItem({
  chapter,
  activeId,
  onSelect,
  expanded,
  onToggle,
}: {
  chapter: MockChapter;
  activeId: string;
  onSelect: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-neutral-50 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        )}
        <span
          className={
            'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ' +
            (chapter.defaultOpen
              ? 'bg-success-500/10 text-success-500'
              : 'bg-neutral-200 text-neutral-600')
          }
        >
          {chapter.index}
        </span>
        <span className="flex-1 font-medium text-sm text-neutral-900 truncate">
          {chapter.title}
        </span>
        <span className="text-[10px] text-neutral-400 font-mono">
          {chapter.lessons.length || '0'} 课时
        </span>
      </button>
      {expanded && chapter.lessons.length > 0 && (
        <div className="ml-3 pl-3 border-l border-neutral-200 space-y-0.5 mt-1">
          {chapter.lessons.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelect(l.id)}
              className={
                'w-full flex items-center gap-2 p-1.5 rounded text-xs text-left transition-colors ' +
                (activeId === l.id
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'hover:bg-neutral-50 text-neutral-700')
              }
            >
              {l.isCompleted ? (
                <Check className="w-3.5 h-3.5 text-success-500 shrink-0" />
              ) : l.isProject ? (
                <Code className="w-3.5 h-3.5 text-xp-500 shrink-0" />
              ) : (
                <VideoIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              )}
              <span className="flex-1 truncate">{l.title}</span>
              {l.isPreview && (
                <span className="text-[10px] font-medium text-success-500 bg-success-500/10 px-1.5 py-0.5 rounded-full">
                  试看
                </span>
              )}
              {l.isProject && (
                <span className="text-[10px] font-medium text-xp-500 bg-xp-500/10 px-1.5 py-0.5 rounded-full">
                  项目
                </span>
              )}
              {l.duration && (
                <span className="text-[10px] text-neutral-400 font-mono">{l.duration}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left p-1.5 text-xs text-neutral-400 hover:text-brand-500"
          >
            + 添加课时
          </button>
        </div>
      )}
    </div>
  );
}

function LessonEditor() {
  const [content, setContent] = useState(`# 第一个最小 Agent(命令行版)

这一节我们写一个能回答本地问题的 Agent,只调一个 tool:查当前时间。整个过程 5 分钟。

## 核心代码

看下面这 30 行,先别急着理解每一行,我们跑起来再讲。

\`\`\`python
from langchain.agents import initialize_agent, Tool
from langchain.llms import OpenAI
from datetime import datetime

def get_time(_: str) -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

tools = [Tool(name="GetTime", func=get_time, description="返回当前时间")]

agent = initialize_agent(
    tools, OpenAI(temperature=0), agent="zero-shot-react-description", verbose=True
)

print(agent.run("现在几点了?"))
\`\`\`

## 怎么跑

1. 把上面代码存为 \`agent.py\`
2. 设置 \`export OPENAI_API_KEY=sk-...\`
3. 运行 \`python agent.py\`
`);
  const [isPreview, setIsPreview] = useState(false);

  return (
    <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span>第一章</span>
          <span>/</span>
          <span>1.3 第一个最小 Agent(命令行版)</span>
          <span className="ml-auto font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500" />已自动保存
          </span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-neutral-900">
          1.3 第一个最小 Agent(命令行版)
        </h2>
      </div>
      {/* toolbar */}
      <div className="border-b border-neutral-200 px-4 py-2 flex items-center gap-1 overflow-x-auto bg-neutral-50">
        <button className="p-1.5 rounded hover:bg-neutral-100" title="标题">
          <Type className="w-4 h-4 text-neutral-700" />
        </button>
        <button className="p-1.5 rounded hover:bg-neutral-100" title="粗体">
          <Bold className="w-4 h-4 text-neutral-700" />
        </button>
        <button className="p-1.5 rounded hover:bg-neutral-100" title="斜体">
          <Italic className="w-4 h-4 text-neutral-700" />
        </button>
        <div className="w-px h-5 bg-neutral-200 mx-1" />
        <button className="p-1.5 rounded hover:bg-neutral-100" title="代码块">
          <Code className="w-4 h-4 text-neutral-700" />
        </button>
        <button className="p-1.5 rounded hover:bg-neutral-100" title="图片">
          <ImagePlus className="w-4 h-4 text-neutral-700" />
        </button>
        <button className="p-1.5 rounded hover:bg-neutral-100" title="附件">
          <Paperclip className="w-4 h-4 text-neutral-700" />
        </button>
        <div className="w-px h-5 bg-neutral-200 mx-1" />
        <button className="p-1.5 rounded hover:bg-neutral-100" title="AI 帮写">
          <Sparkle className="w-4 h-4 text-xp-500" />
        </button>
        <div className="ml-auto text-xs text-neutral-600 flex items-center gap-2">
          <span>
            字数 <span className="font-mono">{content.length.toLocaleString()}</span>
          </span>
          <span>·</span>
          <span>预计阅读 {Math.max(1, Math.round(content.length / 300))} 分钟</span>
          <button
            onClick={() => setIsPreview((p) => !p)}
            className="ml-2 px-2 py-1 rounded border border-neutral-200 hover:border-brand-500"
          >
            {isPreview ? '编辑' : '预览'}
          </button>
        </div>
      </div>
      {/* 编辑器主体 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isPreview ? (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700 leading-relaxed">
              {content}
            </pre>
            <p className="mt-4 text-[10px] text-warning-500">
              ⚠ TODO: 简化版预览(纯文本),生产应接 markdown 渲染
            </p>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[400px] resize-none bg-transparent text-sm font-mono text-neutral-900 leading-relaxed focus:outline-none"
            placeholder="开始写课程内容…"
          />
        )}
      </div>
      {/* 视频上传 */}
      <div className="border-t border-neutral-200 p-4 flex items-center gap-3 bg-neutral-50">
        <div className="flex-1 p-3 rounded-md border border-dashed border-neutral-200 flex items-center gap-3 bg-neutral-0">
          <VideoIcon className="w-5 h-5 text-neutral-400 shrink-0" />
          <div className="flex-1 text-sm min-w-0">
            <div className="font-medium text-neutral-900 truncate">lesson-1-3-main.mp4</div>
            <div className="text-xs text-neutral-600">
              已上传 · 142 MB · 8:15 · 转码中 (60%)
            </div>
          </div>
          <Button variant="ghost" size="sm">
            替换
          </Button>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<Paperclip className="w-4 h-4" />}>
          + 附加资源
        </Button>
      </div>
    </Card>
  );
}

function LessonSettingsPanel() {
  const [isPreview, setIsPreview] = useState(true);
  const [keyPoints, setKeyPoints] = useState([
    'ReAct 循环显式痕迹',
    'tool schema 设计要点',
    'verbose 模式调试',
  ]);
  const [newPoint, setNewPoint] = useState('');

  return (
    <div className="p-5 space-y-5">
      <h3 className="text-sm font-semibold text-neutral-900">课时设置</h3>
      <Input label="课时标题" defaultValue="第一个最小 Agent(命令行版)" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="时长(秒)" type="number" defaultValue="495" />
        <Input label="顺序" type="number" defaultValue="3" />
      </div>
      <Input
        label="视频源 URL"
        defaultValue="https://cdn.opencsg.ai/lessons/1-3-main.mp4"
        className="font-mono text-xs"
      />
      <div className="p-3 rounded-md bg-brand-50 border border-brand-100">
        <label className="flex items-center gap-2 text-sm cursor-pointer text-neutral-900">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          <span>设为试看课时(未报名可看)</span>
        </label>
        <p className="mt-1 text-[10px] text-neutral-600">勾选后,未报名用户可试看本节</p>
      </div>
      <div>
        <label className="text-sm font-medium text-neutral-900 mb-1.5 block">
          关键点(AI 自动提取,可编辑)
        </label>
        <div className="space-y-1.5">
          {keyPoints.map((kp, i) => (
            <div
              key={kp}
              className="flex items-center gap-1 px-2 py-1 rounded bg-xp-500/10 text-xs text-xp-500"
            >
              <span className="flex-1 truncate">{kp}</span>
              <button
                onClick={() => setKeyPoints(keyPoints.filter((_, j) => j !== i))}
                className="text-neutral-400 hover:text-danger-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newPoint}
              onChange={(e) => setNewPoint(e.target.value)}
              placeholder="+ 添加关键点"
              size="sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPoint.trim()) {
                  setKeyPoints([...keyPoints, newPoint.trim()]);
                  setNewPoint('');
                }
              }}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-neutral-900 mb-1.5 block">课后测验</label>
        <div className="p-3 rounded-md border border-dashed border-neutral-200 text-center">
          <p className="text-xs text-neutral-600">3 道题 · 自动评分</p>
          <button className="mt-2 text-xs text-brand-500 hover:underline">编辑题目</button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-neutral-900 mb-1.5 block">关联资源</label>
        <div className="space-y-1.5 text-xs">
          {['agent.py · 2KB', 'cheatsheet.md · 8KB'].map((r) => (
            <div key={r} className="flex items-center gap-2 p-2 rounded bg-neutral-50">
              <FileText className="w-3.5 h-3.5 text-neutral-600" />
              <span className="flex-1 truncate text-neutral-900">{r.split(' · ')[0]}</span>
              <span className="text-neutral-400">{r.split(' · ')[1]}</span>
            </div>
          ))}
          <button className="w-full text-xs text-brand-500 hover:underline py-1">
            + 添加资源
          </button>
        </div>
      </div>
    </div>
  );
}

function ChaptersTab() {
  const [activeId, setActiveId] = useState('l13');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    MOCK_CHAPTERS.forEach((c) => (init[c.id] = c.defaultOpen));
    return init;
  });
  const totalLessons = MOCK_CHAPTERS.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-0 border border-neutral-200 rounded-xl overflow-hidden bg-neutral-0 min-h-[600px]">
      {/* 左侧:章节树 */}
      <aside className="hidden lg:flex flex-col bg-neutral-0 border-r border-neutral-200 overflow-hidden">
        <div className="p-3 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">章节大纲</h3>
          <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            新增章节
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
          {MOCK_CHAPTERS.map((c) => (
            <ChapterTreeItem
              key={c.id}
              chapter={c}
              activeId={activeId}
              onSelect={setActiveId}
              expanded={expanded[c.id] ?? false}
              onToggle={() => setExpanded({ ...expanded, [c.id]: !expanded[c.id] })}
            />
          ))}
        </div>
        <div className="p-3 border-t border-neutral-200 text-xs text-neutral-600">
          总时长: <span className="font-mono text-neutral-900">6.5h</span> · 共 {totalLessons} 课时
        </div>
        <p className="px-3 pb-3 text-[10px] text-warning-500">
          ⚠ TODO: P0-8 后端暂未实现,操作仅前端 mock
        </p>
      </aside>

      {/* 中间:编辑器 */}
      <div className="flex flex-col overflow-hidden bg-neutral-50">
        <LessonEditor />
      </div>

      {/* 右侧:字段面板 */}
      <aside className="hidden lg:flex flex-col bg-neutral-0 border-l border-neutral-200 overflow-y-auto">
        <LessonSettingsPanel />
      </aside>
    </div>
  );
}

// ── 资源 tab ────────────────────────────────────────────────────────────
function ResourcesTab() {
  const resources = [
    { name: '课程讲义.pdf', size: '2.4 MB', type: 'pdf' },
    { name: 'agent.py', size: '2 KB', type: 'code' },
    { name: 'cheatsheet.md', size: '8 KB', type: 'md' },
    { name: '数据集 sample.csv', size: '340 KB', type: 'csv' },
    { name: '参考论文 1.pdf', size: '1.1 MB', type: 'pdf' },
  ];
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">课程资源 · 5</h3>
        <Button variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
          上传
        </Button>
      </div>
      <div className="space-y-2">
        {resources.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50"
          >
            <FileText className="w-4 h-4 text-neutral-600 shrink-0" />
            <span className="flex-1 text-sm text-neutral-900 truncate">{r.name}</span>
            <span className="text-xs text-neutral-600 font-mono">{r.size}</span>
            <Button variant="ghost" size="sm">
              删除
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-warning-500">
        ⚠ TODO: 资源上传后端 P0-8 暂未实现
      </p>
    </Card>
  );
}

// ── 价格 tab ────────────────────────────────────────────────────────────
function PricingTab() {
  const [plan, setPlan] = useState<'free' | 'oneTime' | 'subscription'>('oneTime');
  const [price, setPrice] = useState('299');
  const [trialEnabled, setTrialEnabled] = useState(true);

  const plans: { id: 'free' | 'oneTime' | 'subscription'; title: string; sub: string; priceHint: string }[] = [
    { id: 'free', title: '免费', sub: '全部章节对所有人开放', priceHint: '¥ 0' },
    { id: 'oneTime', title: '一次性买断', sub: '一次付费,永久学习', priceHint: '¥ 299' },
    { id: 'subscription', title: '订阅', sub: '加入 OpenCSG 会员可学全部课程', priceHint: '¥ 99/月' },
  ];

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">价格模式</h3>
        <p className="text-xs text-neutral-600 mb-4">选择一种主要定价方式,后续可在订单页调整</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map((p) => {
            const active = plan === p.id;
            return (
              <label
                key={p.id}
                className={
                  'p-4 rounded-xl border-2 cursor-pointer transition-colors ' +
                  (active
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-neutral-200 hover:border-neutral-400')
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="plan"
                    checked={active}
                    onChange={() => setPlan(p.id)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-sm font-semibold text-neutral-900">{p.title}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-600">{p.sub}</p>
                <p className="mt-2 text-base font-mono font-bold text-neutral-900">
                  {p.priceHint}
                </p>
              </label>
            );
          })}
        </div>
      </Card>

      {plan === 'oneTime' && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">买断定价</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="售价 (¥)"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              hint="用户实际支付金额"
            />
            <Input label="原价 (¥)" type="number" defaultValue="499" hint="展示划线价" />
            <Input label="促销标签" defaultValue="早鸟" hint="显示在价格旁边" />
          </div>
        </Card>
      )}

      <Card padding="md">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={trialEnabled}
            onChange={(e) => setTrialEnabled(e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          <span className="text-sm text-neutral-900">开启试看(已默认开启 1-2 节)</span>
        </label>
        <p className="mt-2 text-xs text-neutral-600 pl-6">
          试看课时未报名用户也可观看,提升转化
        </p>
      </Card>
    </div>
  );
}

// ── 发布 tab ────────────────────────────────────────────────────────────
function PublishTab() {
  const [isPublished, setIsPublished] = useState(true);
  const [publishAt, setPublishAt] = useState('2026-05-15T10:00');

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">上下架状态</h3>
            <p className="text-xs text-neutral-600 mt-1">
              {isPublished
                ? '课程已发布,正在招生中'
                : '课程未发布,只有内部可见'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublished((p) => !p)}
            className={
              'relative w-12 h-7 rounded-full transition-colors ' +
              (isPublished ? 'bg-brand-500' : 'bg-neutral-200')
            }
            aria-pressed={isPublished}
            aria-label="上下架"
          >
            <span
              className={
                'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ' +
                (isPublished ? 'translate-x-5' : 'translate-x-0.5')
              }
            />
          </button>
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">定时发布</h3>
        <p className="text-xs text-neutral-600 mb-4">
          设置后即使切到"已发布"也不会立即生效,到点才真正展示
        </p>
        <Input
          label="发布时间"
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
          leftIcon={<Calendar className="w-4 h-4" />}
        />
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">发布检查</h3>
        <ul className="space-y-2 text-sm">
          {[
            { ok: true, label: '课程标题与封面已设置' },
            { ok: true, label: '至少 3 个章节,共 32 课时' },
            { ok: false, label: 'SEO meta description 缺失(SEO/元数据 tab)' },
            { ok: true, label: '试看课时已勾选' },
          ].map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              {c.ok ? (
                <Check className="w-4 h-4 text-success-500 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-warning-500 shrink-0" />
              )}
              <span className="text-neutral-900">{c.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ── 编辑模式主组件 ──────────────────────────────────────────────────────
function CourseEditView({ courseId, tab }: { courseId?: string; tab: Tab }) {
  const [currentTab, setCurrentTab] = useState<Tab>(tab);

  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);

  return (
    <div className="-mx-6 -my-8">
      {/* 顶部 sticky header */}
      <header className="bg-neutral-0 border-b border-neutral-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/admin/courses"
              className="text-neutral-600 hover:text-brand-500 shrink-0"
              aria-label="返回课程列表"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-neutral-300">/</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">
                {MOCK_COURSE.title}
              </div>
              <div className="text-xs text-neutral-600 flex items-center gap-2 flex-wrap">
                <span>
                  课程 ID: <span className="font-mono">{courseId ?? MOCK_COURSE.id}</span>
                </span>
                <span>·</span>
                <span className="text-success-500 flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  已发布
                </span>
                <span>·</span>
                <span>最后保存 {MOCK_COURSE.savedAt}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
              预览
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Save className="w-4 h-4" />}>
              保存草稿
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Send className="w-4 h-4" />}>
              发布更新
            </Button>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-4 sm:px-6 flex gap-6 overflow-x-auto text-sm">
          {TABS.map((t) => {
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCurrentTab(t.id)}
                className={
                  'py-3 border-b-2 whitespace-nowrap transition-colors ' +
                  (active
                    ? 'border-brand-500 text-brand-500 font-medium'
                    : 'border-transparent text-neutral-600 hover:text-brand-500')
                }
              >
                {t.label}
                {t.count && <span className="ml-1 text-xs text-neutral-400">· {t.count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      {/* 主体 */}
      <div className="px-4 sm:px-6 py-6 pb-24">
        {currentTab === 'info' && <InfoTab />}
        {currentTab === 'chapters' && <ChaptersTab />}
        {currentTab === 'resources' && <ResourcesTab />}
        {currentTab === 'pricing' && <PricingTab />}
        {currentTab === 'publish' && <PublishTab />}
      </div>

      {/* 底部 sticky 工具条 */}
      <footer className="fixed bottom-0 inset-x-0 bg-neutral-0/95 backdrop-blur border-t border-neutral-200 px-4 sm:px-6 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
            已自动保存 · {MOCK_COURSE.savedAt}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">3 个未保存的修改</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            撤销
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
          >
            保存草稿
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Send className="w-4 h-4" />}
            className="shadow-glow"
          >
            发布更新
          </Button>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 路由层:根据 ?tab 决定走哪种 view
// ──────────────────────────────────────────────────────────────────────────

const VALID_TABS: Tab[] = ['info', 'chapters', 'resources', 'pricing', 'publish'];

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
