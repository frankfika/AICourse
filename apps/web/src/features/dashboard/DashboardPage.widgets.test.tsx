import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant, NotesPanel } from './DashboardPage';
import { notesApi } from '../../lib/notesApi';
import { chatApi } from '../../lib/chatApi';

vi.mock('../../lib/notesApi', () => ({
  notesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../lib/chatApi', () => ({
  chatApi: {
    createSession: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Dashboard 学习组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('课程 RAG 助教在当前面板内发送带课程与课时上下文的问题', async () => {
    vi.mocked(chatApi.createSession).mockResolvedValue({ sessionId: 'session-1', title: '课程 RAG' });
    vi.mocked(chatApi.sendMessage).mockResolvedValue({
      userMsg: { id: 'user-1', role: 'user', content: 'scoped', createdAt: '2026-08-12T00:00:00Z' },
      assistantMsg: { id: 'assistant-1', role: 'assistant', content: 'ReAct 会循环执行思考与行动。', createdAt: '2026-08-12T00:00:01Z' },
      sources: [],
    });
    render(
      <MemoryRouter>
        <AiAssistant
          courseTitle="Agent 工程"
          currentLessonId="lesson-1"
          currentLessonTitle="ReAct 循环"
          resourceCount={2}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '梳理本节 3 个关键点' }));

    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalled());
    expect(vi.mocked(chatApi.sendMessage).mock.calls[0][1]).toContain('Agent 工程');
    expect(vi.mocked(chatApi.sendMessage).mock.calls[0][1]).toContain('ReAct 循环');
    expect(screen.queryByRole('dialog', { name: 'AI 网页助手' })).not.toBeInTheDocument();
    expect(await screen.findByText('ReAct 会循环执行思考与行动。')).toBeInTheDocument();
  });

  it('笔记面板读取并创建带当前时间戳的笔记', async () => {
    vi.mocked(notesApi.list).mockResolvedValue([]);
    vi.mocked(notesApi.create).mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      lessonId: 'lesson-1',
      content: '关键知识点',
      positionSec: 42,
      createdAt: '2026-07-28T00:00:00Z',
      updatedAt: '2026-07-28T00:00:00Z',
    });
    renderWithQuery(<NotesPanel lessonId="lesson-1" positionSec={42} />);

    await screen.findByText('还没有笔记');
    fireEvent.change(screen.getByPlaceholderText(/记录本节重点/), {
      target: { value: '关键知识点' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存笔记' }));

    await waitFor(() =>
      expect(notesApi.create).toHaveBeenCalledWith('lesson-1', {
        content: '关键知识点',
        positionSec: 42,
      }),
    );
  });
});
