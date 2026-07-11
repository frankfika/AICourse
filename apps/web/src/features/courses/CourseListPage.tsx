import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, Search, ArrowUpRight, Sparkles } from 'lucide-react';
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

export function CourseListPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'free' | 'paid' | 'charity'>('all');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get<Course[]>('/api/v1/courses');
      return data;
    },
  });

  const filtered = courses?.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'all' || c.costType === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'free', label: '免费' },
    { key: 'paid', label: '付费' },
    { key: 'charity', label: '公益' },
  ] as const;

  return (
    <div className="bg-[#F5F4F0] text-[#171717] animate-in fade-in duration-500">
      {/* Header banner */}
      <section className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">
            / 01 Courses
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] mb-6">
            ALL<br />COURSES
          </h1>
          <p className="text-white/60 text-lg max-w-2xl leading-relaxed">
            从入门到精通，从基础概念到实战开发，全部由业界专家精心打造。
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b border-[#171717] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-stretch border border-[#171717]">
            {filters.map((f, i) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  activeFilter === f.key
                    ? 'bg-[#171717] text-white'
                    : 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
                } ${i < filters.length - 1 ? 'border-r border-[#171717]' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <input
              type="text"
              placeholder="搜索课程..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Course Grid */}
      <section className="border-b border-[#171717]">
        {isLoading ? (
          <div className="max-w-7xl mx-auto px-6 py-32 text-center text-[#666666] font-medium">
            加载中...
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course, i) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className={`group block hover:bg-[#EEEDE9] transition-colors ${
                  i % 3 !== 2 ? 'lg:border-r border-[#171717]' : ''
                } ${i % 2 !== 1 ? 'md:border-r lg:border-r-0 border-[#171717]' : ''} ${
                  i < filtered.length - 1 ? 'border-b border-[#171717]' : ''
                }`}
              >
                <div className="aspect-[16/10] overflow-hidden bg-[#EEEDE9] border-b border-[#171717]">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    {course.costType === 'free' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3 h-3" /> Free
                      </span>
                    ) : course.costType === 'charity' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[#171717] text-[#171717] text-[10px] font-black uppercase tracking-widest">
                        Charity
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[#171717] text-[#171717] text-[10px] font-black uppercase tracking-widest">
                        ¥{course.price}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                      {course.level}
                    </span>
                  </div>
                  <h3 className="font-black text-lg leading-tight mb-3 line-clamp-2 tracking-tight">
                    {course.title}
                  </h3>
                  <p className="text-sm text-[#666666] line-clamp-2 mb-4 leading-relaxed">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-[#EEEDE9]">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#666666]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {course.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> {course.instructor}
                      </span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#666666] group-hover:text-[#171717] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 py-32 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
              No Results
            </div>
            <p className="text-2xl font-black tracking-tighter">没有找到匹配的课程</p>
          </div>
        )}
      </section>
    </div>
  );
}
