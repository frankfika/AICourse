import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/auth/Toast';
import api from '../../lib/api';
import { AdminAiPage } from './AdminAiPage';

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider><AdminAiPage /></ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminAiPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('supports presets and arbitrary OpenAI-compatible configuration', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    mockedApi.put.mockResolvedValue({ data: {} });
    renderPage();

    await screen.findByText(/尚未配置 AI 服务/);
    fireEvent.change(screen.getByLabelText('服务预设'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Provider ID'), { target: { value: 'company-gateway' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'company-model' } });
    fireEvent.change(screen.getByLabelText(/OpenAI-compatible Base URL/), { target: { value: 'https://ai.example.com/v1' } });
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'company-secret-key' } });
    fireEvent.click(screen.getByRole('button', { name: '加密保存' }));

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/api/v1/admin/ai/config',
      expect.objectContaining({
        provider: 'company-gateway',
        model: 'company-model',
        baseUrl: 'https://ai.example.com/v1',
        apiKey: 'company-secret-key',
      }),
    ));
  });

  it('verifies a saved provider from the admin board', async () => {
    mockedApi.get.mockResolvedValue({
      data: [{
        id: 'cfg-1',
        provider: 'deepseek',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        verifiedAt: null,
        lastVerifyError: null,
        apiKeyMasked: '****1234',
      }],
    });
    mockedApi.post.mockResolvedValue({ data: { ok: true, sample: 'ok' } });
    renderPage();

    await screen.findByText('待验证');
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
      '/api/v1/admin/ai/config/deepseek/verify',
    ));
  });
});
