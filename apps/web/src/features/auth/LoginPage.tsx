/**
 * LoginPage — 登录页(P0-2)
 *
 * 设计参考 review/mocks/mock-auth.html
 *   - 双 tab(登录 / 注册),URL 路由:/auth/login 和 /auth/register 各自独立
 *   - 6 宫格第三方按钮(Phase 1 全部 disabled,灰度)
 *   - 邮箱 + 密码 + (登录 7 天免登 checkbox)
 *   - "继续即同意服务条款" footer
 *   - 错误:行内 error + 顶部 toast
 *   - react-hook-form + zod 校验
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '../../lib/zodResolver';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProviderButtons } from '../../components/auth/ProviderButtons';
import { AuthShell, AuthTabSwitcher } from '../../components/auth/AuthShell';
import { useToast } from '../../components/auth/Toast';
import { useAuth } from '../../lib/auth/AuthProvider';

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少 6 位'),
  remember: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

function extractErrorMessage(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return undefined;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get('from') ?? '/';
  const { signIn, user, isAuthenticating } = useAuth();
  const { showToast } = useToast();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  // 已登录用户访问 /auth/login 自动重定向
  useEffect(() => {
    if (!isAuthenticating && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticating, user, from, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn({
        kind: 'local',
        email: values.email,
        password: values.password,
      });
      showToast('登录成功', 'success');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err) ?? '登录失败,请检查邮箱或密码';
      showToast(msg, 'error', 4000);
    }
  });

  const handleGrayscaleProviderClick = (providerId: string, label: string) => {
    showToast(`${label} 登录即将推出, 灰度开放中`, 'info', 2500);
    // eslint-disable-next-line no-console
    console.info(
      `[auth] Phase 1 gray: provider ${providerId} clicked but disabled`,
    );
  };

  // 启动期骨架(避免白屏)
  if (isAuthenticating) {
    return (
      <AuthShell>
        <div className="space-y-6">
          <Skeleton variant="text" className="h-8 w-32" />
          <Skeleton variant="text" className="h-4 w-64" />
          <Skeleton variant="rectangle" className="h-32 w-full rounded-lg" />
          <Skeleton variant="text" count={2} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthTabSwitcher
        current="login"
        loginHref="/auth/login"
        registerHref="/auth/register"
      />

      <header>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-900">
          欢迎回来
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-600">
          继续你的 AI 时代学习路径
        </p>
      </header>

      {/* 第三方登录 6 宫格(灰度) */}
      <section className="mt-6">
        <ProviderButtons
          grayscale
          onProviderClick={handleGrayscaleProviderClick}
        />
        <p className="mt-2 text-[10px] text-center text-neutral-400">
          已登录过 OpenCSG?系统会自动合并到你的账号
        </p>
      </section>

      {/* 分隔 */}
      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-200" />
        <span>或使用邮箱</span>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-200" />
      </div>

      {/* 邮箱密码表单 */}
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          label="邮箱"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          fullWidth
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="text-sm font-medium text-neutral-900 dark:text-neutral-900"
            >
              密码<span className="text-danger-500 ml-1">*</span>
            </label>
            <Link
              to="/auth/forgot"
              className="text-xs text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white"
            >
              忘记密码?
            </Link>
          </div>
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            fullWidth
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="p-1 -mr-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-neutral-200 text-[#171717] focus:ring-[#171717]"
            {...register('remember')}
          />
          7 天内自动登录(仅本设备)
        </label>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          leftIcon={!isSubmitting ? <LogIn className="h-4 w-4" /> : undefined}
        >
          登录
        </Button>
      </form>

      {/* 切换链接 */}
      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-600">
        还没有账号?{' '}
        <Link
          to="/auth/register"
          className="text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white font-medium"
        >
          免费注册 →
        </Link>
      </p>

      {/* 法律 */}
      <p className="mt-4 text-center text-[10px] text-neutral-400">
        继续即表示你同意我们的{' '}
        <a href="/terms" className="underline hover:text-neutral-600">
          服务条款
        </a>{' '}
        和{' '}
        <a href="/privacy" className="underline hover:text-neutral-600">
          隐私政策
        </a>
      </p>
    </AuthShell>
  );
}
