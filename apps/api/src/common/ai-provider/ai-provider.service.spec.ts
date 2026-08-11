import { ServiceUnavailableException } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';

describe('AiProviderService', () => {
  const aiConfig = {
    getActiveGlobal: jest.fn(),
    getForVerification: jest.fn(),
  };
  let service: AiProviderService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AiProviderService(aiConfig as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('requires a verified active admin configuration', async () => {
    aiConfig.getActiveGlobal.mockResolvedValue(null);
    await expect(service.generateText('hello')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('calls any OpenAI-compatible endpoint with the admin key and model', async () => {
    aiConfig.getActiveGlobal.mockResolvedValue({
      provider: 'deepseek',
      apiKey: 'admin-db-key',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'answer' } }] }),
    } as Response);

    await expect(service.generateText('hello', { maxOutputTokens: 42, temperature: 0.2 })).resolves.toBe('answer');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-db-key' }),
        body: expect.stringContaining('"model":"deepseek-chat"'),
      }),
    );
  });

  it('verifies a newly saved provider before it becomes usable', async () => {
    aiConfig.getForVerification.mockResolvedValue({
      provider: 'custom-gateway',
      apiKey: 'custom-key',
      model: 'company-model',
      baseUrl: 'https://example.com/v1',
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    } as Response);

    await expect(service.verify('custom-gateway')).resolves.toBe('ok');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.any(Object),
    );
  });
});
