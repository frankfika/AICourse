import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle2, X, Shield, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [courseIds, setCourseIds] = useState('');

  const { data: users } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>(`/api/v1/users?search=${encodeURIComponent(search)}`);
      return data.data;
    },
  });

  const grantMutation = useMutation({
    mutationFn: ({ userId, courseIds }: { userId: string; courseIds: string[] }) =>
      api.post(`/api/v1/users/${userId}/grant-course`, { courseIds }),
    onSuccess: () => {
      setSelectedUser(null);
      setCourseIds('');
    },
  });

  const handleGrant = () => {
    if (!selectedUser) return;
    grantMutation.mutate({
      userId: selectedUser.id,
      courseIds: courseIds.split(',').map((id) => id.trim()).filter(Boolean),
    });
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
            / Admin · Users
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">用户管理</h2>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
          <input
            type="text"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
          />
        </div>
      </div>

      {selectedUser && (
        <div className="border-2 border-[#171717] bg-white p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">
                / Authorize
              </div>
              <div className="text-lg font-black tracking-tight">
                授权课程给 {selectedUser.name} ({selectedUser.email})
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="p-1.5 hover:bg-[#EEEDE9]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="输入课程 ID，用逗号分隔"
            value={courseIds}
            onChange={(e) => setCourseIds(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={handleGrant}
              disabled={grantMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> 确认授权
            </button>
            <button
              onClick={() => setSelectedUser(null)}
              className="px-5 py-2.5 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="border-2 border-[#171717] bg-white">
        <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="col-span-1">#</div>
          <div className="col-span-4">User</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {users?.map((user, i) => (
          <div
            key={user.id}
            className={`grid grid-cols-12 gap-4 p-4 items-center text-sm ${
              i < (users?.length ?? 0) - 1 ? 'border-b border-[#EEEDE9]' : ''
            } hover:bg-[#F5F4F0] transition-colors`}
          >
            <div className="col-span-1 text-[10px] font-black text-[#A3A3A3]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-4 flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-[#171717] text-white text-sm font-black flex items-center justify-center shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-black tracking-tight truncate">{user.name}</span>
            </div>
            <div className="col-span-4 text-xs text-[#666666] truncate">{user.email}</div>
            <div className="col-span-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  user.role === 'admin'
                    ? 'bg-[#171717] text-white'
                    : 'border border-[#171717] text-[#171717]'
                }`}
              >
                {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {user.role}
              </span>
            </div>
            <div className="col-span-1 text-right">
              <button
                onClick={() => setSelectedUser(user)}
                className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
              >
                授权
              </button>
            </div>
          </div>
        ))}
        {(!users || users.length === 0) && (
          <div className="p-16 text-center text-sm text-[#666666]">未找到用户</div>
        )}
      </div>
    </div>
  );
}
