/**
 * AdminAuditLogsPage — 审计日志
 *
 * 列表 + 过滤(entity / action / userId)+ 分页
 * 数据源:GET /api/v1/audit-logs
 *
 * 4 tab 切换常见 entity:
 *   - all        (无过滤)
 *   - order      (entity=Order)
 *   - review     (entity=Review)
 *   - course     (entity=Course | Chapter | Lesson)
 */
import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, FileText, ShoppingCart, Star, BookOpen, Loader2 } from 'lucide-react';
import { auditLogsApi } from '../../lib/auditLogsApi';

const TABS: {
  id: 'all' | 'order' | 'review' | 'course';
  label: string;
  entity?: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 'order', label: '订单', entity: 'Order', icon: ShoppingCart },
  { id: 'review', label: '评价', entity: 'Review', icon: Star },
  { id: 'course', label: '课程', entity: 'Course', icon: BookOpen },
];

const PAGE_SIZE = 20;

export function AdminAuditLogsPage() {
  const [tab, setTab] = useState<'all' | 'order' | 'review' | 'course'>('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const activeTab = TABS.find((t) => t.id === tab)!;

  const queryParams = useMemo(
    () => ({
      entity: activeTab.entity,
      userId: userIdFilter || undefined,
      action: actionFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [activeTab.entity, userIdFilter, actionFilter, page],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['admin-audit-logs', queryParams],
    queryFn: () => auditLogsApi.list(queryParams),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
          / Admin · Audit Logs
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">审计日志</h2>
        <p className="text-xs text-[#666666] mt-1">
          全部敏感操作记录 · 仅 admin 可读 · 后端 guard 校验角色
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-[#171717]">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`px-4 py-3 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#666666] hover:text-[#171717]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="border-2 border-[#171717] bg-white p-4 mb-4 flex flex-col md:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 border border-[#171717] focus-within:bg-[#EEEDE9]">
          <Search className="w-4 h-4 text-[#666666] shrink-0" />
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setPage(1);
            }}
            placeholder="按 userId 过滤"
            className="flex-1 py-2 bg-transparent text-sm focus:outline-none font-mono"
          />
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 border border-[#171717] focus-within:bg-[#EEEDE9]">
          <Search className="w-4 h-4 text-[#666666] shrink-0" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="按 action 过滤（如 course.create）"
            className="flex-1 py-2 bg-transparent text-sm focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border-2 border-[#171717] bg-white">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="col-span-3">时间</div>
          <div className="col-span-2">操作人</div>
          <div className="col-span-2">动作</div>
          <div className="col-span-2">实体</div>
          <div className="col-span-3">详情</div>
        </div>
        {isLoading ? (
          <div className="p-16 text-center text-sm text-[#666666] flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载中…
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-sm text-red-600">
            加载失败：{(error as any)?.message ?? '未知错误'}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-16 text-center text-sm text-[#666666]">暂无日志</div>
        ) : (
          data.data.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 text-sm border-b border-[#EEEDE9] last:border-b-0 hover:bg-[#F5F4F0] transition-colors"
            >
              <div className="col-span-12 md:col-span-3 text-[10px] font-mono text-[#666666]">
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </div>
              <div className="col-span-12 md:col-span-2 font-mono text-[10px] truncate text-[#171717]">
                {log.userId ? (
                  <span title={log.userId}>
                    {log.userId.slice(0, 8)}…
                  </span>
                ) : (
                  <span className="text-[#A3A3A3]">system</span>
                )}
              </div>
              <div className="col-span-12 md:col-span-2">
                <span className="inline-flex px-2 py-0.5 bg-[#171717] text-white text-[10px] font-black uppercase tracking-widest font-mono">
                  {log.action}
                </span>
              </div>
              <div className="col-span-12 md:col-span-2 text-xs">
                <span className="font-black">{log.entity}</span>
                {log.entityId && (
                  <span className="text-[#666666] font-mono text-[10px] ml-1">
                    · {log.entityId.slice(0, 6)}…
                  </span>
                )}
              </div>
              <div className="col-span-12 md:col-span-3 text-[10px] font-mono text-[#666666] truncate">
                {log.details ? JSON.stringify(log.details) : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-4 text-xs">
          <div className="text-[#666666]">
            共 <span className="font-black text-[#171717]">{data.total}</span> 条 · 第{' '}
            <span className="font-black text-[#171717]">{page}</span> / {totalPages} 页
            {isFetching && <Loader2 className="w-3 h-3 inline ml-2 animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 border border-[#171717] font-black uppercase tracking-widest text-[10px] hover:bg-[#171717] hover:text-white transition-colors disabled:opacity-30"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 border border-[#171717] font-black uppercase tracking-widest text-[10px] hover:bg-[#171717] hover:text-white transition-colors disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
