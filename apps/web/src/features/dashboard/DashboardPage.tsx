/**
 * DashboardPage — P0-6 学习中心三栏布局
 *
 * 严格按 review/mocks/mock-learn.html 落地:
 *   - 左 280-320px 章节大纲(折叠 Chapter → Lesson,每 Lesson 显示 title + 时长 + 状态)
 *   - 中 1fr 视频 + tabs(笔记/字幕/资源) + sticky 完成按钮
 *   - 右 360-400px AI 助教(4 问 1 答 mock chat 流 + 输入区 + disclaimer)
 *
 * 响应式:
 *   - lg+ (≥1024px): 三栏并排
 *   - md (768-1023): 两栏(隐藏 AI 右栏,改 FAB 抽屉),AI 抽屉复用同一组件
 *   - sm/mobile (<768): 单栏 + 顶部 3 tab 切换(大纲/视频/AI)
 *
 * 数据策略:
 *   - 1) 优先用 coursesApi + progressApi 拉真实数据
 *   - 2) 失败 / 401 / 网络错 → fallback 到内置 MOCK_CHAPTERS(5 章 / 28 课)
 *   - 3) 在 mock 模式下,前置"lesson 1.3"为 in-progress,1.1/1.2 已完成
 *
 * TODO(后端):
 *   - LearningEvent 视频上报后端未建,目前 console.log + 内存计数
 *   - AI 助教 chat 走前端 mock,等 chat module 上线后改调 /api/v1/chat/sessions
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  CheckCircle2,
  Lock,
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Send,
  Paperclip,
  RefreshCw,
  Settings as SettingsIcon,
  FileText,
  MessageSquare,
  Paperclip as AttachIcon,
  HelpCircle,
  Plus,
  BookOpen,
  Clock,
} from 'lucide-react';
import api from '../../lib/api';
import { progressApi } from '../../lib/progressApi';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

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
// Mock 数据 — 5 章 / 28 课(后端不可用时 fallback)
// 完全按 mock-learn.html 的 5 章结构造,current lesson = 1.3(进行中)
// =============================================================
const MOCK_CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    title: '第一章 · Agent 心智模型',
    orderIndex: 0,
    description: '理解 Agent 的本质,与传统程序的区别',
    lessons: [
      { id: 'l1', title: '1.1 什么是 Agent', orderIndex: 0, isPreview: true, videoDuration: 750, resources: [] },
      { id: 'l2', title: '1.2 LLM 如何"思考"', orderIndex: 1, isPreview: true, videoDuration: 1122, resources: [] },
      { id: 'l3', title: '1.3 第一个最小 Agent(命令行版)', orderIndex: 2, isPreview: false, videoDuration: 495, resources: [] },
      { id: 'l4', title: '1.4 ReAct:Reason + Act', orderIndex: 3, isPreview: false, videoDuration: 1328, resources: [] },
      { id: 'l5', title: '1.5 调试 Agent', orderIndex: 4, isPreview: false, videoDuration: 930, resources: [] },
      { id: 'l6', title: '1.6 章节项目', orderIndex: 5, isPreview: false, videoDuration: 0, resources: [] },
    ],
  },
  {
    id: 'ch2',
    title: '第二章 · Tool Calling',
    orderIndex: 1,
    description: '让 Agent 学会使用外部工具',
    lessons: Array.from({ length: 7 }, (_, i) => ({
      id: `l2${i + 1}`,
      title: `2.${i + 1} ${['Tool schema 设计', 'Function call 协议', '错误重试策略', 'Tool 选择策略', '并行调用', '流式输出', '章节项目'][i]}`,
      orderIndex: i,
      isPreview: i === 0,
      videoDuration: 600 + i * 90,
      resources: [],
    })),
  },
  {
    id: 'ch3',
    title: '第三章 · Memory',
    orderIndex: 2,
    description: '短期 / 长期 / 向量记忆',
    lessons: Array.from({ length: 6 }, (_, i) => ({
      id: `l3${i + 1}`,
      title: `3.${i + 1} ${['短期记忆 Buffer', '长期记忆持久化', '向量检索', '摘要压缩', '多 Agent 共享', '章节项目'][i]}`,
      orderIndex: i,
      isPreview: i === 0,
      videoDuration: 540 + i * 80,
      resources: [],
    })),
  },
  {
    id: 'ch4',
    title: '第四章 · Chain',
    orderIndex: 3,
    description: '链式调用与编排',
    lessons: Array.from({ length: 6 }, (_, i) => ({
      id: `l4${i + 1}`,
      title: `4.${i + 1} ${['LCEL 语法', 'Runnable 接口', '并行 / 串行编排', '条件分支', 'Fallback 兜底', '章节项目'][i]}`,
      orderIndex: i,
      isPreview: i === 0,
      videoDuration: 720 + i * 60,
      resources: [],
    })),
  },
  {
    id: 'ch5',
    title: '第五章 · 期末项目',
    orderIndex: 4,
    description: '从 0 到 1 搭建完整 Agent',
    lessons: Array.from({ length: 7 }, (_, i) => ({
      id: `l5${i + 1}`,
      title: `5.${i + 1} ${['需求拆解', '架构设计', '核心 Loop 实现', 'Tool 集成', '评估体系', '部署上线', '毕业设计'][i]}`,
      orderIndex: i,
      isPreview: false,
      videoDuration: 900 + i * 100,
      resources: [],
    })),
  },
];

const MOCK_COURSE: Course = {
  id: 'c1',
  title: '用 LangChain 搭建第一个 Agent',
  description: '从 0 到 1 理解 Agent 心智模型,搭建你的第一个生产可用 Agent',
  instructor: 'Frank Chen',
  duration: '80h',
  chapters: MOCK_CHAPTERS,
};

// 当前进行中的 lesson id(mock 模式下 hardcode 为 l3)
const MOCK_IN_PROGRESS_LESSON_ID = 'l3';
// mock 模式下前置完成的 lesson
const MOCK_COMPLETED_LESSON_IDS = new Set(['l1', 'l2']);

// =============================================================
// AI 助教 mock 数据(后端 /api/v1/chat/sessions 未建,前端 hardcode)
// =============================================================
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  /** 引用源(line:line 链接,纯 mock) */
  citation?: { lessonId: string; start: string; end: string; label: string };
  /** 挑战卡片(可选) */
  challenge?: { title: string; description: string };
}

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'm0',
    role: 'ai',
    content:
      '你好!我是你的 AI 助教,我看到你正在学 Lesson 1.3(第一个最小 Agent)。\n\n有什么不懂的?或者我可以给你一个 5 分钟的代码挑战?',
    citation: { lessonId: 'l3', start: '00:00:00', end: '00:08:15', label: '我能引用你学过的 1,200 个课时' },
  },
  {
    id: 'm1',
    role: 'user',
    content: 'ReAct 和 Tool Use 到底有什么区别?感觉都是"让 LLM 调用工具"啊',
  },
  {
    id: 'm2',
    role: 'ai',
    content:
      '好问题!**ReAct** 是"Reason + Act"的循环模式(算法层),**Tool Use** 是其中"Act"环节的具体实现(API 层)。\n\n类比:ReAct 像"如果 A 就 B"这种控制流,Tool Use 像"调用 fetch()"。前者是设计模式,后者是函数调用。',
    citation: { lessonId: 'l4', start: '00:01:23', end: '00:08:30', label: 'Lesson 1.4 · 完整讲 ReAct' },
  },
  {
    id: 'm3',
    role: 'ai',
    content:
      '写一个最小 Agent,只能调 1 个 tool:返回当前时间。跑通后,我给你看其他学员怎么扩展到 3 个 tool。',
    challenge: { title: '🎯 5 分钟挑战(可选)', description: '写一个最小 Agent,只能调 1 个 tool:返回当前时间' },
  },
];

// 快捷提示 chips
const QUICK_PROMPTS = ['📌 解释这节课', '💡 ReAct vs CoT', '🧪 给个练习', '🛠️ 这段代码怎么改'];

// 笔记 mock 列表(3 条)
const MOCK_NOTES = [
  {
    id: 'n1',
    time: '01:42',
    relative: '2 天前',
    visibility: 'public' as const,
    content: 'ReAct 的关键是"显式分离 reasoning 和 action",这跟传统 if-else 的本质区别在哪?是不是意味着 reasoning 的 prompt 必须独立可调试?',
  },
  {
    id: 'n2',
    time: '03:10',
    relative: '刚刚',
    visibility: 'private' as const,
    content: '用 temperature=0 的时候,tool call schema 校验失败的概率明显比 0.7 高 —— 待验证',
  },
  {
    id: 'n3',
    time: '04:55',
    relative: '1 周前',
    visibility: 'public' as const,
    content: '最小 Agent 的代码结构其实就 4 块:Prompt + Tool schema + Parser + Loop。这跟"先有架构还是先有代码"的争论相比,我更倾向先 Loop 起来再分层。',
    citation: 'Lesson 1.3 · 00:04:55',
  },
];

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
            className="h-full bg-brand-500 transition-all"
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
                        ? 'bg-brand-500 text-neutral-0'
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
                            ? 'bg-brand-500 text-neutral-0 hover:bg-brand-700'
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
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin shrink-0" />
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
  // LearningEvent 内存计数(后端未建,标 TODO)
  const eventCountRef = useRef(0);

  // 模拟视频播放(每秒 +1,做进度条视觉)
  useEffect(() => {
    setVideoTime(0);
    const interval = setInterval(() => {
      setVideoTime((t) => {
        const next = t + 1;
        // TODO(后端):LearningEvent 上报后端未建,先 console.log + 内存计数
        if (next % 5 === 0) {
          eventCountRef.current += 1;
          // eslint-disable-next-line no-console
          console.log('[LearningEvent TODO]', {
            type: 'progress',
            courseId: course.id,
            lessonId: currentLesson.id,
            position: next,
            count: eventCountRef.current,
          });
        }
        return next >= currentLesson.videoDuration ? currentLesson.videoDuration : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentLesson.id, currentLesson.videoDuration, course.id]);

  const isCurrentCompleted = completedSet.has(currentLesson.id);
  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === currentLesson.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allLessons.length - 1;

  const tabs: Array<{ id: CenterTab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'notes', label: '笔记', count: 3, icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'cc', label: '字幕', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'resources', label: '资源', count: 5, icon: <AttachIcon className="w-3.5 h-3.5" /> },
    { id: 'qa', label: 'Q&A', count: 2, icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-50">
      {/* 视频区 16:9 */}
      <div className="aspect-video bg-black relative flex items-center justify-center text-white shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 to-xp-500/20" />
        <div className="relative text-center">
          <button
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition mx-auto"
            aria-label="播放"
          >
            <PlayCircle className="w-10 h-10 ml-1" />
          </button>
          <p className="mt-4 text-sm opacity-80">{currentLesson.title}</p>
        </div>
        {/* 视频控件 */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="h-1 rounded-full bg-white/30 overflow-hidden mb-2">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{
                width: `${currentLesson.videoDuration ? (videoTime / currentLesson.videoDuration) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <button className="text-white hover:text-brand-300 transition-colors" aria-label="播放/暂停">
              <PlayCircle className="w-5 h-5" />
            </button>
            <span className="font-mono text-[10px] sm:text-xs">
              {formatDuration(videoTime)} / {formatDuration(currentLesson.videoDuration || 0)}
            </span>
            <div className="flex-1" />
            <button className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/20 text-xs">1.0×</button>
            <button className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/20 text-xs">CC</button>
          </div>
        </div>
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
          <span>{formatDuration(currentLesson.videoDuration || 0)}</span>
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
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-neutral-600 dark:text-neutral-600 hover:text-brand-500',
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
          <div className="space-y-3 max-w-3xl">
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-brand-50 dark:bg-brand-50 border border-brand-100">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-600">
                💡 提示:在视频任意时间点按 <kbd className="px-1.5 py-0.5 rounded bg-neutral-0 dark:bg-neutral-100 border text-xs font-mono">N</kbd> 添加时间戳笔记
              </p>
            </div>
            {MOCK_NOTES.map((n) => (
              <div
                key={n.id}
                className="p-3 sm:p-4 rounded-lg border border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100"
              >
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-600">
                  <span className="font-mono">@ {n.time}</span>
                  <span>·</span>
                  <span>{n.relative}</span>
                  <span
                    className={cn(
                      'ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                      n.visibility === 'public'
                        ? 'bg-success-500/10 text-success-500'
                        : 'bg-neutral-100 dark:bg-neutral-100',
                    )}
                  >
                    {n.visibility === 'public' ? '公开' : '私有'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-900 leading-relaxed">
                  {n.content}
                </p>
                {n.citation && (
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-600">📎 引用:{n.citation}</p>
                )}
              </div>
            ))}
            <button className="w-full py-2 rounded-md border border-dashed border-neutral-200 dark:border-neutral-200 text-sm text-neutral-600 dark:text-neutral-600 hover:border-brand-500 hover:text-brand-500 transition-colors flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> 添加笔记
            </button>
          </div>
        )}

        {centerTab === 'cc' && (
          <div className="max-w-3xl space-y-3">
            {[
              { time: '00:00', text: '欢迎来到第一节课。今天我们要用 LangChain 搭建一个最小的 Agent。' },
              { time: '00:15', text: '先确认你的环境:Python 3.10+,pip install langchain langchain-openai。' },
              { time: '00:42', text: '一个 Agent 至少需要三样东西:Prompt、Tool schema、以及一个循环。' },
              { time: '01:30', text: '我们先写一个最朴素的 ReAct 循环 —— 没有 LangChain,只用 OpenAI SDK。' },
              { time: '02:15', text: '注意这里的 stop sequence,它是让 LLM 输出结构化 action 的关键。' },
            ].map((line, i) => (
              <div
                key={i}
                className="p-3 sm:p-4 rounded-lg border border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 flex gap-3"
              >
                <span className="font-mono text-xs text-brand-500 shrink-0 pt-0.5">{line.time}</span>
                <p className="text-sm text-neutral-900 dark:text-neutral-900 leading-relaxed">{line.text}</p>
              </div>
            ))}
          </div>
        )}

        {centerTab === 'resources' && (
          <div className="max-w-3xl space-y-2">
            {[
              { name: 'lesson-1.3-starter.zip', size: '12 KB', type: 'code' },
              { name: 'langchain-agent-cheatsheet.pdf', size: '240 KB', type: 'pdf' },
              { name: 'official docs: agents', size: 'link', type: 'link' },
              { name: 'demo: minimal agent run', size: '8:15', type: 'video' },
              { name: 'audio recap (中文)', size: '6:30', type: 'audio' },
            ].map((r, i) => (
              <a
                key={i}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-200 bg-neutral-0 dark:bg-neutral-100 hover:border-brand-500 transition-colors"
              >
                <span className="w-9 h-9 rounded-md bg-brand-100 text-brand-500 flex items-center justify-center text-xs font-bold shrink-0">
                  {r.type.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-neutral-900 dark:text-neutral-900">
                    {r.name}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-600">{r.size}</div>
                </div>
                <span className="text-xs text-brand-500">下载</span>
              </a>
            ))}
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
          className="px-3 sm:px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-200 text-xs sm:text-sm hover:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-900 dark:text-neutral-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">上一节</span>
        </button>
        <span className="text-[10px] sm:text-xs text-neutral-600 dark:text-neutral-600 hidden md:inline">
          完成本节获得 +50 积分 + 进度推进
        </span>
        <button
          onClick={() => onMarkComplete(currentLesson.id)}
          disabled={isCompleting || isCurrentCompleted}
          className="px-3 sm:px-4 py-2 rounded-md bg-brand-500 text-white text-xs sm:text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-glow flex items-center gap-1"
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
function AiAssistant({
  currentLessonTitle,
  onClose,
}: {
  currentLessonTitle: string;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [input, setInput] = useState('');

  // TODO(后端):chat module 未建,目前前端 mock。等后端 /api/v1/chat/sessions 上线后:
  //  - onSend POST /api/v1/chat/sessions
  //  - 流式响应 (SSE) 增量更新
  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
    ]);
    setInput('');
    // mock 立即回一个固定答复
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          content: '收到你的问题。这节课我帮你聚焦在「最小 Agent 跑通」这一件事上,先别分心看 ReAct —— 等你写完 Hello Agent 我再讲 1.4。',
          citation: { lessonId: 'l3', start: '00:04:00', end: '00:05:30', label: '回到 Lesson 1.3 · 04:00' },
        },
      ]);
    }, 600);
  };

  const handleQuick = (label: string) => {
    setInput(label.replace(/^[^ ]+ /, ''));
  };

  return (
    <div className="flex flex-col h-full bg-neutral-0 dark:bg-neutral-100">
      {/* 顶部:AI 助教 + 操作 */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-200 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-xp-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          AI
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-900">AI 助教</div>
          <div className="text-xs text-success-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" />
            <span className="truncate">在线 · 知道你在学 {currentLessonTitle}</span>
          </div>
        </div>
        <button
          className="p-1.5 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-50 text-neutral-600 dark:text-neutral-600"
          title="重新开始"
          onClick={() => setMessages(MOCK_CHAT)}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-50 text-neutral-600 dark:text-neutral-600"
          title="设置"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-neutral-50 text-neutral-600"
            title="关闭"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      {/* 快捷提示 */}
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-200 flex gap-2 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => handleQuick(p)}
            className="px-2.5 py-1 rounded-full bg-neutral-50 dark:bg-neutral-50 text-xs text-neutral-900 dark:text-neutral-900 hover:bg-brand-100 transition-colors whitespace-nowrap border border-neutral-200 dark:border-neutral-200"
          >
            {p}
          </button>
        ))}
      </div>

      {/* 对话流 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex gap-2 items-start',
              m.role === 'user' && 'justify-end',
            )}
          >
            {m.role === 'ai' && (
              <div
                className={cn(
                  'w-7 h-7 rounded-full text-neutral-0 flex items-center justify-center text-xs font-bold shrink-0',
                  m.challenge ? 'bg-xp-500' : 'bg-cert-500',
                )}
              >
                AI
              </div>
            )}
            <div
              className={cn(
                'text-sm rounded-lg p-3 max-w-[85%] sm:max-w-[80%]',
                m.role === 'user'
                  ? 'bg-brand-100 text-neutral-900 dark:text-neutral-900'
                  : m.challenge
                    ? 'bg-xp-100 border border-xp-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-50 text-neutral-900 dark:text-neutral-900',
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.citation && (
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-600">
                  📎 {m.citation.label}
                </p>
              )}
              {m.challenge && (
                <>
                  <p className="mt-2 text-xs font-semibold text-xp-500">{m.challenge.title}</p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-600">
                    {m.challenge.description}
                  </p>
                </>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-200 text-neutral-900 dark:text-neutral-900 flex items-center justify-center text-xs font-bold shrink-0">
                我
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-200 shrink-0">
        <div className="flex items-end gap-2">
          <button
            className="p-2 text-neutral-600 dark:text-neutral-600 hover:text-brand-500"
            title="附加资源"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="问 AI 助教... (Shift+Enter 换行)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-50 border border-neutral-200 dark:border-neutral-200 text-sm resize-none focus:outline-none focus:border-brand-500 text-neutral-900 dark:text-neutral-900 placeholder:text-neutral-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-md bg-brand-500 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="发送"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-400 text-center">
          AI 助教答复可能不准确,请参考官方文档
        </p>
      </div>
    </div>
  );
}

// =============================================================
// 主页面
// =============================================================
export function DashboardPage() {
  const queryClient = useQueryClient();

  // 移动端顶部 tab 切换(大纲 / 视频 / AI)
  const [mobileTab, setMobileTab] = useState<'outline' | 'video' | 'ai'>('video');
  // tablet 抽屉 AI
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  // 当前 lesson
  const [currentLessonId, setCurrentLessonId] = useState<string>(MOCK_IN_PROGRESS_LESSON_ID);

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

  // === 数据归一化:API OK 用 API,失败用 mock ===
  const course: Course | null = useMemo(() => {
    if (courseQuery.data && courseQuery.data.chapters?.length) {
      return courseQuery.data;
    }
    return MOCK_COURSE;
  }, [courseQuery.data]);

  const completedSet = useMemo(() => {
    // 防御:progressQuery.data 可能是数组 / 包裹对象 / null(后端 schema 不稳)
    const raw = progressQuery.data;
    const records: ProgressRecord[] = Array.isArray(raw)
      ? (raw as ProgressRecord[])
      : Array.isArray((raw as any)?.data)
        ? ((raw as any).data as ProgressRecord[])
        : [];
    const apiCompleted = new Set(records.filter((r) => r.status === 'completed').map((r) => r.lessonId));
    if (apiCompleted.size > 0) return apiCompleted;
    return MOCK_COMPLETED_LESSON_IDS;
  }, [progressQuery.data]);

  // === 4) 标记完成 mutation ===
  const completeLessonMutation = useMutation({
    mutationFn: (lessonId: string) => progressApi.completeLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-progress'] });
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
              className="inline-flex items-center gap-2 bg-brand-500 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-brand-700"
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
                ? 'border-brand-500 text-brand-500'
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
        className="hidden md:flex lg:hidden fixed right-4 bottom-4 w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-xp-500 text-white shadow-glow hover:scale-105 transition-all items-center justify-center z-30"
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
    </div>
  );
}
