import { BadRequestException } from '@nestjs/common';
import { AiConfigService, assertSafeAiBaseUrl } from './ai-config.service';

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

describe('AiConfigService platform configuration', () => {
  const row = {
    id: 'cfg-1',
    provider: 'company-gateway',
    apiKeyEnc: 'encrypted',
    model: 'company-model',
    baseUrl: 'https://example.com/v1',
    isActive: true,
    verifiedAt: null,
    lastVerifyError: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const prisma: any = {
    aiConfig: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const crypto: any = {
    checkReady: jest.fn(() => null),
    encrypt: jest.fn(() => 'encrypted'),
    decrypt: jest.fn(() => 'plain-admin-key'),
  };
  const auditLog: any = { log: jest.fn() };
  let service: AiConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiConfigService(prisma, crypto, auditLog);
  });

  it('only returns an active configuration after Verify succeeded', async () => {
    prisma.aiConfig.findFirst.mockResolvedValue({ ...row, verifiedAt: new Date() });
    await expect(service.getActiveGlobal()).resolves.toMatchObject({
      provider: 'company-gateway',
      apiKey: 'plain-admin-key',
    });
    expect(prisma.aiConfig.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, verifiedAt: { not: null } },
    }));
  });

  it('accepts an arbitrary OpenAI-compatible provider and resets verification on save', async () => {
    prisma.aiConfig.findUnique.mockResolvedValue(null);
    prisma.aiConfig.upsert.mockResolvedValue(row);
    prisma.aiConfig.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockResolvedValue([{ count: 0 }, row]);

    await service.upsert({
      provider: 'company-gateway',
      apiKey: 'plain-admin-key',
      model: 'company-model',
      baseUrl: 'https://example.com/v1',
      isActive: true,
    });

    expect(prisma.aiConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        provider: 'company-gateway',
        verifiedAt: null,
        lastVerifyError: null,
      }),
    }));
    expect(prisma.aiConfig.updateMany).toHaveBeenCalledWith({
      where: { provider: { not: 'company-gateway' }, isActive: true },
      data: { isActive: false },
    });
  });
});
