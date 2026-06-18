import { useQuery } from '@tanstack/react-query';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const { data: enrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/enrollments/me');
      return data;
    },
  });

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#171717] rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user?.name}</h1>
            <p className="text-[#666666] text-sm">{user?.email}</p>
            <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded font-bold bg-[#F5F4F0]">
              {user?.role === 'admin' ? '管理员' : '学员'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium hover:bg-[#F5F4F0]"
          >
            <LogOut className="w-4 h-4" /> 退出
          </button>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">我的学习</h2>
      <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
        {enrollments && (enrollments as any[]).length > 0 ? (
          <ul className="space-y-3">
            {(enrollments as any[]).map((e: any) => (
              <li key={e.id} className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-[#666666]" />
                <span>{e.course?.title || e.degree?.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#666666]">还没有注册任何课程或学位。</p>
        )}
      </div>
    </div>
  );
}
