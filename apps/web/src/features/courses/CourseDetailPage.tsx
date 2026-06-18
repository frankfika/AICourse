import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  User as UserIcon,
  BookOpen,
  PlayCircle,
  FileText,
  Code,
  Link as LinkIcon,
  Video,
  Music,
  Lock,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Award,
  Star,
  CheckCircle2 as CheckIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { progressApi } from '../../lib/progressApi';
import { useAuthStore } from '../../stores/authStore';
import { ProgressRing } from '../../components/ProgressRing';
import { PurchaseModal } from '../degrees/PurchaseModal';

interface Course {
  id: string;
  title: string;
  description: string;
  learningPoints: string;
  instructor: string;
  level: string;
  duration: string;
  thumbnail: string;
  tags: string;
  costType: 'free' | 'paid' | 'charity';
  price: number;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  isPreview: boolean;
  orderIndex: number;
  resources: Resource[];
}

interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'pdf' | 'code' | 'link' | 'video' | 'audio';
  isLocked: boolean;
}

interface Toast {
  id: number;
  type: 'points' | 'badge';
  message: string;
}

function resourceIcon(type: Resource['type']) {
  switch (type) {
    case 'pdf':
      return <FileText className="w-5 h-5" />;
    case 'code':
      return <Code className="w-5 h-5" />;
    case 'link':
      return <LinkIcon className="w-5 h-5" />;
    case 'video':
      return <Video className="w-5 h-5" />;
    case 'audio':
      return <Music className="w-5 h-5" />;
  }
}

function resourceLabel(type: Resource['type']) {
  return { pdf: 'PDF', code: '代码', link: '链接', video: '视频', audio: '音频' }[type];
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'video' | 'resources'>('overview');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const { data } = await api.get<Course>(`/api/v1/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: courseProgress } = useQuery({
    queryKey: ['course-progress', id],
    queryFn: () => progressApi.getCourseProgress(id!),
    enabled: !!id && !!user,
  });

  const { data: myProgress } = useQuery({
    queryKey: ['my-progress'],
    queryFn: () => progressApi.getMyProgress(),
    enabled: !!user,
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data as Array<{ id: string; courseId?: string | null; degreeId?: string | null }>;
    },
    enabled: !!user,
  });

  const completedLessonIds = new Set(
    (myProgress as any[])
      ?.filter((p) => p.status === 'completed')
      .map((p) => p.lessonId) ?? [],
  );

  const completeLessonMutation = useMutation({
    mutationFn: (lessonId: string) => progressApi.completeLesson(lessonId),
    onSuccess: (data, lessonId) => {
      queryClient.invalidateQueries({ queryKey: ['my-progress'] });
      queryClient.invalidateQueries({ queryKey: ['course-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['my-points'] });
      queryClient.invalidateQueries({ queryKey: ['my-badges'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'me'] });

      const newToasts: Toast[] = [];
      if (data.pointsAwarded > 0) {
        newToasts.push({ id: Date.now(), type: 'points', message: `+${data.pointsAwarded} 积分` });
      }
      data.newlyUnlockedBadges.forEach((badge, idx) => {
        newToasts.push({
          id: Date.now() + idx + 1,
          type: 'badge',
          message: `解锁徽章「${badge.name}」`,
        });
      });
      if (newToasts.length > 0) {
        setToasts((prev) => [...prev, ...newToasts]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => !newToasts.find((nt) => nt.id === t.id)));
        }, 3000);
      }
    },
  });

  const enrolled = !!myEnrollments?.some((e) => e.courseId === id);
  const isUnlocked = course?.costType === 'free' || course?.costType === 'charity' || enrolled;

  if (isLoading) return <div className="text-center py-20">加载中...</div>;
  if (!course) return <div className="text-center py-20">课程不存在</div>;

  const learningPoints = JSON.parse(course.learningPoints || '[]') as string[];
  const tags = JSON.parse(course.tags || '[]') as string[];
  const isFree = course.costType === 'free' || course.costType === 'charity';

  // 按 chapter 分组的资源（每节课的资源归属到它的章节）
  const resourcesByChapter = course.chapters.map((chapter) => ({
    chapter,
    lessons: chapter.lessons.filter((l) => l.resources.length > 0),
  })).filter((x) => x.lessons.length > 0);

  const totalResources = course.chapters
    .flatMap((c) => c.lessons)
    .reduce((sum, l) => sum + l.resources.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#171717] mb-6">
        <ArrowLeft className="w-4 h-4" /> 返回课程列表
      </Link>

      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#666666]">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {course.duration}</span>
            <span className="flex items-center gap-1"><UserIcon className="w-4 h-4" /> {course.instructor}</span>
            <span className="px-2.5 py-0.5 rounded border text-xs">
              {course.level === 'Beginner' ? '入门' : course.level === 'Intermediate' ? '进阶' : '高级'}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-[#171717] text-white'
              }`}
            >
              {isFree ? (course.costType === 'free' ? '免费' : '公益') : `¥${course.price}`}
            </span>
          </div>
        </div>
        {user && courseProgress && (
          <div className="flex items-center gap-4 bg-white border border-[#EEEDE9] rounded-2xl p-4">
            <ProgressRing percent={courseProgress.percent} size={72} strokeWidth={7} />
            <div>
              <div className="text-sm text-[#666666]">课程进度</div>
              <div className="text-lg font-bold">
                {courseProgress.completedLessons}/{courseProgress.totalLessons} 课时
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 未报名时显示 CTA */}
      {!enrolled && (
        <div className="bg-gradient-to-r from-[#171717] to-[#333] text-white rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl font-bold mb-1">
              {isFree ? '免费报名，开始学习' : `解锁完整课程 ¥${course.price}`}
            </div>
            <div className="text-sm text-white/70">
              {totalResources > 0 ? `包含 ${totalResources} 个学习资源` : '报名后立即开通学习权限'}
            </div>
          </div>
          {user ? (
            <button
              onClick={() => setPurchaseOpen(true)}
              className="px-6 py-3 bg-white text-[#171717] rounded-xl font-bold hover:bg-[#F5F4F0]"
            >
              {isFree ? '免费报名' : '立即购买'}
            </button>
          ) : (
            <Link
              to="/login"
              className="px-6 py-3 bg-white text-[#171717] rounded-xl font-bold hover:bg-[#F5F4F0]"
            >
              登录后报名
            </Link>
          )}
        </div>
      )}

      {enrolled && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 mb-8 flex items-center gap-3">
          <CheckIcon className="w-5 h-5" />
          <span className="font-bold">已报名，开始学习吧</span>
        </div>
      )}

      <div className="fixed top-20 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-right duration-300 ${
              toast.type === 'points'
                ? 'bg-[#171717] text-white border-[#171717]'
                : 'bg-white text-[#171717] border-[#EEEDE9]'
            }`}
          >
            {toast.type === 'points' ? <Star className="w-4 h-4" /> : <Award className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow">
          <div className="flex gap-6 border-b border-[#EEEDE9] mb-8">
            {[
              { key: 'overview', label: '课程概览', icon: BookOpen },
              { key: 'video', label: '视频课程', icon: PlayCircle },
              { key: 'resources', label: `学习资源 (${totalResources})`, icon: FileText },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 ${
                  activeTab === key ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#666666]'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              <p className="text-lg leading-relaxed text-[#171717]">{course.description}</p>
              <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4">本课要点</h3>
                <ul className="grid sm:grid-cols-2 gap-4">
                  {learningPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#666666]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#171717] mt-2 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div>
              {!isUnlocked ? (
                <div className="aspect-video bg-[#171717] rounded-xl flex items-center justify-center text-white">
                  <div className="text-center">
                    <Lock className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">报名后解锁课程</h3>
                    {user ? (
                      <button
                        onClick={() => setPurchaseOpen(true)}
                        className="inline-block mt-4 px-6 py-2 bg-white text-[#171717] rounded-full font-medium"
                      >
                        {isFree ? '免费报名' : '立即购买'}
                      </button>
                    ) : (
                      <Link to="/login" className="inline-block mt-4 px-6 py-2 bg-white text-[#171717] rounded-full font-medium">
                        登录 / 注册
                      </Link>
                    )}
                  </div>
                </div>
              ) : activeLesson?.videoUrl ? (
                <div className="aspect-video bg-[#171717] rounded-xl overflow-hidden">
                  <iframe
                    src={activeLesson.videoUrl}
                    title={activeLesson.title}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video bg-[#F5F4F0] rounded-xl flex items-center justify-center text-[#666666]">
                  选择左侧课时开始观看
                </div>
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="space-y-6">
              {!isUnlocked ? (
                <div className="text-center py-16 bg-white border border-[#EEEDE9] rounded-2xl">
                  <Lock className="w-10 h-10 mx-auto mb-3 text-[#999999]" />
                  <div className="text-[#666666] mb-4">报名后可下载全部学习资源</div>
                  {user ? (
                    <button
                      onClick={() => setPurchaseOpen(true)}
                      className="px-6 py-2 bg-[#171717] text-white rounded-full font-bold"
                    >
                      {isFree ? '免费报名' : '立即购买'}
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-block px-6 py-2 bg-[#171717] text-white rounded-full font-bold"
                    >
                      登录后报名
                    </Link>
                  )}
                </div>
              ) : resourcesByChapter.length === 0 ? (
                <div className="text-center py-12 text-[#666666]">暂无附加资源</div>
              ) : (
                resourcesByChapter.map(({ chapter, lessons }) => (
                  <div key={chapter.id}>
                    <h3 className="font-bold text-lg mb-3">{chapter.title}</h3>
                    <div className="space-y-2">
                      {lessons.map((lesson) =>
                        lesson.resources.map((res) => (
                          <a
                            key={res.id}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-white border border-[#EEEDE9] rounded-xl hover:border-[#171717] hover:shadow-sm group transition-all"
                          >
                            <div className="p-2.5 bg-[#F5F4F0] rounded-lg text-[#171717]">
                              {resourceIcon(res.type)}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="font-bold truncate">{res.title}</div>
                              <div className="text-xs text-[#666666]">
                                {lesson.title} · {resourceLabel(res.type)}
                              </div>
                            </div>
                            <span className="text-xs text-[#666666] group-hover:text-[#171717]">查看 →</span>
                          </a>
                        )),
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white border border-[#EEEDE9] rounded-2xl p-5">
            <h3 className="font-bold mb-4">课程章节</h3>
            <div className="space-y-4">
              {course.chapters.map((chapter) => (
                <div key={chapter.id}>
                  <h4 className="text-sm font-bold text-[#666666] mb-2">{chapter.title}</h4>
                  <div className="space-y-1">
                    {chapter.lessons.map((lesson) => {
                      const isCompleted = completedLessonIds.has(lesson.id);
                      const locked = !lesson.isPreview && !isUnlocked;
                      return (
                        <div
                          key={lesson.id}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                            activeLesson?.id === lesson.id
                              ? 'bg-[#171717] text-white'
                              : 'hover:bg-[#F5F4F0]'
                          }`}
                        >
                          <button
                            onClick={() => {
                              setActiveLesson(lesson);
                              setActiveTab('video');
                            }}
                            disabled={locked}
                            className="flex items-center gap-2 flex-1 min-w-0 disabled:cursor-not-allowed"
                          >
                            {locked ? (
                              <Lock className="w-4 h-4 shrink-0" />
                            ) : (
                              <PlayCircle className="w-4 h-4 shrink-0" />
                            )}
                            <span className="line-clamp-1">{lesson.title}</span>
                          </button>
                          {user && !locked && (
                            <button
                              onClick={() => completeLessonMutation.mutate(lesson.id)}
                              disabled={isCompleted || completeLessonMutation.isPending}
                              className={`shrink-0 p-1 rounded-full transition-colors ${
                                isCompleted
                                  ? 'text-emerald-600'
                                  : 'text-[#999999] hover:text-[#171717] hover:bg-[#F5F4F0]'
                              }`}
                              title={isCompleted ? '已完成' : '标记完成'}
                            >
                              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-white border border-[#EEEDE9] rounded-2xl p-5">
            <h4 className="font-bold mb-3">课程信息</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#666666]">时长</span>
                <span>{course.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666]">难度</span>
                <span>
                  {course.level === 'Beginner' ? '入门' : course.level === 'Intermediate' ? '进阶' : '高级'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666]">讲师</span>
                <span>{course.instructor}</span>
              </div>
              <div className="pt-2">
                <span className="text-[#666666] block mb-2">标签</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-[#F5F4F0] rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        type="course"
        itemId={course.id}
        title={course.title}
        price={course.price}
        costType={course.costType}
      />
    </div>
  );
}