import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle2 } from 'lucide-react';
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
    <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
      <h2 className="text-xl font-bold mb-6">用户管理</h2>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
        <input
          type="text"
          placeholder="搜索用户..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-[#EEEDE9] rounded-lg text-sm"
        />
      </div>

      {selectedUser && (
        <div className="mb-6 p-4 bg-[#F5F4F0] rounded-xl">
          <p className="font-medium mb-2">授权课程给：{selectedUser.name} ({selectedUser.email})</p>
          <input
            type="text"
            placeholder="输入课程 ID，用逗号分隔"
            value={courseIds}
            onChange={(e) => setCourseIds(e.target.value)}
            className="w-full px-3 py-2 border border-[#EEEDE9] rounded-lg text-sm mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleGrant}
              className="flex items-center gap-1 px-4 py-2 bg-[#171717] text-white rounded-full text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" /> 确认授权
            </button>
            <button
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 border border-[#EEEDE9] rounded-full text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EEEDE9]">
              <th className="text-left py-3 px-2">姓名</th>
              <th className="text-left py-3 px-2">邮箱</th>
              <th className="text-left py-3 px-2">角色</th>
              <th className="text-right py-3 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-[#F5F4F0]">
                <td className="py-3 px-2 font-medium">{user.name}</td>
                <td className="py-3 px-2 text-[#666666]">{user.email}</td>
                <td className="py-3 px-2">{user.role}</td>
                <td className="py-3 px-2 text-right">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="px-3 py-1 text-xs font-medium border border-[#EEEDE9] rounded-full hover:bg-[#F5F4F0]"
                  >
                    授权课程
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
