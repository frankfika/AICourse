import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowUpRight, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register: doRegister, providers, providersLoaded } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await doRegister(email, password, name);
        setIsRegister(false);
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] grid grid-cols-1 lg:grid-cols-2">
      {/* Left: brand pitch */}
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-[#171717] text-white">
        <div className="flex items-center gap-2 font-black text-lg tracking-tighter uppercase">
          <span className="w-7 h-7 bg-white flex items-center justify-center text-[#171717]">
            <GraduationCap className="w-4 h-4" />
          </span>
          OpenCSG Academy
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">
            / 2026 · Open
          </div>
          <h1 className="text-5xl xl:text-7xl font-black tracking-tighter uppercase leading-[0.95] mb-6">
            Master<br />AI.<br />Own The<br />Future.
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md">
            加入 10,000+ 工程师的 AI 学习社区，由业界专家亲授，从入门到实战一站打通。
          </p>
        </div>

        <div className="space-y-3 text-sm text-white/50">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-white" />
            <span>体系化课程路径</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-white" />
            <span>OpenCSG 官方认证证书</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-white" />
            <span>企业级实战项目</span>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile-only brand */}
          <div className="lg:hidden flex items-center gap-2 font-black text-lg tracking-tighter uppercase mb-12">
            <span className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </span>
            OpenCSG Academy
          </div>

          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
            {isRegister ? '/ 02 Register' : '/ 01 Login'}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none mb-3">
            {isRegister ? '创建账号' : '欢迎回来'}
          </h2>
          <p className="text-[#666666] mb-10 text-sm">
            {isRegister ? '注册后立即开始学习 AI 课程' : '登录以访问你的课程与进度'}
          </p>

          {error && (
            <div className="mb-5 p-3 border-2 border-[#171717] bg-[#F5F4F0] text-[#171717] text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 block">
                  姓名
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
                    required
                    placeholder="你的姓名"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 block">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 block">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
                  required
                  minLength={6}
                  placeholder="至少 6 位"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-between gap-3 bg-[#171717] text-white px-6 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <span>{loading ? '请稍候...' : isRegister ? '创建账号' : '登录'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </form>

          <div className="my-8 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#A3A3A3]">
            <span className="flex-1 h-px bg-[#EEEDE9]" />
            <span>Or</span>
            <span className="flex-1 h-px bg-[#EEEDE9]" />
          </div>

          {/* 动态 OAuth / SSO 按钮 - 从后端拉启用列表,不 hardcode */}
          {providersLoaded && providers.filter((p) => p.type !== 'email_password').length > 0 && (
            <div className="space-y-2 mb-6">
              {providers
                .filter((p) => p.type !== 'email_password')
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      // OAuth/SSO provider 走标准 authorize 跳转流程
                      // 这里只是入口示意 - 完整 redirect_uri + state 流程在 IdP 接入时实现
                      alert(
                        `${p.label} 登录待 OAuth authorize 流程接入。\nProvider: ${p.id}`,
                      );
                    }}
                    className="w-full inline-flex items-center justify-between gap-3 bg-white border-2 border-[#171717] text-[#171717] px-6 py-3.5 font-black uppercase tracking-widest text-sm hover:bg-[#171717] hover:text-white transition-colors"
                  >
                    <span>用 {p.label} 登录</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                ))}
            </div>
          )}

          <p className="text-center text-sm text-[#666666]">
            {isRegister ? '已有账号？' : '还没有账号？'}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="ml-2 text-[#171717] font-black uppercase tracking-widest text-xs underline underline-offset-4 hover:no-underline"
            >
              {isRegister ? '直接登录 →' : '立即注册 →'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
