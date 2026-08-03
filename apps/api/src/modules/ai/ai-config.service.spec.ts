import { BadRequestException } from '@nestjs/common';
import { assertSafeAiBaseUrl } from './ai-config.service';

describe('assertSafeAiBaseUrl', () => {
  it('rejects non-HTTPS cloud endpoints', async () => {
    await expect(assertSafeAiBaseUrl('openai', 'http://example.com/v1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects private addresses for cloud providers', async () => {
    await expect(assertSafeAiBaseUrl('openai-compatible', 'https://127.0.0.1/v1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(assertSafeAiBaseUrl('openai-compatible', 'https://169.254.169.254/latest')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows the explicitly supported local Ollama endpoint', async () => {
    await expect(assertSafeAiBaseUrl('ollama', 'http://localhost:11434')).resolves.toBe('http://localhost:11434');
  });
});
