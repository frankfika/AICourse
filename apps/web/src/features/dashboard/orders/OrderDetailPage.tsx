/**
 * OrderDetailPage — P1-8 单订单详情
 *
 * - 单订单信息(订单号 / 类型 / 标题 / 金额 / 状态 / 支付方式 / 交易号 / 创建时间 / 支付时间)
 * - 关联商品(课程 / 学位)卡片 + 跳转
 * - 操作: 支付 / 取消 / 退款 / 返回
 *
 * 响应式: mobile 单列, desktop 2 列 (订单信息 + 商品)
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ShoppingBag,
  ArrowLeft,
  CreditCard,
  X,
  Undo2,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { ordersApi } from '../../../lib/ordersApi';
import { useToast } from '../../../components/auth/Toast';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Card } from '../../../components/ui/Card';
import { LazyImage } from '../../../components/ui/LazyImage';
import { QueryErrorState } from '../../../components/QueryErrorState';
import type { OrderStatus, OrderType } from '@opencsg/shared-types';
import { cn } from '../../../lib/cn';
import { useEnum } from '../../../lib/cms';

const FALLBACK_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  expired: '已取消',
  refunded: '已退款',
};

const STATUS_ICON: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="w-5 h-5" />,
  paid: <CheckCircle2 className="w-5 h-5" />,
  failed: <AlertCircle className="w-5 h-5" />,
  expired: <XCircle className="w-5 h-5" />,
  refunded: <RotateCcw className="w-5 h-5" />,
};

const FALLBACK_STATUS_CHIP_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-warning-100 text-warning-500 dark:bg-warning-500/20 dark:text-warning-500',
  paid: 'bg-success-100 text-success-500 dark:bg-success-500/20 dark:text-success-500',
  failed: 'bg-danger-100 text-danger-500 dark:bg-danger-500/20 dark:text-danger-500',
  expired: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-200 dark:text-neutral-600',
  refunded: 'bg-info-100 text-info-500 dark:bg-info-500/20 dark:text-info-500',
};

const TYPE_LABEL: Record<OrderType, string> = {
  course: '课程',
  degree: '学位',
};

export function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { getLabel, getColor } = useEnum('order_status');

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.get(id),
    enabled: !!id,
    retry: 0,
  });

  const payMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.pay(orderId),
    onSuccess: () => {
      showToast('支付成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => showToast(err.message || '支付失败', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: () => {
      showToast('订单已取消', 'success');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => showToast(err.message || '取消失败', 'error'),
  });

  const refundMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.refund(orderId),
    onSuccess: () => {
      showToast('退款申请已提交, 1-3 工作日处理', 'success');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => showToast(err.message || '退款申请失败', 'error'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton variant="text" className="h-8 w-1/3" />
          <Skeleton variant="rectangle" className="h-40 w-full" />
          <Skeleton variant="rectangle" className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // P0 (audit 2026-07-24): 区分"网络挂"和"找不到"
  if (isError) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
        <div className="max-w-4xl mx-auto">
          <QueryErrorState
            error={error}
            onRetry={() => refetch()}
            title="无法加载订单详情"
            description="请检查网络后重试"
          />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-neutral-600 dark:text-neutral-600 mb-4">订单不存在</p>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626]"
          >
            <ArrowLeft className="w-4 h-4" />
            返回订单列表
          </Link>
        </div>
      </div>
    );
  }

  const item = order.course ?? order.degree;
  const orderNo = order.id.slice(0, 8).toUpperCase();
  const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
  const paidDate = order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : null;
  const statusLabel = getLabel(order.status) || FALLBACK_STATUS_LABEL[order.status];
  const statusClass = getColor(order.status) || FALLBACK_STATUS_CHIP_CLASS[order.status];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 顶部 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/dashboard/orders"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
            aria-label="返回订单列表"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#171717]" />
            <h1 className="text-2xl font-bold">订单详情</h1>
            <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-600">
              #{orderNo}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左: 订单信息 */}
          <div className="lg:col-span-2 space-y-4">
            <Card padding="lg" variant="default">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full',
                    statusClass,
                  )}
                >
                  {STATUS_ICON[order.status]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{statusLabel}</h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-600">
                    {TYPE_LABEL[order.type]}订单
                  </p>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <Field label="订单号" value={`#${orderNo}`} mono />
                <Field label="商品类型" value={TYPE_LABEL[order.type]} />
                <Field
                  label="商品标题"
                  value={item?.title ?? '(已删除)'}
                />
                <Field
                  label="金额"
                  value={`¥${Number(order.amount).toFixed(2)} ${order.currency}`}
                  highlight
                />
                <Field label="支付方式" value={order.paymentMethod ?? '—'} />
                <Field
                  label="交易号"
                  value={order.transactionId ?? '—'}
                  mono
                />
                <Field label="创建时间" value={createdDate} />
                {paidDate && <Field label="支付时间" value={paidDate} />}
              </dl>

              {/* 操作按钮 */}
              <div className="mt-6 pt-6 border-t border-neutral-200 flex flex-wrap gap-2">
                {order.status === 'pending' && (
                  <>
                    <button
                      onClick={() => payMutation.mutate(order.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626] text-sm font-medium transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      立即支付
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(order.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900 rounded-md hover:bg-neutral-200 text-sm font-medium transition-colors"
                    >
                      <X className="w-4 h-4" />
                      取消订单
                    </button>
                  </>
                )}
                {order.status === 'paid' && (
                  <button
                    onClick={() => refundMutation.mutate(order.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-info-100 text-info-500 rounded-md hover:bg-info-500/20 text-sm font-medium transition-colors"
                  >
                    <Undo2 className="w-4 h-4" />
                    申请退款
                  </button>
                )}
                {order.status === 'refunded' && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-600">
                    ✓ 退款已受理, 1-3 工作日到账
                  </p>
                )}
                {order.status === 'expired' && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-600">
                    订单已取消
                  </p>
                )}
                {order.status === 'failed' && (
                  <button
                    onClick={() => payMutation.mutate(order.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-danger-100 text-danger-500 rounded-md hover:bg-danger-500/20 text-sm font-medium transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    重试支付
                  </button>
                )}
              </div>
            </Card>
          </div>

          {/* 右: 关联商品 */}
          {item && (
            <div>
              <Card padding="md" variant="default">
                <h3 className="text-sm font-semibold mb-3">关联商品</h3>
                {item.thumbnail && (
                  <LazyImage
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full aspect-video object-cover bg-neutral-200 dark:bg-neutral-200 mb-3"
                  />
                )}
                <h4 className="text-sm font-medium mb-1">{item.title}</h4>
                {item.costType && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-600">
                    定价: ¥{Number(item.price ?? 0).toFixed(2)}
                  </p>
                )}
                {order.type === 'course' && (
                  <Link
                    to={`/courses/${item.id}`}
                    className="mt-3 inline-flex w-full justify-center items-center gap-1 px-3 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626] text-xs font-medium transition-colors"
                  >
                    查看课程
                  </Link>
                )}
                {order.type === 'degree' && (
                  <Link
                    to={`/degrees/${item.id}`}
                    className="mt-3 inline-flex w-full justify-center items-center gap-1 px-3 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626] text-xs font-medium transition-colors"
                  >
                    查看学位
                  </Link>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 text-neutral-600 dark:text-neutral-600">{label}</dt>
      <dd
        className={cn(
          'flex-1 break-all',
          mono && 'font-mono text-xs',
          highlight && 'text-xl font-bold text-[#171717]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
