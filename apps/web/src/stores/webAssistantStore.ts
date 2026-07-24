/**
 * webAssistantStore — 网页小助手 zustand
 *
 * 状态:
 *   - open: drawer 是否打开
 *   - currentSessionId: 当前对话 id(关闭 drawer 时保留,下次打开恢复)
 *   - messagesBySession: per-session message 缓存(避免切 session 重拉)
 *   - draftInput: 输入区草稿(关闭 drawer 不丢)
 *
 * 持久化:
 *   - currentSessionId 写到 localStorage('webAssistant.currentSessionId'),
 *     跟 authUser 的策略一致(localStorage 不是敏感字段,只一个 id 字符串)。
 *
 * 跟 authStore 关系:
 *   - 不读 user:点击 FAB 的登录态判断由 Layout / Drawer 各自做(用 useAuthStore)。
 *   - logout 时上层代码 reset() 清空。
 */
import { create } from 'zustand';
import type { ChatMessage } from '../lib/chatApi';

const SESSION_ID_KEY = 'webAssistant.currentSessionId';

function readPersistedSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

function writePersistedSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_ID_KEY, id);
    else localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

interface WebAssistantState {
  open: boolean;
  currentSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  draftInput: string;

  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  setCurrentSession: (id: string | null) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  clearMessages: (sessionId: string) => void;
  setDraftInput: (text: string) => void;

  reset: () => void;
}

export const useWebAssistantStore = create<WebAssistantState>((set) => ({
  open: false,
  currentSessionId: readPersistedSessionId(),
  messagesBySession: {},
  draftInput: '',

  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  toggleDrawer: () => set((s) => ({ open: !s.open })),

  setCurrentSession: (id) => {
    writePersistedSessionId(id);
    set({ currentSessionId: id });
  },

  setMessages: (sessionId, messages) =>
    set((s) => ({
      messagesBySession: { ...s.messagesBySession, [sessionId]: messages },
    })),

  appendMessage: (sessionId, message) =>
    set((s) => {
      const existing = s.messagesBySession[sessionId] ?? [];
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: [...existing, message],
        },
      };
    }),

  clearMessages: (sessionId) =>
    set((s) => {
      const next = { ...s.messagesBySession };
      delete next[sessionId];
      return { messagesBySession: next };
    }),

  setDraftInput: (text) => set({ draftInput: text }),

  reset: () => {
    writePersistedSessionId(null);
    set({
      open: false,
      currentSessionId: null,
      messagesBySession: {},
      draftInput: '',
    });
  },
}));
