import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, Search } from 'lucide-react';
import { useState } from 'react';
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

import { TiltCard } from '../../components/TiltCard';

export function CourseListPage() {
  const [search, setSearch] = useState('');
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
  });

  const filtered = courses?.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">全部课程</h1>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
          <input
            type="text"
            placeholder="搜索课程..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EEEDE9] rounded-full text-sm focus:outline-none focus:border-[#171717]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[#666666]">加载中...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((course) => (
            <TiltCard key={course.id} className="h-full">
              <Link
                to={`/courses/${course.id}`}
                className="group block bg-white rounded-2xl border border-[#EEEDE9] overflow-hidden hover:shadow-lg transition-shadow h-full"
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
            </TiltCard>
          ))}
        </div>
      )}
    </div>
  );
}
