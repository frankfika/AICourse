import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant, NotesPanel } from './DashboardPage';
import { notesApi } from '../../lib/notesApi';
import { useWebAssistantStore } from '../../stores/webAssistantStore';

vi.mock('../../lib/notesApi', () => ({
  notesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Dashboard 学习组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWebAssistantStore.getState().reset();
  });

  it('AI 助教携带当前课时上下文打开真实 Drawer', () => {
    render(<AiAssistant currentLessonTitle="ReAct 循环" />);

    fireEvent.click(screen.getByRole('button', { name: '打开 AI 助教' }));

    const state = useWebAssistantStore.getState();
    expect(state.open).toBe(true);
    expect(state.draftInput).toContain('ReAct 循环');
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
