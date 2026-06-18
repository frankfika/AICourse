import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, ChevronRight, Sparkles } from 'lucide-react';
import api from '../../lib/api';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  instructor: string;
  level: string;
  costType: 'free' | 'paid' | 'charity';
  price: number;
  tags: string;
}

interface Degree {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: number;
  costType: 'free' | 'paid' | 'charity';
}

export function HomePage() {
  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
  });

  const { data: degrees } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const { data } = await api.get<Degree[]>('/api/v1/degrees');
      return data;
    },
  });

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#EEEDE9] text-xs font-bold text-[#666666] mb-6">
            <Sparkles className="w-3.5 h-3.5" /> AI 大模型时代的学习平台
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            掌握 AI 与大模型
            <br />
            <span className="text-[#666666]">构建未来技能</span>
          </h1>
          <p className="text-lg text-[#666666] font-medium mb-8 max-w-xl">
            从基础概念到实战开发，OpenCSG Academy 带你系统学习人工智能、大模型应用与全栈开发。
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/courses"
              className="px-6 py-3 bg-[#171717] text-white rounded-full font-medium hover:bg-[#262626]"
            >
              浏览课程
            </Link>
            <Link
              to="/degrees"
              className="px-6 py-3 bg-white border border-[#EEEDE9] rounded-full font-medium hover:bg-[#EEEDE9]"
            >
              查看学位
            </Link>
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">热门课程</h2>
          <Link to="/courses" className="text-sm font-medium text-[#666666] hover:text-[#171717] flex items-center gap-1">
            全部课程 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses?.slice(0, 6).map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="group bg-white rounded-2xl border border-[#EEEDE9] overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                    course.costType === 'free'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : course.costType === 'charity'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-[#171717] text-white border-[#171717]'
                  }`}>
                    {course.costType === 'free' ? '免费' : course.costType === 'charity' ? '公益' : '付费'}
                  </span>
                  <span className="text-xs text-[#666666] font-medium">{course.level === 'Beginner' ? '入门' : '进阶'}</span>
                </div>
                <h3 className="font-bold text-lg mb-2 group-hover:underline">{course.title}</h3>
                <p className="text-sm text-[#666666] line-clamp-2 mb-4">{course.description}</p>
                <div className="flex items-center gap-4 text-xs text-[#666666] font-medium">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {course.duration}</span>
                  <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> {course.instructor}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Degrees */}
      <section className="max-w-7xl mx-auto px-6 py-12 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">体系化学位</h2>
          <Link to="/degrees" className="text-sm font-medium text-[#666666] hover:text-[#171717] flex items-center gap-1">
            全部学位 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {degrees?.map((degree) => (
            <Link
              key={degree.id}
              to={`/degrees/${degree.id}`}
              className="bg-white rounded-2xl border border-[#EEEDE9] p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="font-bold text-xl mb-2">{degree.title}</h3>
              <p className="text-sm text-[#666666] mb-4">{degree.description}</p>
              <div className="text-lg font-bold">
                {degree.costType === 'free' ? '免费' : `¥${degree.price}`}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
