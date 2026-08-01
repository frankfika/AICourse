/**
 * DashboardPage — P0-6 学习中心三栏布局
 *
 * 严格按 review/mocks/mock-learn.html 落地:
 *   - 左 280-320px 章节大纲(折叠 Chapter → Lesson,每 Lesson 显示 title + 时长 + 状态)
 *   - 中 1fr 视频 + tabs(笔记/字幕/资源) + sticky 完成按钮
 *   - 右 360-400px AI 助教入口，打开真实 WebAssistant 会话
 *
 * 响应式:
 *   - lg+ (≥1024px): 三栏并排
 *   - md (768-1023): 两栏(隐藏 AI 右栏,改 FAB 抽屉),AI 抽屉复用同一组件
 *   - sm/mobile (<768): 单栏 + 顶部 3 tab 切换(大纲/视频/AI)
 *
 * 数据策略:
 *   - 1) 优先用 coursesApi + progressApi 拉真实数据
 *   - 2) 失败 / 401 / 网络错 → 渲染 QueryErrorState(v1.4.1 修复,无 mock fallback)
 *   - 3) LearningEvent 视频上报走真实后端(v1.4.1 上线)
 *
 *   - AI 助教复用全站 WebAssistantDrawer，走真实 /api/v1/chat/sessions
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  CheckCircle2,
  Lock,
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Paperclip,
  FileText,
  MessageSquare,
  Paperclip as AttachIcon,
  HelpCircle,
  Plus,
  BookOpen,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import api from '../../lib/api';
import { progressApi } from '../../lib/progressApi';
import { createEventBuffer, learningEventsApi } from '../../lib/learningEventsApi';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryErrorState } from '../../components/QueryErrorState';
import { useToast } from '../../components/auth/Toast';
import { cn } from '../../lib/cn';
import { useWebAssistantStore } from '../../stores/webAssistantStore';
import { notesApi, type LessonNote } from '../../lib/notesApi';
import { isDirectVideoUrl, normalizeEmbeddedVideoUrl } from '../../lib/videoUrl';

const WebAssistantDrawer = lazy(() =>
  import('../../components/WebAssistant/WebAssistantDrawer').then((module) => ({
    default: module.WebAssistantDrawer,
  })),
);

// =============================================================
// 类型(与 CourseDetailPage / shared-types 兼容)
// =============================================================
interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'pdf' | 'code' | 'link' | 'video' | 'audio';
  isLocked: boolean;
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  videoDuration?: number; // 秒
  isPreview: boolean;
  orderIndex: number;
  resources: Resource[];
}

interface Chapter {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  duration: string;
  chapters: Chapter[];
}

// 课程进度记录(从 progressApi.getMyProgress 拿)
interface ProgressRecord {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  lastPosition?: number | null;
}
// =============================================================
// 工具函数
// =============================================================
function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 总 lesson 数
function totalLessons(chapters: Chapter[]): number {
  return chapters.reduce((sum, c) => sum + c.lessons.length, 0);
}

// 找当前 lesson
function findLessonById(chapters: Chapter[], lessonId: string): Lesson | null {
  for (const ch of chapters) {
    const l = ch.lessons.find((x) => x.id === lessonId);
    if (l) return l;
  }
  return null;
}

// =============================================================
// 1) 章节大纲(左栏 + mobile 大纲 tab)
// =============================================================
function ChapterOutline({
  chapters,
  completedSet,
  currentLessonId,
  inProgressLessonId,
  onSelect,
}: {
  chapters: Chapter[];
  completedSet: Set<string>;
  currentLessonId: string;
  inProgressLessonId: string;
  onSelect: (lesson: Lesson) => void;
}) {
  // 当前 lesson 所在 chapter 默认展开;其他折叠
  const [openChapters, setOpenChapters] = useState<Set<string>>(() => {
    const cur = chapters.find((c) => c.lessons.some((l) => l.id === currentLessonId));
    return new Set(cur ? [cur.id] : [chapters[0]?.id]);
  });

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = totalLessons(chapters);
  const completedCount = chapters
    .flatMap((c) => c.lessons)
    .filter((l) => completedSet.has(l.id)).length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <div className="flex flex-col h-full bg-neutral-0 dark:bg-neutral-100">
      {/* 顶部:课程进度 */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-200">
        <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-900">课程大纲</h3>
        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-600">
          共 {chapters.length} 章 · {completedCount} / {total} 课时已完成
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-200 overflow-hidden">
          <div
            className="h-full bg-[#171717] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] font-mono text-neutral-600 dark:text-neutral-600 text-right">
          {percent}%
        </div>
      </div>

      {/* 章节列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {chapters.map((chapter, ci) => {
          const isOpen = openChapters.has(chapter.id);
          const chapterCompletedCount = chapter.lessons.filter((l) => completedSet.has(l.id)).length;
          const isCurrentChapter = chapter.lessons.some((l) => l.id === currentLessonId);
          // 章节徽章颜色
          const isChapterDone = chapterCompletedCount === chapter.lessons.length;
          return (
            <div key={chapter.id}>
              <button
                onClick={() => toggleChapter(chapter.id)}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left',
                  'hover:bg-neutral-50 dark:hover:bg-neutral-50',
                )}
              >
                <span
                  className={cn(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                    isChapterDone
                      ? 'bg-success-500 text-neutral-0'
                      : isCurrentChapter
                        ? 'bg-[#171717] text-white'
                        : 'bg-neutral-200 dark:bg-neutral-200 text-neutral-600 dark:text-neutral-600',
                  )}
                >
                  {ci + 1}
                </span>
                <span className="text-sm font-medium flex-1 truncate text-neutral-900 dark:text-neutral-900">
                  {chapter.title}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-600 font-mono shrink-0">
                  {chapterCompletedCount}/{chapter.lessons.length}
                </span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-neutral-600 transition-transform shrink-0',
                    isOpen ? '' : '-rotate-90',
                  )}
                />
              </button>
              {isOpen && (
                <div className="ml-3 pl-3 border-l border-neutral-200 dark:border-neutral-200 space-y-0.5 mt-1">
                  {chapter.lessons.map((lesson) => {
                    const isCompleted = completedSet.has(lesson.id);
                    const isInProgress = lesson.id === inProgressLessonId;
                    const isCurrent = lesson.id === currentLessonId;
                    const isLocked = !lesson.isPreview && !isCompleted && !isInProgress && !isCurrent;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => !isLocked && onSelect(lesson)}
                        disabled={isLocked}
                        className={cn(
                          'w-full flex items-center gap-2 p-2 rounded text-xs text-left transition-colors',
                          isCurrent
                            ? 'bg-[#171717] text-white hover:bg-[#262626]'
                            : isLocked
                              ? 'opacity-50 cursor-not-allowed text-neutral-600 dark:text-neutral-600'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-50 text-neutral-900 dark:text-neutral-900',
                        )}
                      >
                        {/* 状态图标 */}
                        {isCompleted ? (
                          <CheckCircle2
                            className={cn(
                              'w-3.5 h-3.5 shrink-0',
                              isCurrent ? 'text-neutral-0' : 'text-success-500',
                            )}
                          />
                        ) : isInProgress && !isCurrent ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-[#171717] border-t-transparent animate-spin shrink-0" />
                        ) : isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        ) : (
                          <PlayCircle
                            className={cn(
                              'w-3.5 h-3.5 shrink-0',
                              isCurrent ? 'text-neutral-0' : 'text-neutral-600',
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            'flex-1 truncate',
                            isCompleted && !isCurrent && 'line-through opacity-60',
                          )}
                        >
                          {lesson.title}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[10px] shrink-0',
                            isCurrent ? 'text-neutral-0/80' : 'text-neutral-600',
                          )}
                        >
                          {formatDuration(lesson.videoDuration || 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================
// 2) 视频 + tabs(中栏 + mobile 视频 tab)
// =============================================================
type CenterTab = 'notes' | 'cc' | 'resources' | 'qa';

export function NotesPanel({ lessonId, positionSec }: { lessonId: string; positionSec: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const notesQuery = useQuery({
    queryKey: ['lesson-notes', lessonId],
    queryFn: () => notesApi.list(lessonId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['lesson-notes', lessonId] });
  const createNote = useMutation({
    mutationFn: () =>
      notesApi.create(lessonId, {
        content: draft.trim(),
        positionSec: Math.max(0, Math.round(positionSec)),
      }),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
  });
  const updateNote = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      notesApi.update(id, { content }),
    onSuccess: refresh,
  });
  const deleteNote = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: refresh,
  });

  useEffect(() => {
    const focusNoteInput = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target?.matches('input, textarea, [contenteditable="true"]')
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusNoteInput);
    return () => window.removeEventListener('keydown', focusNoteInput);
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <form
        className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 dark:bg-neutral-100"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) createNote.mutate();
        }}
      >
        <label htmlFor="lesson-note" className="text-sm font-semibold">
          在 {formatDuration(Math.round(positionSec))} 添加笔记
        </label>
        <textarea
          ref={inputRef}
          id="lesson-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="记录本节重点、疑问或实践想法…"
          className="mt-2 w-full resize-y rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#171717]"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-500">按 N 可快速聚焦输入框</span>
          <button
            type="submit"
            disabled={!draft.trim() || createNote.isPending}
            className="min-h-10 rounded-md bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createNote.isPending ? '保存中…' : '保存笔记'}
          </button>
        </div>
        {createNote.isError && <p className="mt-2 text-xs text-red-600">保存失败，请稍后重试。</p>}
      </form>

      {notesQuery.isLoading ? (
        <Skeleton variant="text" count={4} />
      ) : notesQuery.isError ? (
        <QueryErrorState error={notesQuery.error} onRetry={() => notesQuery.refetch()} />
      ) : notesQuery.data?.length ? (
        <div className="space-y-3">
          {notesQuery.data.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onUpdate={(content) => updateNote.mutate({ id: note.id, content })}
              onDelete={() => deleteNote.mutate(note.id)}
              busy={updateNote.isPending || deleteNote.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="还没有笔记"
          description="在上方记录第一条笔记，它会与当前视频时间点一起保存。"
        />
      )}
    </div>
  );
}

function NoteItem({
  note,
  onUpdate,
  onDelete,
  busy,
}: {
  note: LessonNote;
  onUpdate: (content: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);

  return (
    <article className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 dark:bg-neutral-100">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-neutral-500">
          {note.positionSec == null ? '无时间戳' : formatDuration(note.positionSec)}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="min-h-10 min-w-10 rounded-md p-2 hover:bg-neutral-100"
            aria-label="编辑笔记"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="min-h-10 min-w-10 rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            aria-label="删除笔记"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {editing ? (
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = content.trim();
            if (!next) return;
            onUpdate(next);
            setEditing(false);
          }}
        >
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-xs">
              取消
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-[#171717] px-3 py-2 text-xs text-white">
              保存修改
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{note.content}</p>
      )}
    </article>
  );
}

function VideoCenter({
  course,
  currentLesson,
  completedSet,
  onMarkComplete,
  onNavigate,
  isCompleting,
}: {
  course: Course;
  currentLesson: Lesson;
  completedSet: Set<string>;
  onMarkComplete: (lessonId: string) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  isCompleting: boolean;
}) {
  const [centerTab, setCenterTab] = useState<CenterTab>('notes');
  const [videoTime, setVideoTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const lastReportedSecond = useRef(-1);

  // v1.4.1: LearningEvent 上报 — 用缓冲器每 5s push,30s flush 一次
  // 改用真实后端 /api/v1/learning-events/batch,跨设备同步
  const eventBufferRef = useRef<ReturnType<typeof createEventBuffer> | null>(null);

  useEffect(() => {
    const buf = createEventBuffer(30_000);
    buf.start();
    eventBufferRef.current = buf;
    return () => {
      buf.stop();
      eventBufferRef.current = null;
    };
  }, []);

  useEffect(() => {
    setVideoTime(0);
    setMediaDuration(currentLesson.videoDuration ?? 0);
    lastReportedSecond.current = -1;
  }, [currentLesson.id, currentLesson.videoDuration]);

  const handleVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const positionSec = Math.floor(event.currentTarget.currentTime);
    setVideoTime(event.currentTarget.currentTime);
    if (positionSec > 0 && positionSec % 5 === 0 && positionSec !== lastReportedSecond.current) {
      lastReportedSecond.current = positionSec;
      eventBufferRef.current?.push({
        eventType: 'play',
        lessonId: currentLesson.id,
        positionSec,
        metadata: { courseId: course.id },
      });
    }
  };

  const isCurrentCompleted = completedSet.has(currentLesson.id);
  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === currentLesson.id);
  const hasPrev = currentIdx > 0;

  const tabs: Array<{ id: CenterTab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'notes', label: '笔记', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'cc', label: '字幕', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'resources', label: '资源', count: currentLesson.resources?.length, icon: <AttachIcon className="w-3.5 h-3.5" /> },
    { id: 'qa', label: 'Q&A', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-50">
      {/* 视频区 16:9 */}
      <div className="aspect-video bg-black relative flex items-center justify-center text-white shrink-0">
        {!currentLesson.videoUrl ? (
          <div className="text-center px-6">
            <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">本课时暂未上传视频</p>
          </div>
        ) : isDirectVideoUrl(currentLesson.videoUrl) ? (
          <video
            key={currentLesson.id}
            src={currentLesson.videoUrl}
            title={currentLesson.title}
            className="w-full h-full"
            controls
            playsInline
            onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration || currentLesson.videoDuration || 0)}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        ) : (
          <>
            <iframe
              key={currentLesson.id}
              src={normalizeEmbeddedVideoUrl(currentLesson.videoUrl)}
              title={currentLesson.title}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
            <a
              href={currentLesson.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-3 right-3 z-10 bg-white text-[#171717] px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-[#171717]"
            >
              无法播放？新窗口打开 ↗
            </a>
          </>
        )}
      </div>

      {/* 课程标题 + lesson 标题 + 讲师 */}
      <div className="px-4 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 shrink-0">
        <div className="text-[10px] uppercase tracking-widest text-neutral-600 dark:text-neutral-600 font-medium">
          / {course.title}
        </div>
        <h2 className="mt-0.5 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-900 leading-tight">
          {currentLesson.title}
        </h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-600">
          <BookOpen className="w-3.5 h-3.5" />
          <span>讲师 {course.instructor}</span>
          <span>·</span>
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDuration(mediaDuration || currentLesson.videoDuration || 0)}</span>
          {isCurrentCompleted && (
            <span className="ml-auto inline-flex items-center gap-1 text-success-500">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
            </span>
          )}
        </div>
      </div>

      {/* Tabs: 笔记 / 字幕 / 资源 / Q&A */}
      <div className="border-b border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 sticky top-0 z-10 flex px-4 sm:px-6 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCenterTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              centerTab === t.id
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-neutral-600 dark:text-neutral-600 hover:text-[#171717]',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className="text-[10px] opacity-70">· {t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50 dark:bg-neutral-50">
        {centerTab === 'notes' && (
          <NotesPanel lessonId={currentLesson.id} positionSec={videoTime} />
        )}

        {centerTab === 'cc' && (
          <div className="max-w-3xl">
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="字幕暂未提供"
              description="本节字幕由讲师或社区提供,目前还没有上传。你可以先看视频或切换到「笔记」做记录。"
            />
          </div>
        )}

        {centerTab === 'resources' && (
          <div className="max-w-3xl space-y-2">
            {currentLesson.resources && currentLesson.resources.length > 0 ? (
              currentLesson.resources.map((r) => (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 hover:border-[#171717] transition-colors"
                >
                  <span className="w-9 h-9 rounded-md bg-[#EEEDE9] text-[#171717] flex items-center justify-center text-xs font-bold shrink-0">
                    {r.type.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-neutral-900 dark:text-neutral-900">
                      {r.title}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-600 truncate">
                      {r.url}
                    </div>
                  </div>
                  <span className="text-xs text-[#171717]">打开</span>
                </a>
              ))
            ) : (
              <EmptyState
                icon={<Paperclip className="w-5 h-5" />}
                title="本节暂无资源"
                description="讲师还没上传配套资料"
              />
            )}
          </div>
        )}

        {centerTab === 'qa' && (
          <div className="max-w-3xl space-y-3">
            <EmptyState
              icon={<HelpCircle className="w-5 h-5" />}
              title="还没有 Q&A"
              description="本课学员提的问题会在这里,你可以点上面「Q&A」旁边的铃铛订阅"
            />
          </div>
        )}
      </div>

      {/* 底部完成按钮 */}
      <div className="border-t border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 p-3 sm:p-4 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={() => onNavigate('prev')}
          disabled={!hasPrev}
          className="px-3 sm:px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-200 text-xs sm:text-sm hover:border-[#171717] disabled:opacity-50 disabled:cursor-not-allowed text-neutral-900 dark:text-neutral-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">上一节</span>
        </button>
        <span className="text-[10px] sm:text-xs text-neutral-600 dark:text-neutral-600 hidden md:inline">
          完成本节获得积分 + 进度推进
        </span>
        <button
          onClick={() => onMarkComplete(currentLesson.id)}
          disabled={isCompleting || isCurrentCompleted}
          className="px-3 sm:px-4 py-2 rounded-md bg-[#171717] text-white text-xs sm:text-sm font-medium hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
        >
          {isCurrentCompleted ? '已完成' : isCompleting ? '提交中…' : '标记完成'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// =============================================================
// 3) AI 助教(右栏 + mobile AI tab + tablet 抽屉)
// =============================================================
export function AiAssistant({
  currentLessonTitle,
  onClose,
}: {
  currentLessonTitle: string;
  onClose?: () => void;
}) {
  const openDrawer = useWebAssistantStore((state) => state.openDrawer);
  const setDraftInput = useWebAssistantStore((state) => state.setDraftInput);

  const startLessonChat = (question?: string) => {
    const lessonContext = `我正在学习课时「${currentLessonTitle}」`;
    setDraftInput(question ? `${lessonContext}。${question}` : `${lessonContext}，请帮我梳理本节重点。`);
    onClose?.();
    openDrawer();
  };

  return (
    <div className="flex h-full flex-col bg-neutral-0 p-5 dark:bg-neutral-100">
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#171717] text-white">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">AI 助教</h2>
          <p className="truncate text-xs text-neutral-600">当前：{currentLessonTitle}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <h3 className="text-xl font-bold">带着当前课时去提问</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          使用真实 AI 会话，历史记录、消息发送和引用来源都会保存在同一个助教中。
        </p>
        <div className="mt-5 space-y-2">
          {['帮我梳理本节重点。', '给我一个检验理解程度的问题。', '用一个实际案例解释本节内容。'].map(
            (question) => (
              <button
                key={question}
                type="button"
                onClick={() => startLessonChat(question)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-left text-sm hover:border-[#171717]"
              >
                {question}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={() => startLessonChat()}
          className="mt-5 min-h-11 rounded-md bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626]"
        >
          打开 AI 助教
        </button>
      </div>
    </div>
  );
}

// =============================================================
// 主页面
// =============================================================
export function DashboardPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const assistantOpen = useWebAssistantStore((state) => state.open);

  // 移动端顶部 tab 切换(大纲 / 视频 / AI)
  const [mobileTab, setMobileTab] = useState<'outline' | 'video' | 'ai'>('video');
  // tablet 抽屉 AI
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  // 当前 lesson
  const [currentLessonId, setCurrentLessonId] = useState<string>('');

  // 1) 拉课程列表(用于选"当前 in-progress 课程" — P0-6 简化:直接用第一门)
  const coursesQuery = useQuery({
    queryKey: ['dashboard-courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
    retry: 0,
  });

  // 2) 拉当前 in-progress 课程详情
  const courseQuery = useQuery({
    queryKey: ['dashboard-course', coursesQuery.data?.[0]?.id],
    queryFn: async () => {
      const id = coursesQuery.data?.[0]?.id;
      if (!id) throw new Error('no course');
      const { data } = await api.get<Course>(`/api/v1/courses/${id}`);
      return data;
    },
    enabled: !!coursesQuery.data?.[0]?.id,
    retry: 0,
  });

  // 3) 拉我的进度
  const progressQuery = useQuery({
    queryKey: ['dashboard-progress'],
    queryFn: () => progressApi.getMyProgress(),
    retry: 0,
  });

  // === 数据归一化:API OK 用 API,失败用空 / null(无 mock fallback) ===
  const course: Course | null = useMemo(() => {
    if (courseQuery.data && courseQuery.data.chapters?.length) {
      return courseQuery.data;
    }
    return null;
  }, [courseQuery.data]);

  const completedSet = useMemo(() => {
    // 防御:progressQuery.data 可能是数组 / 包裹对象 / null(后端 schema 不稳)
    const raw = progressQuery.data;
    const records: ProgressRecord[] = Array.isArray(raw)
      ? (raw as ProgressRecord[])
      : Array.isArray((raw as any)?.data)
        ? ((raw as any).data as ProgressRecord[])
        : [];
    return new Set(records.filter((r) => r.status === 'completed').map((r) => r.lessonId));
  }, [progressQuery.data]);

  // === 4) 标记完成 mutation ===
  const completeLessonMutation = useMutation({
    mutationFn: (lessonId: string) => progressApi.completeLesson(lessonId),
    onSuccess: (_, lessonId) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-progress'] });
      // v1.4.1: 立刻上报 complete 事件(走 immediate 单条,不等 30s flush)
      // positionSec 由 VideoCenter 在切课时或刷新时上报,这里只标 complete
      learningEventsApi
        .createOne({
          eventType: 'complete',
          lessonId,
        })
        .catch(() => {
          /* noop */
        });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? '标记课时完成失败,请重试';
      showToast(msg, 'error', 4000);
    },
  });

  // 章节切换时,切到 video tab(mobile)
  const handleSelectLesson = (lesson: Lesson) => {
    setCurrentLessonId(lesson.id);
    setMobileTab('video');
  };

  // 上一节 / 下一节
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!course) return;
    const allLessons = course.chapters.flatMap((c) => c.lessons);
    const idx = allLessons.findIndex((l) => l.id === currentLessonId);
    const target = direction === 'prev' ? allLessons[idx - 1] : allLessons[idx + 1];
    if (target) setCurrentLessonId(target.id);
  };

  // === 加载 / 错误状态 ===
  const isInitialLoading =
    coursesQuery.isLoading ||
    (!!coursesQuery.data?.[0]?.id && courseQuery.isLoading);

  // 任意一个核心 query 失败 → 走 QueryErrorState (不要错把"错"显示成"还没有可学习的课程"空态)
  const dashboardError =
    coursesQuery.error || courseQuery.error || progressQuery.error;
  const dashboardRefetch = () => {
    coursesQuery.refetch();
    courseQuery.refetch();
    progressQuery.refetch();
  };

  if (dashboardError && !isInitialLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <QueryErrorState
          error={dashboardError}
          onRetry={dashboardRefetch}
          title="无法加载学习中心"
          description="请检查网络后重试,或联系管理员"
        />
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] xl:grid-cols-[320px_1fr_400px] gap-px bg-neutral-200">
        <div className="bg-neutral-0 dark:bg-neutral-100 p-4 space-y-2">
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="text" count={8} />
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-50 p-4 space-y-3">
          <Skeleton variant="rectangle" className="aspect-video w-full" />
          <Skeleton variant="text" className="h-6 w-1/2" />
          <Skeleton variant="text" count={3} />
        </div>
        <div className="hidden lg:block bg-neutral-0 dark:bg-neutral-100 p-4 space-y-3">
          <Skeleton variant="circle" className="h-8 w-8" />
          <Skeleton variant="text" count={6} />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <EmptyState
          icon={<BookOpen className="w-5 h-5" />}
          title="还没有可学习的课程"
          description="先去课程大厅选一门课开始学习"
          action={
            <a
              href="/courses"
              className="inline-flex items-center gap-2 bg-[#171717] text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-[#262626]"
            >
              浏览课程 <ArrowRight className="w-4 h-4" />
            </a>
          }
        />
      </div>
    );
  }

  const currentLesson = findLessonById(course.chapters, currentLessonId) || course.chapters[0].lessons[0];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* ============================================================
       * 移动端 3 tab(< md)
       * ============================================================ */}
      <div className="md:hidden flex border-b border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 shrink-0">
        {(['outline', 'video', 'ai'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors',
              mobileTab === t
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-neutral-600 dark:text-neutral-600',
            )}
          >
            {t === 'outline' ? '大纲' : t === 'video' ? '视频' : 'AI 助教'}
          </button>
        ))}
      </div>

      {/* ============================================================
       * 三栏主体(响应式)
       *   - lg+: 3 栏并排
       *   - md:  2 栏(隐藏 AI 右栏,改 FAB 抽屉)
       *   - sm:  1 栏(由 mobile tab 切换显示哪个)
       * ============================================================ */}
      <div
        className={cn(
          'flex-1 min-h-0 grid',
          'grid-cols-1',
          'md:grid-cols-[280px_1fr]',
          'lg:grid-cols-[280px_1fr_360px]',
          'xl:grid-cols-[320px_1fr_400px]',
        )}
      >
        {/* 左栏:大纲 */}
        <aside
          className={cn(
            'md:block overflow-hidden border-r border-neutral-200 dark:border-neutral-200',
            mobileTab === 'outline' ? 'block' : 'hidden',
            'md:block',
          )}
        >
          <ChapterOutline
            chapters={course.chapters}
            completedSet={completedSet}
            currentLessonId={currentLessonId}
            inProgressLessonId={currentLessonId}
            onSelect={handleSelectLesson}
          />
        </aside>

        {/* 中栏:视频 + tabs */}
        <main
          className={cn(
            'md:block overflow-hidden',
            mobileTab === 'video' ? 'block' : 'hidden',
            'md:block',
          )}
        >
          <VideoCenter
            course={course}
            currentLesson={currentLesson}
            completedSet={completedSet}
            onMarkComplete={(id) => completeLessonMutation.mutate(id)}
            onNavigate={handleNavigate}
            isCompleting={completeLessonMutation.isPending}
          />
        </main>

        {/* 右栏:AI 助教(仅 lg+ 显示) */}
        <aside
          className={cn(
            'hidden lg:block overflow-hidden border-l border-neutral-200 dark:border-neutral-200',
          )}
        >
          <AiAssistant currentLessonTitle={currentLesson.title} />
        </aside>
      </div>

      {/* ============================================================
       * tablet 专属:AI 助教 FAB(md only,<lg)
       * 浮动在右下角,点击展开抽屉(占 md 区域右侧 ~360px)
       * ============================================================ */}
      <button
        onClick={() => setAiDrawerOpen(true)}
        className="hidden md:flex lg:hidden fixed right-4 bottom-4 w-12 h-12 rounded-full bg-gradient-to-br from-[#171717] to-[#262626] text-white hover:scale-105 transition-all items-center justify-center z-30"
        aria-label="打开 AI 助教"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* tablet AI 抽屉 */}
      {aiDrawerOpen && (
        <>
          <div
            className="hidden md:block lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setAiDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'hidden md:flex lg:hidden fixed right-0 top-14 bottom-0 w-[360px] z-50',
              'bg-neutral-0 dark:bg-neutral-100 border-l border-neutral-200 shadow-lg',
            )}
            role="dialog"
            aria-label="AI 助教"
          >
            <AiAssistant
              currentLessonTitle={currentLesson.title}
              onClose={() => setAiDrawerOpen(false)}
            />
          </div>
        </>
      )}

      {/* 移动端 AI tab 的内容(走 mobile tab 切换,直接在右栏渲染) */}
      {mobileTab === 'ai' && (
        <div className="md:hidden fixed inset-x-0 top-[7rem] bottom-0 z-30 bg-neutral-0 dark:bg-neutral-100">
          <AiAssistant currentLessonTitle={currentLesson.title} />
        </div>
      )}

      {assistantOpen && (
        <Suspense fallback={null}>
          <WebAssistantDrawer />
        </Suspense>
      )}
    </div>
  );
}
