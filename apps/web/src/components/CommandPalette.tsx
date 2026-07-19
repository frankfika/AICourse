/**
 * CommandPalette — P1-2 全局 ⌘K 搜索弹层
 *
 * 行为:
 *   - open=true 时 mount
 *   - 顶部:大 input + kbd "ESC" hint
 *   - 中部:按 type 分组(课程 / 学位 / 黑客松 / 讲师),每组 max 4 条
 *   - 键盘 ↑↓ 在所有可见结果间切换,Enter 跳转,⌘+Enter 新窗口打开
 *   - 空查询:显示 "热门搜索" 4 chips
 *   - 加载:Skeleton (text count=3)
 *   - 0 结果:EmptyState ("没找到相关内容, 试试其他关键词")
 *   - 弹层 fadeIn 200ms + scale 0.95 → 1(纯 CSS transition,无 framer-motion)
 *
 * 响应式 3 断点(spec):
 *   - mobile (< 768px):全屏 modal
 *   - tablet (768-1024px):600×400 居中弹层
 *   - desktop (≥ 1024px):720×440 居中弹层
 *
 * 父组件用 <CommandPalette open onClose /> 挂载,内部管所有键盘 / focus。
 * 暴露 onSelect?可选,父可监听(目前父不需要)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, GraduationCap, Trophy, User as UserIcon, ArrowUpRight, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { cn } from '../lib/cn';
import { searchAll, groupResults, HOT_SEARCHES, type SearchResult, type SearchResultType } from '../lib/searchApi';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// 每个 type 的视觉元数据
const TYPE_META: Record<SearchResultType, { label: string; icon: typeof BookOpen; color: string }> = {
  course: { label: '课程', icon: BookOpen, color: 'text-brand-500' },
  degree: { label: '学位', icon: GraduationCap, color: 'text-xp-500' },
  hackathon: { label: '黑客松', icon: Trophy, color: 'text-warning-500' },
  instructor: { label: '讲师', icon: UserIcon, color: 'text-info-500' },
};

const PER_GROUP_LIMIT = 4;

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // debounce 200ms(比 300ms 略快,Command-K 要即时感)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // 拉数据(用 react-query 自动管 dedupe / cache)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAll(debouncedQuery),
    enabled: open,
    staleTime: 30_000,
  });

  // 拼出"扁平 + 分组"两份数据,给键盘导航 + 渲染共用
  const groups = useMemo(() => {
    if (!data) return [];
    return groupResults(data.results).map((g) => ({
      ...g,
      items: g.items.slice(0, PER_GROUP_LIMIT),
    }));
  }, [data]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // 切换 query / 拉新数据 → 重置选中
  useEffect(() => {
    setSelectedIdx(0);
  }, [debouncedQuery]);

  // 打开时自动 focus input
  useEffect(() => {
    if (open) {
      // 微延迟,等 modal 动画完
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      // 关闭时清空 query,避免下次打开还残留
      setQuery('');
      setSelectedIdx(0);
    }
  }, [open]);

  // 全局 esc 关闭 + 上下/回车(在 input 内不冲突)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
      } else if (e.key === 'Enter') {
        const item = flat[selectedIdx];
        if (!item) return;
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          window.open(item.href, '_blank', 'noopener,noreferrer');
        } else {
          navigate(item.href);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, flat, selectedIdx, navigate]);

  // 选中项 scroll into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  // 计算每个 item 在 flat 数组里的 idx
  let runningIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="全站搜索"
      onMouseDown={(e) => {
        // 点击 backdrop 关闭(mousedown 时机比 click 早,避免与 input focus 冲突)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 dark:bg-neutral-950/70 animate-[fadeIn_200ms_ease-out]"
        aria-hidden="true"
      />

      {/* 弹层本体 */}
      <div
        className={cn(
          'relative w-full',
          'h-[100dvh] sm:h-auto',
          'sm:max-w-[600px] md:max-w-[600px] lg:max-w-[720px]',
          'sm:max-h-[400px] md:max-h-[400px] lg:max-h-[440px]',
          'bg-neutral-0 dark:bg-neutral-100',
          'rounded-none sm:rounded-xl',
          'border border-neutral-200',
          'shadow-lg',
          'flex flex-col overflow-hidden',
          'animate-[paletteIn_200ms_ease-out]',
        )}
      >
        {/* 顶部 input */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-neutral-200 shrink-0">
          <Search className="w-5 h-5 text-neutral-600 dark:text-neutral-600 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索课程 / 学位 / 黑客松 / 讲师..."
            className={cn(
              'flex-1 bg-transparent outline-none text-base sm:text-lg',
              'text-neutral-900 placeholder:text-neutral-400',
              'dark:text-neutral-900 dark:placeholder:text-neutral-600',
            )}
            autoComplete="off"
            spellCheck={false}
            aria-label="搜索关键字"
          />
          <kbd
            className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded border border-neutral-200 text-neutral-600 dark:text-neutral-600"
            aria-label="按 ESC 关闭"
          >
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="sm:hidden p-1 -mr-1 text-neutral-600 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-900"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 中部结果区 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {/* 加载状态 */}
          {(isLoading || isFetching) && debouncedQuery && (
            <div className="p-5 space-y-3">
              <Skeleton variant="text" count={3} />
            </div>
          )}

          {/* 空查询:热门搜索 chips */}
          {!debouncedQuery && (
            <div className="p-5 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 mb-3">
                热门搜索
              </div>
              <div className="flex flex-wrap gap-2">
                {HOT_SEARCHES.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setQuery(h);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium',
                      'bg-neutral-100 dark:bg-neutral-100',
                      'text-neutral-900 dark:text-neutral-900',
                      'hover:bg-brand-100 dark:hover:bg-brand-100 hover:text-brand-700',
                      'transition-colors',
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="mt-6 text-xs text-neutral-600 dark:text-neutral-600 leading-relaxed">
                提示:用 <kbd className="px-1 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-100">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-100">↓</kbd>{' '}
                切换, <kbd className="px-1 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-100">↵</kbd>{' '}
                跳转, <kbd className="px-1 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-100">⌘↵</kbd>{' '}
                新窗口打开
              </div>
            </div>
          )}

          {/* 有结果:按 type 分组 */}
          {debouncedQuery && !isLoading && !isFetching && groups.some((g) => g.items.length > 0) && (
            <div className="py-2">
              {groups.map((g) => {
                if (g.items.length === 0) return null;
                const Icon = TYPE_META[g.type].icon;
                return (
                  <div key={g.type} className="mb-1">
                    <div className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 flex items-center gap-2">
                      <Icon className={cn('w-3 h-3', TYPE_META[g.type].color)} />
                      {TYPE_META[g.type].label}
                      <span className="text-neutral-400">({g.items.length})</span>
                    </div>
                    {g.items.map((item) => {
                      const idx = runningIdx++;
                      const selected = idx === selectedIdx;
                      return (
                        <ResultRow
                          key={`${g.type}-${item.id}`}
                          item={item}
                          selected={selected}
                          idx={idx}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => {
                            navigate(item.href);
                            onClose();
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* 0 结果 */}
          {debouncedQuery && !isLoading && !isFetching && flat.length === 0 && (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={<Search className="w-6 h-6" />}
                title="没找到相关内容"
                description="试试其他关键词,例如「LangChain」「RAG」「Agent」"
              />
            </div>
          )}

          {/* 部分端点失败提示 */}
          {data?.hasFailures && debouncedQuery && (
            <div className="px-5 py-2 text-[10px] text-warning-500 border-t border-neutral-200">
              部分搜索服务暂不可用,部分结果可能缺失
            </div>
          )}
        </div>

        {/* 底部:计数 + 键盘 hint(桌面) */}
        {flat.length > 0 && (
          <div className="hidden sm:flex items-center justify-between px-5 py-2 border-t border-neutral-200 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 shrink-0">
            <span>
              {data?.counts && (
                <>
                  共 {data.counts.course + data.counts.degree + data.counts.hackathon + data.counts.instructor} 条
                </>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span>
                <kbd className="font-mono">↵</kbd> 跳转
              </span>
              <span>
                <kbd className="font-mono">⌘↵</kbd> 新窗口
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 注入 keyframes(纯 CSS,避免引 framer-motion) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes paletteIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// 单个结果行
function ResultRow({
  item,
  selected,
  idx,
  onClick,
  onMouseEnter,
}: {
  item: SearchResult;
  selected: boolean;
  idx: number;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      data-idx={idx}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full text-left px-5 py-2.5 flex items-start gap-3',
        'transition-colors',
        selected
          ? 'bg-brand-50 dark:bg-brand-900/30'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-100',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm text-neutral-900 dark:text-neutral-900 truncate">
            {item.title}
          </span>
          {item.badge && (
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-600 shrink-0">
              {item.badge}
            </span>
          )}
        </div>
        {item.subtitle && (
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-600 line-clamp-1">
            {item.subtitle}
          </p>
        )}
        {item.meta && (
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
            {item.meta}
          </p>
        )}
      </div>
      <ArrowUpRight
        className={cn(
          'w-4 h-4 mt-0.5 shrink-0 transition-opacity',
          selected ? 'opacity-100 text-brand-500' : 'opacity-0 text-neutral-400',
        )}
        aria-hidden="true"
      />
    </button>
  );
}
