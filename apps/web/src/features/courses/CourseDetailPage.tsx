import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Clock, User as UserIcon, BookOpen, PlayCircle, FileText, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

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
  type: string;
  isLocked: boolean;
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'overview' | 'video' | 'resources'>('overview');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const { data } = await api.get<Course>(`/api/v1/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const isUnlocked = course?.costType === 'free' || course?.costType === 'charity' || !!user;

  if (isLoading) return <div className="text-center py-20">加载中...</div>;
  if (!course) return <div className="text-center py-20">课程不存在</div>;

  const learningPoints = JSON.parse(course.learningPoints || '[]') as string[];
  const tags = JSON.parse(course.tags || '[]') as string[];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#171717] mb-6">
        <ArrowLeft className="w-4 h-4" /> 返回课程列表
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">{course.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#666666]">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {course.duration}</span>
          <span className="flex items-center gap-1"><UserIcon className="w-4 h-4" /> {course.instructor}</span>
          <span className="px-2.5 py-0.5 rounded border text-xs">
            {course.level === 'Beginner' ? '入门' : '进阶'}
          </span>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${
            course.costType === 'free'
              ? 'bg-emerald-50 text-emerald-700'
              : course.costType === 'charity'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[#171717] text-white'
          }`}>
            {course.costType === 'free' ? '免费' : course.costType === 'charity' ? '公益' : `¥${course.price}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow">
          <div className="flex gap-6 border-b border-[#EEEDE9] mb-8">
            {[
              { key: 'overview', label: '课程概览', icon: BookOpen },
              { key: 'video', label: '视频课程', icon: PlayCircle },
              { key: 'resources', label: '学习资源', icon: FileText },
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
                    <h3 className="text-xl font-bold mb-2">登录后解锁课程</h3>
                    <Link to="/login" className="inline-block mt-4 px-6 py-2 bg-white text-[#171717] rounded-full font-medium">
                      登录 / 注册
                    </Link>
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
            <div className="space-y-4">
              {!isUnlocked ? (
                <div className="text-center py-12 text-[#999999]"><Lock className="w-8 h-8 mx-auto mb-3" />资源仅对学员开放</div>
              ) : (
                course.chapters.flatMap((c) => c.lessons).flatMap((l) => l.resources).length === 0 ? (
                  <div className="text-center py-12 text-[#666666]">暂无附加资源</div>
                ) : (
                  course.chapters.flatMap((c) => c.lessons).flatMap((l) =>
                    l.resources.map((res) => (
                      <a
                        key={res.id}
                        href={res.url}
                        className="flex items-center gap-4 p-4 bg-white border border-[#EEEDE9] rounded-xl hover:border-[#171717] group"
                      >
                        <div className="p-3 bg-[#F5F4F0] rounded-lg">
                          <FileText size={20} />
                        </div>
                        <div className="flex-grow">
                          <div className="font-bold">{res.title}</div>
                          <div className="text-xs text-[#666666] uppercase">{res.type}</div>
                        </div>
                      </a>
                    ))
                  )
                )
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
                    {chapter.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setActiveLesson(lesson);
                          setActiveTab('video');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                          activeLesson?.id === lesson.id
                            ? 'bg-[#171717] text-white'
                            : 'hover:bg-[#F5F4F0]'
                        }`}
                      >
                        {lesson.isPreview || isUnlocked ? (
                          <PlayCircle className="w-4 h-4 shrink-0" />
                        ) : (
                          <Lock className="w-4 h-4 shrink-0" />
                        )}
                        <span className="line-clamp-1">{lesson.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-white border border-[#EEEDE9] rounded-2xl p-5">
            <h4 className="font-bold mb-3">课程信息</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#666666]">时长</span><span>{course.duration}</span></div>
              <div className="flex justify-between"><span className="text-[#666666]">难度</span><span>{course.level === 'Beginner' ? '入门' : '进阶'}</span></div>
              <div className="flex justify-between"><span className="text-[#666666]">讲师</span><span>{course.instructor}</span></div>
              <div className="pt-2">
                <span className="text-[#666666] block mb-2">标签</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-[#F5F4F0] rounded-full text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
