/**
 * chatApi — 网页小助手后端客户端
 *
 * 端点: /api/v1/chat/*
 * - 与 admin 智能填充 aiApi 共享 axios 实例(api),但路由 / URL 隔离。
 * - 用途: 全站 FAB 触发的 floating chat drawer,跟 dashboard/learning
 *   课程内小助手互不干扰(那个走前端 mock,见 DashboardPage.tsx)。
 */
import api from './api';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSource {
  // P1 (verifier audit 2026-07-24): 后端 prompt + extractSources 允许 'site',
  // 之前前端 type union 缺 'site' → WebAssistantMessage.tsx TYPE_META Record
  // 拿不到 meta, meta.icon 抛 undefined → React 崩. 加上对齐.
  type: 'course' | 'degree' | 'hackathon' | 'site';
  id: string;
  title: string;
  url: string;
}

export interface SendMessageResponse {
  userMsg: ChatMessage;
  assistantMsg: ChatMessage;
  sources: ChatSource[];
}

export const chatApi = {
  async listSessions(): Promise<ChatSession[]> {
    // 后端 controller 直接返 SessionSummary[] (裸 array), 不包 { sessions: [...] }
    const { data } = await api.get<ChatSession[]>('/api/v1/chat/sessions');
    return data;
  },

  async createSession(title?: string): Promise<{ sessionId: string; title: string | null }> {
    const { data } = await api.post<{ sessionId: string; title: string | null }>(
      '/api/v1/chat/sessions',
      title ? { title } : {},
    );
    return data;
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    // 后端 controller 直接返 MessageView[] (裸 array), 不包 { messages: [...] }
    const { data } = await api.get<ChatMessage[]>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
    );
    return data;
  },

  async sendMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
    const { data } = await api.post<SendMessageResponse>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
      { content },
    );
    return data;
  },

  async deleteSession(sessionId: string): Promise<void> {
    await api.delete(`/api/v1/chat/sessions/${sessionId}`);
  },
};

export default chatApi;
