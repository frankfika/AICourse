/**
 * ForgotPasswordPage — 忘记密码页(P0-2)
 *
 * mock-auth.html 没具体设计,简洁即可:
 *   - 单 Input 邮箱
 *   - "发送重置链接" 按钮
 *   - 提交后:不管后端返什么(200 防枚举),都显示 "如果该邮箱已注册, 你会收到重置邮件"
 *
 * 涉及后端端点: POST /api/v1/auth/forgot (spec §9.3)
 * Phase 1 状态: 后端可能未实现 — 走 catch 显示通用成功,避免泄漏账号存在性
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '../../lib/zodResolver';
import { Mail, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { AuthShell } from '../../components/auth/AuthShell';
import { useToast } from '../../components/auth/Toast';
import { useAuth } from '../../lib/auth/AuthProvider';
import { api } from '../../lib/api';

const forgotSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
});
type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticating } = useAuth();
  const { showToast } = useToast();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/api/v1/auth/forgot', { email: values.email });
    } catch {
      // 静默 — 故意吞掉错误,避免泄漏账号是否存在(spec §9.3: 200 防枚举)
    } finally {
      setSentTo(values.email);
      showToast('已发送重置邮件', 'success');
    }
  });

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

  // 发送成功 → 显示成功卡片
  if (sentTo) {
    return (
      <AuthShell>
        <Card variant="default" padding="lg" className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-success-100 text-success-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-900">
            重置链接已发送
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-600">
            如果 <span className="font-medium">{sentTo}</span>{' '}
            已注册,我们会向该邮箱发送重置密码的链接。
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            链接 30 分钟内有效,请尽快点击。
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="primary"
              onClick={() => setSentTo(null)}
              fullWidth
            >
              再发一封
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/auth/login')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              fullWidth
            >
              返回登录
            </Button>
          </div>
        </Card>
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
          输入注册邮箱,我们会把重置链接发给你
        </p>
      </header>

      <Card variant="default" padding="lg" className="mt-6">
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
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            leftIcon={!isSubmitting ? <Send className="h-4 w-4" /> : undefined}
          >
            发送重置邮件
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-600">
        想起密码了?{' '}
        <Link
          to="/auth/login"
          className="text-brand-500 font-medium hover:underline"
        >
          返回登录
        </Link>
      </p>
    </AuthShell>
  );
}
