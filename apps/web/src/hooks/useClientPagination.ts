/**
 * useClientPagination — 简单的客户端分页 hook
 *
 * 解决 audit-frontend-perf-a11y-seo-i18n.md §1 的"list 无分页/虚拟滚动"问题。
 *
 * 当前数据规模: courses ~30 / degrees ~10 / hackathons ~10
 * 用 client-side slice 简单分页足够,不需要后端分页或虚拟滚动。
 *
 * 用法:
 *   const { visible, hasMore, loadMore, reset, total } = useClientPagination(items, { pageSize: 24 });
 *   {visible.map(item => <Card key={item.id} {...item} />)}
 *   {hasMore && <button onClick={loadMore}>加载更多</button>}
 */
import { useCallback, useMemo, useState } from 'react';

export interface UseClientPaginationOptions<T> {
  /** 每页条数,默认 24 */
  pageSize?: number;
  /** 可选:依赖变化时自动 reset (e.g. 搜索条件) */
  resetKey?: unknown;
}

export function useClientPagination<T>(
  items: readonly T[],
  options: UseClientPaginationOptions<T> = {},
) {
  const { pageSize = 24, resetKey } = options;
  const [count, setCount] = useState(pageSize);

  // 当 resetKey 变化时 (e.g. 搜索/筛选),重置回第一页
  useMemo(() => {
    setCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, pageSize]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);
  const hasMore = count < items.length;

  const loadMore = useCallback(() => {
    setCount((c) => Math.min(c + pageSize, items.length));
  }, [pageSize, items.length]);

  const reset = useCallback(() => setCount(pageSize), [pageSize]);

  return { visible, hasMore, loadMore, reset, total: items.length };
}
