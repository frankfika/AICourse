import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
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
  ArrowUpRight,
  Award,
  Star,
  CheckCircle2 as CheckIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { progressApi } from '../../lib/progressApi';
import { useAuthStore } from '../../stores/authStore';
import { ProgressRing } from '../../components/ProgressRing';
import { QueryErrorState } from '../../components/QueryErrorState';
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
  courseType: 'own' | 'partner' | 'public' | 'third_party';
  externalUrl?: string;
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
      return <FileText className="w-4 h-4" />;
    case 'code':
      return <Code className="w-4 h-4" />;
    case 'link':
      return <LinkIcon className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'audio':
      return <Music className="w-4 h-4" />;
  }
}

function resourceLabel(type: Resource['type']) {
  return { pdf: 'PDF', code: '代码', link: '链接', video: '视频', audio: '音频' }[type];
}

const courseTypeLabel = (t: Course['courseType']) => {
  switch (t) {
    case 'own': return '自有课程';
    case 'partner': return '合作课程';
    case 'public': return '公开课程';
    case 'third_party': return '第三方课程';
  }
};

const courseTypeBadgeClass = (t: Course['courseType']) => {
  switch (t) {
    case 'own': return 'bg-[#171717] text-white';
    case 'partner': return 'bg-[#4B5563] text-white';
    case 'public': return 'border border-[#171717] text-[#171717]';
    case 'third_party': return 'bg-[#EEEDE9] text-[#171717] border border-[#171717]';
  }
};

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'video' | 'resources'>('overview');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: course, isLoading, isError, error, refetch } = useQuery({
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
    onSuccess: (data) => {
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

  if (isLoading) return <div className="text-center py-32 text-[#666666]">加载中...</div>;
  if (isError) {
    // 404 时给"课程不存在"友好提示,其他错误给重试
    const status = (error as any)?.response?.status;
    if (status === 404) {
      return <div className="text-center py-32 text-[#666666]">课程不存在或已下架</div>;
    }
    return (
      <div className="max-w-2xl mx-auto py-16">
        <QueryErrorState error={error} onRetry={refetch} />
      </div>
    );
  }
  if (!course) return <div className="text-center py-32">课程不存在</div>;

  const learningPoints = JSON.parse(course.learningPoints || '[]') as string[];
  const tags = JSON.parse(course.tags || '[]') as string[];
  const isFree = course.costType === 'free' || course.costType === 'charity';

  const resourcesByChapter = course.chapters
    .map((chapter) => ({
      chapter,
      lessons: chapter.lessons.filter((l) => l.resources.length > 0),
    }))
    .filter((x) => x.lessons.length > 0);

  const totalResources = course.chapters
    .flatMap((c) => c.lessons)
    .reduce((sum, l) => sum + l.resources.length, 0);

  const totalLessons = course.chapters.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <div className="bg-[#F5F4F0] text-[#171717] animate-in fade-in duration-500">
      {/* Top action bar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] hover:text-[#171717]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back To Courses
          </Link>
        </div>
      </section>

      {/* Hero — split white + black */}
      <section className="border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 md:p-12 lg:p-16 bg-white border-b lg:border-b-0 lg:border-r border-[#171717] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
                {course.level}
              </span>
              {isFree ? (
                <span className="inline-flex items-center px-2 py-0.5 border border-[#171717] text-[#171717] text-[10px] font-black uppercase tracking-widest">
                  Free
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 border border-[#171717] text-[#171717] text-[10px] font-black uppercase tracking-widest">
                  ¥{course.price}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${courseTypeBadgeClass(course.courseType)}`}>
                {courseTypeLabel(course.courseType)}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] mb-6 break-words">
              {course.title}
            </h1>
            <p className="text-[#666666] text-lg leading-relaxed mb-8 max-w-2xl">
              {course.description}
            </p>

            <div className="grid grid-cols-3 border-t border-[#171717]">
              <div className="py-5 border-r border-[#171717]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">Duration</div>
                <div className="text-2xl font-black tracking-tighter">{course.duration}</div>
              </div>
              <div className="py-5 border-r border-[#171717]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">Lessons</div>
                <div className="text-2xl font-black tracking-tighter">{totalLessons}</div>
              </div>
              <div className="py-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">Resources</div>
                <div className="text-2xl font-black tracking-tighter">{totalResources}</div>
              </div>
            </div>
          </div>

          {/* Right: thumbnail + CTA */}
          <div className="bg-[#171717] text-white flex flex-col">
            <div className="aspect-[16/10] border-b border-white/20 overflow-hidden bg-[#262626]">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-8 md:p-12 flex flex-col gap-4">
              {user && courseProgress ? (
                <div className="flex items-center gap-4 border border-white/20 p-4">
                  <ProgressRing percent={courseProgress.percent} size={64} strokeWidth={6} />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Progress</div>
                    <div className="text-lg font-black tracking-tight">
                      {courseProgress.completedLessons}/{courseProgress.totalLessons} Lessons
                    </div>
                  </div>
                </div>
              ) : null}

              {enrolled ? (
                <div className="inline-flex items-center justify-between gap-3 border border-white px-6 py-4 font-black uppercase tracking-widest text-sm">
                  <CheckIcon className="w-4 h-4" /> 已报名，立即学习
                </div>
              ) : course.courseType === 'third_party' && course.externalUrl ? (
                <a
                  href={course.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between gap-3 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#EEEDE9] transition-colors"
                >
                  <span>前往学习 →</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              ) : user ? (
                <button
                  onClick={() => setPurchaseOpen(true)}
                  className="inline-flex items-center justify-between gap-3 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#EEEDE9] transition-colors"
                >
                  <span>{isFree ? 'Free Enroll' : `Buy ¥${course.price}`}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-between gap-3 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#EEEDE9] transition-colors"
                >
                  <span>Login to Enroll</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}

              <div className="text-[10px] font-black uppercase tracking-widest text-white/40 pt-2 flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5" /> 讲师 / {course.instructor}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs bar */}
      <section className="border-b border-[#171717] bg-white sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 flex overflow-x-auto scrollbar-hide">
          {[
            { key: 'overview', label: '课程概览', icon: BookOpen },
            { key: 'video', label: '视频课程', icon: PlayCircle },
            { key: 'resources', label: `学习资源 (${totalResources})`, icon: FileText },
          ].map(({ key, label, icon: Icon }, i, arr) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`py-4 px-5 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
                  active
                    ? 'text-[#171717] border-b-2 border-[#171717] -mb-px'
                    : 'text-[#666666] hover:text-[#171717]'
                } ${i < arr.length - 1 ? 'border-r border-[#EEEDE9]' : ''}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tab content */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                    / 01 Overview
                  </div>
                  <p className="text-lg leading-relaxed">{course.description}</p>
                </div>

                {learningPoints.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                      / 02 What You Will Learn
                    </div>
                    <div className="grid sm:grid-cols-2 gap-0 border-t border-l border-[#171717]">
                      {learningPoints.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-4 border-b border-r border-[#171717] hover:bg-white transition-colors"
                        >
                          <div className="shrink-0 w-7 h-7 bg-[#171717] text-white text-[10px] font-black flex items-center justify-center">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <span className="text-sm font-medium leading-relaxed pt-1">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar: chapters list */}
              <div>
                <div className="border border-[#171717] bg-white">
                  <div className="p-4 border-b border-[#171717]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">课程章节</div>
                    <div className="text-lg font-black mt-1">{course.chapters.length} Chapters</div>
                  </div>
                  <div>
                    {course.chapters.map((chapter, i) => (
                      <div
                        key={chapter.id}
                        className={`p-4 ${i < course.chapters.length - 1 ? 'border-b border-[#EEEDE9]' : ''} hover:bg-[#F5F4F0] transition-colors`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#A3A3A3] mb-1">
                          Chapter {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="text-sm font-black tracking-tight leading-snug">{chapter.title}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-1">
                          {chapter.lessons.length} Lessons
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {!isUnlocked ? (
                  <div className="aspect-video bg-[#171717] flex items-center justify-center text-white">
                    <div className="text-center">
                      <Lock className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-2xl font-black tracking-tighter uppercase mb-2">报名后解锁</h3>
                      <p className="text-sm text-white/50 mb-6">报名后立即获得完整学习权限</p>
                      {user ? (
                        <button
                          onClick={() => setPurchaseOpen(true)}
                          className="px-6 py-3 bg-white text-[#171717] font-black uppercase tracking-widest text-xs hover:bg-[#EEEDE9]"
                        >
                          {isFree ? 'Free Enroll' : `Buy ¥${course.price}`}
                        </button>
                      ) : (
                        <Link
                          to="/login"
                          className="px-6 py-3 bg-white text-[#171717] font-black uppercase tracking-widest text-xs hover:bg-[#EEEDE9]"
                        >
                          Login
                        </Link>
                      )}
                    </div>
                  </div>
                ) : activeLesson?.videoUrl ? (
                  <div className="aspect-video bg-[#171717] border border-[#171717] overflow-hidden">
                    <iframe
                      src={activeLesson.videoUrl}
                      title={activeLesson.title}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-white border border-[#171717] flex items-center justify-center text-[#666666]">
                    <div className="text-center">
                      <PlayCircle className="w-10 h-10 mx-auto mb-2 text-[#A3A3A3]" />
                      选择左侧课时开始观看
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="border border-[#171717] bg-white">
                  <div className="p-4 border-b border-[#171717]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">课程章节</div>
                  </div>
                  {course.chapters.map((chapter) => (
                    <div key={chapter.id} className="border-b border-[#EEEDE9] last:border-b-0">
                      <div className="px-4 py-3 bg-[#F5F4F0] text-[10px] font-black uppercase tracking-widest text-[#666666]">
                        {chapter.title}
                      </div>
                      {chapter.lessons.map((lesson) => {
                        const isCompleted = completedLessonIds.has(lesson.id);
                        const locked = !lesson.isPreview && !isUnlocked;
                        const active = activeLesson?.id === lesson.id;
                        return (
                          <div
                            key={lesson.id}
                            className={`flex items-center gap-2 px-3 py-2.5 border-t border-[#EEEDE9] ${
                              active ? 'bg-[#171717] text-white' : 'hover:bg-[#F5F4F0]'
                            }`}
                          >
                            <button
                              onClick={() => {
                                setActiveLesson(lesson);
                                setActiveTab('video');
                              }}
                              disabled={locked}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm disabled:cursor-not-allowed"
                            >
                              {locked ? (
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                              ) : isCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="line-clamp-1 text-xs font-medium">{lesson.title}</span>
                            </button>
                            {user && !locked && (
                              <button
                                onClick={() => completeLessonMutation.mutate(lesson.id)}
                                disabled={isCompleted || completeLessonMutation.isPending}
                                className={`shrink-0 p-1 transition-colors ${
                                  isCompleted ? 'text-[#171717]' : 'text-[#999999] hover:text-[#171717]'
                                }`}
                                title={isCompleted ? '已完成' : '标记完成'}
                              >
                                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'resources' && (
            <div>
              {!isUnlocked ? (
                <div className="text-center py-24 bg-white border border-[#171717]">
                  <Lock className="w-10 h-10 mx-auto mb-4 text-[#666666]" />
                  <div className="text-lg font-black tracking-tighter mb-6">报名后可下载全部学习资源</div>
                  {user ? (
                    <button
                      onClick={() => setPurchaseOpen(true)}
                      className="px-6 py-3 bg-[#171717] text-white font-black uppercase tracking-widest text-xs hover:bg-[#262626]"
                    >
                      {isFree ? 'Free Enroll' : `Buy ¥${course.price}`}
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="px-6 py-3 bg-[#171717] text-white font-black uppercase tracking-widest text-xs hover:bg-[#262626]"
                    >
                      Login
                    </Link>
                  )}
                </div>
              ) : resourcesByChapter.length === 0 ? (
                <div className="text-center py-24 text-[#666666]">暂无附加资源</div>
              ) : (
                <div className="border border-[#171717]">
                  {resourcesByChapter.map(({ chapter, lessons }, ci) => (
                    <div key={chapter.id} className={ci < resourcesByChapter.length - 1 ? 'border-b border-[#171717]' : ''}>
                      <div className="p-4 bg-[#171717] text-white">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">
                          Chapter {String(ci + 1).padStart(2, '0')}
                        </div>
                        <div className="text-base font-black tracking-tight">{chapter.title}</div>
                      </div>
                      <div>
                        {lessons.flatMap((lesson) =>
                          lesson.resources.map((res) => (
                            <a
                              key={res.id}
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-4 px-4 py-3 border-t border-[#EEEDE9] bg-white hover:bg-[#F5F4F0] transition-colors group"
                            >
                              <div className="shrink-0 w-9 h-9 bg-[#171717] text-white flex items-center justify-center">
                                {resourceIcon(res.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-black tracking-tight truncate">{res.title}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                                  {lesson.title} · {resourceLabel(res.type)}
                                </div>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] group-hover:text-[#171717]">
                                Open →
                              </span>
                            </a>
                          )),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Tags footer */}
      {tags.length > 0 && (
        <section className="border-b border-[#171717] bg-white">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] mr-2">Tags</span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 border border-[#171717] text-[10px] font-black uppercase tracking-widest hover:bg-[#171717] hover:text-white transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-50 space-y-2 max-w-xs w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 border-2 border-[#171717] animate-in fade-in slide-in-from-right duration-300 ${
              toast.type === 'points' ? 'bg-[#171717] text-white' : 'bg-white text-[#171717]'
            }`}
          >
            {toast.type === 'points' ? <Star className="w-4 h-4" /> : <Award className="w-4 h-4" />}
            <span className="text-sm font-black tracking-tight">{toast.message}</span>
          </div>
        ))}
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
