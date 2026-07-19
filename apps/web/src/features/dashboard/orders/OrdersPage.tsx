/**
 * OrdersPage — P1-8 我的订单
 *
 * 设计:
 *   - 5 tab: 全部 / 待支付 / 已支付 / 已取消 / 已退款
 *   - 列表 (mobile 卡片单列, tablet 2 列, desktop 表格 1 列全宽)
 *   - 状态 chip: pending-payment (warning) / paid (success) / cancelled (neutral) / refunded (info) / failed (danger)
 *   - 操作: 查看 / 支付 / 取消 / 申请退款
 *
 * 响应式:
 *   - < sm: 卡片单列, 横向 scroll tabs
 *   - md (768+): 卡片 2 列
 *   - lg (1024+): 表格视图
 *
 * dark mode: 全走 token (bg-neutral-* / text-neutral-* / border-neutral-*)
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ShoppingBag,
  ArrowLeft,
  Eye,
  CreditCard,
  X,
  Undo2,
  Search,
} from 'lucide-react';
import type { OrderWithItems, OrderStatus } from '@opencsg/shared-types';
import { ordersApi } from '../../../lib/ordersApi';
import { useToast } from '../../../components/auth/Toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Card } from '../../../components/ui/Card';
import { QueryErrorState } from '../../../components/QueryErrorState';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { cn } from '../../../lib/cn';

type TabKey = 'all' | 'pending' | 'paid' | 'cancelled' | 'refunded';

interface TabDef {
  key: TabKey;
  label: string;
  /** 匹配 OrderStatus (订单 → tab) */
  match: (status: OrderStatus) => boolean;
}

const TABS: TabDef[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'pending', label: '待支付', match: (s) => s === 'pending' },
  { key: 'paid', label: '已支付', match: (s) => s === 'paid' },
  { key: 'cancelled', label: '已取消', match: (s) => s === 'expired' || s === 'failed' },
  { key: 'refunded', label: '已退款', match: (s) => s === 'refunded' },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  expired: '已取消',
  refunded: '已退款',
};

const STATUS_CHIP_CLASS: Record<OrderStatus, string> = {
  // 走 token: warning-100 / success-100 / neutral-200 / info-100 / danger-100
  pending:
    'bg-warning-100 text-warning-500 dark:bg-warning-500/20 dark:text-warning-500',
  paid: 'bg-success-100 text-success-500 dark:bg-success-500/20 dark:text-success-500',
  failed: 'bg-danger-100 text-danger-500 dark:bg-danger-500/20 dark:text-danger-500',
  expired:
    'bg-neutral-200 text-neutral-600 dark:bg-neutral-200 dark:text-neutral-600',
  refunded: 'bg-info-100 text-info-500 dark:bg-info-500/20 dark:text-info-500',
};

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', 'me'],
    queryFn: () => ordersApi.myOrders(),
  });

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    return orders.filter((o) => tab.match(o.status));
  }, [orders, activeTab]);

  // 统计
  const counts = useMemo(() => {
    const result: Record<TabKey, number> = {
      all: orders.length,
      pending: 0,
      paid: 0,
      cancelled: 0,
      refunded: 0,
    };
    for (const o of orders) {
      const t = TABS.find((tab) => tab.key !== 'all' && tab.match(o.status));
      if (t) result[t.key]++;
    }
    return result;
  }, [orders]);

  // 操作 mutation
  const payMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.pay(orderId),
    onSuccess: () => {
      showToast('支付成功, 已自动注册', 'success');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
    onError: (err: Error) => {
      showToast(err.message || '支付失败', 'error');
    },
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

  // P1: 二次确认 + 按钮 isPending 锁
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 顶部: 返回 + 标题 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/dashboard"
            className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
            aria-label="返回学习中心"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-500" />
            <h1 className="text-2xl font-bold">我的订单</h1>
            <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-600">
              共 {orders.length} 笔
            </span>
          </div>
        </div>

        {/* 5 tab 横向 (mobile 滚) */}
        <div className="border-b border-neutral-200 dark:border-neutral-200 mb-6 -mx-4 sm:mx-0">
          <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-0 scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === t.key
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900',
                )}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-neutral-400">
                  ({counts[t.key]})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        {isError ? (
          <QueryErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangle" className="h-24 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-6 h-6" />}
            title={activeTab === 'all' ? '还没有订单' : `没有${TABS.find((t) => t.key === activeTab)?.label}的订单`}
            description="去逛逛课程大厅, 找到感兴趣的课程吧"
            action={
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-neutral-0 rounded-md hover:bg-brand-700 transition-colors text-sm font-medium"
              >
                <Search className="w-4 h-4" />
                浏览课程
              </Link>
            }
          />
        ) : (
          <>
            {/* mobile + tablet: 卡片单/双列 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {filtered.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onPay={(id) => payMutation.mutate(id)}
                  onCancel={(id) => setConfirmCancelId(id)}
                  onRefund={(id) => setConfirmRefundId(id)}
                  isAnyPending={payMutation.isPending || cancelMutation.isPending || refundMutation.isPending}
                />
              ))}
            </div>
            {/* desktop: 表格 */}
            <OrderTable
              orders={filtered}
              onPay={(id) => payMutation.mutate(id)}
              onCancel={(id) => setConfirmCancelId(id)}
              onRefund={(id) => setConfirmRefundId(id)}
              isAnyPending={payMutation.isPending || cancelMutation.isPending || refundMutation.isPending}
            />
          </>
        )}
      </div>

      {/* 二次确认弹层 */}
      <ConfirmDialog
        open={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        onConfirm={async () => {
          if (confirmCancelId) await cancelMutation.mutateAsync(confirmCancelId);
        }}
        title="确认取消订单?"
        description="取消后该订单将关闭,如需重新购买请创建新订单。"
        variant="warning"
        confirmText="确认取消"
      />
      <ConfirmDialog
        open={!!confirmRefundId}
        onClose={() => setConfirmRefundId(null)}
        onConfirm={async () => {
          if (confirmRefundId) await refundMutation.mutateAsync(confirmRefundId);
        }}
        title="确认申请退款?"
        description="退款规则请参考用户手册 §12.4。申请提交后 1-3 个工作日处理。"
        variant="danger"
        confirmText="确认退款"
      />
    </div>
  );
}

// ============================================================
// 卡片 (mobile + tablet)
// ============================================================
function OrderCard({
  order,
  onPay,
  onCancel,
  onRefund,
  isAnyPending,
}: {
  order: OrderWithItems;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onRefund: (id: string) => void;
  isAnyPending?: boolean;
}) {
  const item = order.course ?? order.degree;
  const itemTitle = item?.title ?? '未知商品';
  const itemThumb = item?.thumbnail ?? null;
  const orderNo = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card padding="md" variant="default">
      <div className="flex gap-3">
        {itemThumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={itemThumb}
            alt={itemTitle}
            className="w-16 h-16 rounded-md object-cover bg-neutral-200 dark:bg-neutral-200 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{itemTitle}</h3>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-600">
                {order.type === 'course' ? '课程' : '学位'} · #{orderNo}
              </p>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                STATUS_CHIP_CLASS[order.status],
              )}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-lg font-bold text-brand-500">
              ¥{Number(order.amount).toFixed(2)}
            </div>
            <OrderActions order={order} onPay={onPay} onCancel={onCancel} onRefund={onRefund} compact isAnyPending={isAnyPending} />
          </div>
          <p className="mt-1 text-xs text-neutral-400">{orderDate}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// 表格 (desktop lg+)
// ============================================================
function OrderTable({
  orders,
  onPay,
  onCancel,
  onRefund,
  isAnyPending,
}: {
  orders: OrderWithItems[];
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onRefund: (id: string) => void;
  isAnyPending?: boolean;
}) {
  return (
    <div className="hidden lg:block bg-neutral-0 dark:bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100 dark:bg-neutral-100 text-neutral-600 dark:text-neutral-600 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left font-medium">订单号</th>
            <th className="px-4 py-3 text-left font-medium">类型</th>
            <th className="px-4 py-3 text-left font-medium">标题</th>
            <th className="px-4 py-3 text-right font-medium">金额</th>
            <th className="px-4 py-3 text-center font-medium">状态</th>
            <th className="px-4 py-3 text-left font-medium">创建时间</th>
            <th className="px-4 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {orders.map((o) => {
            const item = o.course ?? o.degree;
            const itemTitle = item?.title ?? '未知商品';
            const orderNo = o.id.slice(0, 8).toUpperCase();
            const orderDate = new Date(o.createdAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <tr key={o.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-neutral-600">#{orderNo}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-100">
                    {o.type === 'course' ? '课程' : '学位'}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[280px]">
                  <span className="font-medium truncate block">{itemTitle}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-brand-500">
                  ¥{Number(o.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      STATUS_CHIP_CLASS[o.status],
                    )}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">{orderDate}</td>
                <td className="px-4 py-3">
                  <OrderActions order={o} onPay={onPay} onCancel={onCancel} onRefund={onRefund} isAnyPending={isAnyPending} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 操作按钮组 (用于卡片 + 表格)
// ============================================================
function OrderActions({
  order,
  onPay,
  onCancel,
  onRefund,
  compact = false,
  isAnyPending = false,
}: {
  order: OrderWithItems;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onRefund: (id: string) => void;
  compact?: boolean;
  /** 任一操作进行中时锁住所有按钮,避免双击/连点 */
  isAnyPending?: boolean;
}) {
  const baseBtn = cn(
    'inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors',
    compact ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-xs',
  );
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'flex-wrap' : 'justify-end')}>
      <Link
        to={`/dashboard/orders/${order.id}`}
        className={cn(
          baseBtn,
          'bg-neutral-100 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900 hover:bg-neutral-200',
        )}
        title="查看详情"
      >
        <Eye className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">查看</span>
      </Link>
      {order.status === 'pending' && (
        <>
          <button
            onClick={() => onPay(order.id)}
            disabled={isAnyPending}
            className={cn(
              baseBtn,
              'bg-brand-500 text-neutral-0 hover:bg-brand-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="去支付"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">支付</span>
          </button>
          <button
            onClick={() => onCancel(order.id)}
            disabled={isAnyPending}
            className={cn(
              baseBtn,
              'bg-neutral-100 dark:bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="取消订单"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">取消</span>
          </button>
        </>
      )}
      {order.status === 'paid' && (
        <button
          onClick={() => onRefund(order.id)}
          disabled={isAnyPending}
          className={cn(
            baseBtn,
            'bg-info-100 text-info-500 hover:bg-info-500/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          title="申请退款"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">退款</span>
        </button>
      )}
    </div>
  );
}
