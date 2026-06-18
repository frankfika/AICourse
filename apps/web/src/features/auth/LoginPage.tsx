import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/v1/auth/register' : '/api/v1/auth/login';
      const payload = isRegister ? { email, password, name } : { email, password };
      const { data } = await api.post(endpoint, payload);
      if (isRegister) {
        setIsRegister(false);
      } else {
        setAuth(data.user, data.accessToken, data.refreshToken);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#EEEDE9] p-8">
        <h1 className="text-2xl font-bold mb-2">{isRegister ? '创建账号' : '欢迎回来'}</h1>
        <p className="text-[#666666] mb-6">
          {isRegister ? '注册后开始学习 AI 课程' : '登录以访问你的课程'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-[#EEEDE9] rounded-lg focus:outline-none focus:border-[#171717]"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#171717] text-white rounded-full font-medium hover:bg-[#262626] disabled:opacity-50"
          >
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#666666]">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="ml-1 text-[#171717] font-medium underline"
          >
            {isRegister ? '直接登录' : '立即注册'}
          </button>
        </p>
      </div>
    </div>
  );
}
