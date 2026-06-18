import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../../lib/api';

interface Degree {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: number;
  costType: 'free' | 'paid' | 'charity';
  courses: { course: { id: string; title: string; thumbnail: string; description: string } }[];
}

export function DegreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: degree, isLoading } = useQuery({
    queryKey: ['degree', id],
    queryFn: async () => {
      const { data } = await api.get<Degree>(`/api/v1/degrees/${id}`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="text-center py-20">加载中...</div>;
  if (!degree) return <div className="text-center py-20">学位不存在</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <Link to="/degrees" className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#171717] mb-6">
        <ArrowLeft className="w-4 h-4" /> 返回学位列表
      </Link>

      <div className="bg-white rounded-2xl border border-[#EEEDE9] p-8 mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{degree.title}</h1>
        <p className="text-lg text-[#666666] mb-6">{degree.description}</p>
        <div className="text-2xl font-bold">
          {degree.costType === 'free' ? '免费' : `¥${degree.price}`}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">包含课程</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {degree.courses.map(({ course }) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="bg-white rounded-2xl border border-[#EEEDE9] p-5 hover:shadow-lg transition-shadow"
          >
            <img src={course.thumbnail} alt={course.title} className="w-full h-40 object-cover rounded-xl mb-4" />
            <h3 className="font-bold text-lg">{course.title}</h3>
            <p className="text-sm text-[#666666] line-clamp-2">{course.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
