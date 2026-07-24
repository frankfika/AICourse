/**
 * WebAssistantDrawer — 全站 FAB 触发的 floating chat drawer
 *
 * 范围:全站(web assistant),跟 /dashboard/learning 的课程内小助手互不干扰
 * 触发:Layout 那个黑色圆球 FAB + mobile bottom tab 的 AI icon
 * 登录态:未登录点 FAB 直接跳 /auth/login(由 Layout 的 onClick 判断)
 *
 * 响应式:
 *   - mobile (<768px): 全屏底部抽屉 h-[80vh],从 bottom 滑入
 *   - desktop (>=768px): 480×600 floating,right-6 bottom-[80px]
 *
 * 数据流:
 *   1. open=true → GET /chat/sessions 拉历史
 *   2. 选/建 session → 拉 messages(命中 store 缓存跳过)
 *   3. sendMessage → optimistic append user + isSending → 响应后 append assistant
 *   4. sources 作为可点击 chip,点击 navigate(url) + closeDrawer
 *
 * 关闭:backdrop / X / Esc 都触发 closeDrawer
 * 状态保留:currentSessionId 走 zustand + localStorage 持久化(下次打开恢复)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, Plus, MessageSquare, BookOpen, GraduationCap, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi, type ChatSource, type ChatMessage } from '../../lib/chatApi';
import { useWebAssistantStore } from '../../stores/webAssistantStore';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { WebAssistantMessage } from './WebAssistantMessage';
import { WebAssistantInput } from './WebAssistantInput';
import { WebAssistantSessionList } from './WebAssistantSessionList';

const QUICK_PROMPTS = [
  { label: '推荐一门 AI 入门课', icon: BookOpen },
  { label: '什么是纳米学位?', icon: GraduationCap },
  { label: '黑客松怎么报名?', icon: Trophy },
  { label: '企业培训有哪些方案?', icon: Sparkles },
];

export function WebAssistantDrawer() {
  const open = useWebAssistantStore((s) => s.open);
  const closeDrawer = useWebAssistantStore((s) => s.closeDrawer);
  const currentSessionId = useWebAssistantStore((s) => s.currentSessionId);
  const messagesBySession = useWebAssistantStore((s) => s.messagesBySession);
  const draftInput = useWebAssistantStore((s) => s.draftInput);
  const setCurrentSession = useWebAssistantStore((s) => s.setCurrentSession);
  const setMessages = useWebAssistantStore((s) => s.setMessages);
  const appendMessage = useWebAssistantStore((s) => s.appendMessage);
  const setDraftInput = useWebAssistantStore((s) => s.setDraftInput);

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSourcesRef = useRef<ChatSource[]>([]);

  // 拉 session 列表
  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatApi.listSessions(),
    enabled: open,
    staleTime: 30_000,
  });

  // 拉当前 session 的 messages(有缓存时跳过)
  const messagesQuery = useQuery({
    queryKey: ['chat-messages', currentSessionId],
    queryFn: () => chatApi.getMessages(currentSessionId!),
    enabled: open && !!currentSessionId,
    staleTime: 30_000,
  });

  // query → store 缓存(避免重渲染时丢消息)
  useEffect(() => {
    if (currentSessionId && messagesQuery.data) {
      setMessages(currentSessionId, messagesQuery.data);
    }
  }, [currentSessionId, messagesQuery.data, setMessages]);

  // P1-9+ 修复: 只在 drawer **首次打开**时校验 stale sessionId,避免用户切/建
  // session 时 effect 误清空(handleNewSession 内 setCurrentSession + refetch
  // 之间,新 session 可能还没出现在 list)
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return; // 已经在开的状态,不重复校验
    wasOpenRef.current = true;
    if (
      currentSessionId &&
      sessionsQuery.data &&
      !sessionsQuery.data.some((s) => s.id === currentSessionId)
    ) {
      setCurrentSession(null);
    }
  }, [open, currentSessionId, sessionsQuery.data, setCurrentSession]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeDrawer]);

  // 消息/loading 变化时滚到底
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, currentSessionId, messagesBySession, isSending]);

  const handleNewSession = useCallback(async () => {
    try {
      setSendError(null);
      const { sessionId } = await chatApi.createSession();
      setCurrentSession(sessionId);
      setMessages(sessionId, []);
      // 刷新 session 列表(后端拿到新 session 入库)
      // 不会触发 stale session effect(那个 effect 只在首次 open 跑一次)
      sessionsQuery.refetch();
    } catch {
      setSendError('创建对话失败,请稍后重试');
    }
  }, [setCurrentSession, setMessages, sessionsQuery]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setCurrentSession(sessionId);
    },
    [setCurrentSession],
  );

  const handleSend = useCallback(async () => {
    const text = draftInput.trim();
    if (!text || isSending) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const created = await chatApi.createSession();
        sessionId = created.sessionId;
        setCurrentSession(sessionId);
        setMessages(sessionId, []);
      } catch {
        setSendError('创建对话失败,请稍后重试');
        return;
      }
    }

    // optimistic: append user message
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendMessage(sessionId, optimisticUser);
    setDraftInput('');
    setIsSending(true);
    setSendError(null);
    lastSourcesRef.current = [];

    try {
      const res = await chatApi.sendMessage(sessionId, text);
      // 替换 optimistic user msg + append assistant
      const current = useWebAssistantStore.getState().messagesBySession[sessionId] ?? [];
      const withoutOptimistic = current.filter((m) => m.id !== optimisticUser.id);
      setMessages(sessionId, [...withoutOptimistic, res.userMsg, res.assistantMsg]);
      lastSourcesRef.current = res.sources;
      sessionsQuery.refetch();
    } catch {
      setSendError('发送失败,请稍后重试');
    } finally {
      setIsSending(false);
    }
  }, [
    draftInput,
    isSending,
    currentSessionId,
    setCurrentSession,
    setMessages,
    appendMessage,
    setDraftInput,
    sessionsQuery,
  ]);

  const handleQuickPrompt = useCallback(
    (label: string) => {
      setDraftInput(label);
    },
    [setDraftInput],
  );

  if (!open) return null;

  const messages = currentSessionId ? messagesBySession[currentSessionId] ?? [] : [];
  const lastMessage = messages[messages.length - 1];
  const showSourcesForLastAssistant =
    lastMessage?.role === 'assistant' && !isSending && lastSourcesRef.current.length > 0;
  const sourcesForRender: ChatSource[] = showSourcesForLastAssistant
    ? lastSourcesRef.current
    : [];

  return (
    <div
      className="fixed inset-0 z-[150] flex justify-end md:items-end md:justify-end"
      data-testid="web-assistant-drawer"
    >
      {/* backdrop — mobile 全屏 / desktop 半透明浮层 */}
      <button
        type="button"
        aria-label="关闭"
        onClick={closeDrawer}
        className="flex-1 bg-neutral-900/50 dark:bg-neutral-950/70 backdrop-blur-sm"
      />

      {/* drawer body */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI 网页助手"
        className={cn(
          'relative bg-neutral-0 dark:bg-neutral-100 shadow-2xl',
          'flex flex-col overflow-hidden',
          // mobile: 底部抽屉
          'inset-x-0 bottom-0 h-[80vh] rounded-t-xl border-t border-neutral-200',
          // desktop: 浮窗
          'md:inset-auto md:bottom-[80px] md:right-6 md:h-[600px] md:w-[480px] md:rounded-xl md:border',
          'animate-in slide-in-from-bottom md:slide-in-from-bottom duration-200',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 bg-neutral-0 dark:bg-neutral-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white rounded-md shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold truncate">AI 网页助手</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleNewSession}
              aria-label="新对话"
              data-testid="chat-header-new"
              className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-200 transition-colors"
              title="新对话"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="关闭"
              className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — 两栏:desktop 左 session 列表 / mobile 只消息区 */}
        <div className="flex-1 flex min-h-0">
          {/* Session list — desktop 显, mobile 隐 */}
          <aside className="hidden md:flex w-56 shrink-0 border-r border-neutral-200 bg-neutral-50 dark:bg-neutral-100">
            <WebAssistantSessionList
              sessions={sessionsQuery.data ?? []}
              currentSessionId={currentSessionId}
              isLoading={sessionsQuery.isLoading}
              onSelect={handleSelectSession}
              onNew={handleNewSession}
            />
          </aside>

          {/* Messages + Input */}
          <div className="flex-1 flex flex-col min-w-0">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50 dark:bg-neutral-50"
              data-testid="chat-message-list"
            >
              {sessionsQuery.isLoading && !currentSessionId ? (
                <div className="flex flex-col gap-3">
                  <Skeleton variant="text" count={4} />
                </div>
              ) : !currentSessionId ? (
                <div className="h-full flex items-center justify-center py-8">
                  <EmptyState
                    icon={<MessageSquare className="w-6 h-6" />}
                    title="开始一个新对话"
                    description="问我关于 AI Academy 的任何问题"
                    action={
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={handleNewSession}
                        data-testid="chat-empty-cta"
                      >
                        开始一个新对话
                      </Button>
                    }
                  />
                </div>
              ) : messagesQuery.isLoading && messages.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <Skeleton variant="text" count={5} />
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-600 font-medium">
                    问我关于 AI Academy 的任何问题
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {QUICK_PROMPTS.map((q) => {
                      const Icon = q.icon;
                      return (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => handleQuickPrompt(q.label)}
                          data-testid={`chat-quick-${q.label}`}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 text-sm text-left',
                            'rounded-md border border-neutral-200 bg-neutral-0',
                            'hover:border-[#171717] hover:bg-neutral-50',
                            'dark:bg-neutral-100 dark:hover:bg-neutral-200',
                            'transition-colors text-neutral-900',
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{q.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => {
                    const isLastAssistant =
                      m.role === 'assistant' && idx === messages.length - 1;
                    const sources = isLastAssistant ? sourcesForRender : undefined;
                    return (
                      <WebAssistantMessage
                        key={m.id}
                        message={m}
                        sources={sources}
                      />
                    );
                  })}
                  {isSending && (
                    <div
                      className="flex justify-start"
                      data-testid="chat-pending"
                    >
                      <div className="flex flex-col max-w-[85%]">
                        <div className="px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-200 text-neutral-900 rounded-md rounded-bl-sm min-w-[160px]">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-neutral-600">正在思考...</span>
                            <Skeleton variant="text" count={3} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {sendError && (
              <div
                className="px-4 py-2 text-xs text-danger-500 bg-danger-500/10 border-t border-danger-500/20"
                role="alert"
              >
                {sendError}
              </div>
            )}

            <WebAssistantInput
              value={draftInput}
              onChange={setDraftInput}
              onSend={handleSend}
              isSending={isSending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
