import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import api from '../../lib/api';

interface Degree {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: number;
  costType: 'free' | 'paid' | 'charity';
  courses: { course: { id: string; title: string; thumbnail: string } }[];
}

export function DegreeListPage() {
  const { data: degrees, isLoading } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const { data } = await api.get<Degree[]>('/api/v1/degrees');
      return data;
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">体系化学位</h1>
      {isLoading ? (
        <div className="text-center py-20">加载中...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {degrees?.map((degree) => (
            <Link
              key={degree.id}
              to={`/degrees/${degree.id}`}
              className="bg-white rounded-2xl border border-[#EEEDE9] p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="font-bold text-2xl mb-2">{degree.title}</h3>
              <p className="text-[#666666] mb-4">{degree.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#666666]">{degree.courses.length} 门课程</span>
                <span className="text-xl font-bold">
                  {degree.costType === 'free' ? '免费' : `¥${degree.price}`}
                </span>
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-[#171717]">
                查看详情 <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
