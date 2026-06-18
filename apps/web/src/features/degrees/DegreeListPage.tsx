import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, ChevronRight, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import type { NanoDegreeWithPath } from '@opencsg/shared-types';

export function DegreeListPage() {
  const { data: degrees, isLoading } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const { data } = await api.get<NanoDegreeWithPath[]>('/api/v1/degrees');
      return data;
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">体系化学位</h1>
        </div>
        <p className="text-[#666666] max-w-2xl">
          精选多门课程组成的学习路径，从入门到进阶一站式打通，拿下 OpenCSG 认证学位。
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[#666666]">加载中...</div>
      ) : (
        <div className="grid gap-6">
          {degrees?.map((degree) => {
            const isFree = degree.costType === 'free' || degree.costType === 'charity';
            return (
              <Link
                key={degree.id}
                to={`/degrees/${degree.id}`}
                className="group block bg-white rounded-2xl border border-[#EEEDE9] overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="flex flex-col md:flex-row">
                  {/* 左侧视觉 */}
                  <div className="md:w-56 shrink-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 flex flex-col justify-between border-r border-[#EEEDE9]">
                    <div>
                      <div className="w-12 h-12 rounded-xl bg-[#171717] text-white flex items-center justify-center mb-4">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-1">
                        Nano Degree
                      </span>
                    </div>
                    <div className="mt-6">
                      <div className="text-xs text-[#666666]">学位价格</div>
                      <div className="text-2xl font-bold mt-1">
                        {isFree ? '免费' : `¥${Number(degree.price).toFixed(0)}`}
                      </div>
                    </div>
                  </div>

                  {/* 右侧内容 */}
                  <div className="flex-1 p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold mb-2 group-hover:underline decoration-2 underline-offset-4">
                      {degree.title}
                    </h3>
                    <p className="text-sm md:text-base text-[#666666] line-clamp-2 mb-5">
                      {degree.description}
                    </p>

                    {/* 路径预览 */}
                    <div className="mb-5">
                      <div className="text-xs text-[#666666] mb-2">学习路径</div>
                      <div className="flex items-center flex-wrap gap-2">
                        {degree.courses.slice(0, 4).map((c, i) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="text-xs font-bold w-6 h-6 rounded-full bg-[#171717] text-white flex items-center justify-center shrink-0">
                              {c.stepNumber}
                            </span>
                            <span className="text-sm font-medium">{c.title}</span>
                            {i < Math.min(degree.courses.length, 4) - 1 && (
                              <span className="text-[#999999]">→</span>
                            )}
                          </div>
                        ))}
                        {degree.courses.length > 4 && (
                          <span className="text-xs text-[#666666]">
                            +{degree.courses.length - 4} 门
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#EEEDE9]">
                      <div className="flex items-center gap-4 text-xs text-[#666666]">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" /> {degree.stats.courseCount} 门课程
                        </span>
                        <span>·</span>
                        <span>{degree.stats.totalChapters} 章</span>
                        <span>·</span>
                        <span>约 {degree.stats.estimatedHours} 小时</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#171717] group-hover:translate-x-1 transition-transform">
                        查看路径 <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}