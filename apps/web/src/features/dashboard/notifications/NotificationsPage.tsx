/**
 * NotificationsPage — P1-7 通知中心 (placeholder 抢救版)
 *
 * Sub-agent 42212 fail 时只写了后端 notification controller (5 endpoint mapped),
 * 前端 UI 跟路由没来得及接。Owner 抢救时先给一个 placeholder, 完整 UI
 * 等 P1-7 重做 (用后端真实 /api/v1/notifications 5 endpoint, 已在 nest 启动).
 *
 * 完整功能 (后续):
 *  - 4 tab (全部 / 未读 / 系统 / 互动)
 *  - 列表 (icon + title + body + 时间 + 操作)
 *  - 分页 / 滚动加载
 *  - mark read / delete / read-all
 *  - 30s 轮询 unread-count
 */
import { Link } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Card } from '../../../components/ui/Card';

export function NotificationsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-500" />
            <h1 className="text-2xl font-bold">通知中心</h1>
          </div>
        </div>

        {/* 4 tab 骨架 (后续接 react-query) */}
        <div className="flex items-center gap-1 border-b border-neutral-200 mb-6">
          {['全部', '未读', '系统', '互动'].map((label, i) => (
            <button
              key={label}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                i === 0
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 通知列表骨架 (后续接真实数据) */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="md" variant="outlined">
              <div className="flex items-start gap-3">
                <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="h-4 w-1/3" />
                  <Skeleton variant="text" className="h-3 w-2/3" />
                  <Skeleton variant="text" className="h-3 w-1/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 占位说明 */}
        <div className="mt-8 p-6 bg-neutral-100 dark:bg-neutral-100 border border-dashed border-neutral-200 rounded-lg text-center">
          <Bell className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
          <p className="text-sm text-neutral-600 dark:text-neutral-600 mb-1">
            通知中心 UI 正在迭代中
          </p>
          <p className="text-xs text-neutral-400">
            后端 5 endpoint 已上线 (GET/POST/DELETE/clear-read) — 完整 UI 等 P1-7 重做
          </p>
        </div>
      </div>
    </div>
  );
}
