/**
 * ForgotPasswordPage — 忘记密码页(P0-2)
 *
 * mock-auth.html 没具体设计,简洁即可:
 * 当前未配置邮件服务，因此明确引导用户联系管理员，避免伪造发送成功。
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, MailWarning } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { AuthShell } from '../../components/auth/AuthShell';
import { useAuth } from '../../lib/auth/AuthProvider';

export function ForgotPasswordPage() {
  const { isAuthenticating } = useAuth();

  if (isAuthenticating) {
    return (
      <AuthShell>
        <div className="space-y-6">
          <Skeleton variant="text" className="h-8 w-32" />
          <Skeleton variant="text" className="h-4 w-64" />
          <Skeleton variant="text" count={3} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <header>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-900">
          忘记密码
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-600">
          自助邮件重置功能暂未开放
        </p>
      </header>

      <Card variant="default" padding="md" className="mt-6">
        <div className="text-center">
          <MailWarning className="mx-auto h-10 w-10 text-warning-500" />
          <h2 className="mt-3 font-semibold text-neutral-900">请联系平台管理员</h2>
          <p className="mt-2 text-sm text-neutral-600">
            管理员可以为账号生成一次性临时密码。首次登录后，系统会要求你立即设置新密码。
          </p>
          <Link
            to="/auth/login"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#262626]"
          >
            <ArrowLeft className="h-4 w-4" />返回登录
          </Link>
        </div>
      </Card>

      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-600">
        想起密码了?{' '}
        <Link
          to="/auth/login"
          className="text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white font-medium"
        >
          返回登录
        </Link>
      </p>
    </AuthShell>
  );
}
