import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiKeyCrypto } from './ai-crypto.util';
import { AuditLogService } from '../audit/audit-log.service';
import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';

export interface AiConfigPublic {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  /** Masked: 末 4 位, e.g. "****abcd". 前端展示用, 不暴露完整 key */
  apiKeyMasked: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAiConfigDto {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
  isActive?: boolean;
}

export interface UserAiConfigPublic {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  apiKeyMasked: string;
}

export const USER_AI_PROVIDERS = ['gemini', 'openai', 'claude', 'openai-compatible', 'ollama'] as const;

function isPrivateIp(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (value === 'localhost' || value.endsWith('.localhost') || value.endsWith('.internal')) return true;
  const version = isIP(value);
  if (version === 4) {
    const [a, b] = value.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (version === 6) {
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') ||
      value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') ||
      (value.startsWith('::ffff:') && isPrivateIp(value.slice('::ffff:'.length)));
  }
  return false;
}

/** Validate user-controlled upstream URLs before the API server connects to them. */
export async function assertSafeAiBaseUrl(provider: string, rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Base URL 格式无效');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new BadRequestException('Base URL 只支持不带账号密码的 HTTP(S) 地址');
  }
  const localOllama = provider === 'ollama' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (!localOllama && parsed.protocol !== 'https:') {
    throw new BadRequestException('云端 AI 服务的 Base URL 必须使用 HTTPS');
  }
  if (isPrivateIp(parsed.hostname) && !localOllama) {
    throw new BadRequestException('Base URL 不允许指向本机或内网地址');
  }
  if (!localOllama) {
    try {
      const addresses = await dns.lookup(parsed.hostname, { all: true });
      if (addresses.some(({ address }) => isPrivateIp(address))) {
        throw new BadRequestException('Base URL 不允许解析到本机或内网地址');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Base URL 主机无法解析');
    }
  }
  return parsed.toString().replace(/\/$/, '');
}

@Injectable()
export class AiConfigService implements OnModuleInit {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AiKeyCrypto,
    private readonly auditLog: AuditLogService,
  ) {}

  onModuleInit() {
    const err = this.crypto.checkReady();
    if (err) {
      // fail-closed: 启动时打 warning, 提醒运维补 env. 已有 .env GEMINI_API_KEY 仍能 fallback.
      this.logger.warn(`AI key 加密未就绪: ${err}. admin 修改 AI key 端点将 503.`);
    }
  }

  private mask(plain: string | null): string {
    if (!plain) return '';
    if (plain.length <= 4) return '****';
    return '****' + plain.slice(-4);
  }

  private async toPublic(row: any): Promise<AiConfigPublic> {
    const plain = this.crypto.decrypt(row.apiKeyEnc);
    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      isActive: row.isActive,
      apiKeyMasked: this.mask(plain),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  async list(): Promise<AiConfigPublic[]> {
    const rows = await this.prisma.aiConfig.findMany({ orderBy: { provider: 'asc' } });
    return Promise.all(rows.map((r) => this.toPublic(r)));
  }

  async getActive(provider: string): Promise<{ apiKey: string; model: string; baseUrl: string | null } | null> {
    const row = await this.prisma.aiConfig.findFirst({
      where: { provider, isActive: true },
    });
    if (!row) return null;
    const apiKey = this.crypto.decrypt(row.apiKeyEnc);
    if (!apiKey) {
      this.logger.error(`AI config ${provider} 解密失败(密钥轮换?)`);
      return null;
    }
    return { apiKey, model: row.model, baseUrl: row.baseUrl };
  }

  /**
   * upsert 配置: provider 已存在则覆盖, 否则新建.
   * 触发 audit log.
   */
  async upsert(dto: UpdateAiConfigDto): Promise<AiConfigPublic> {
    const err = this.crypto.checkReady();
    if (err) {
      throw new BadRequestException(`AI key 加密未就绪: ${err}`);
    }
    if (!dto.apiKey || dto.apiKey.trim().length < 8) {
      throw new BadRequestException('apiKey 长度至少 8 字符');
    }
    if (!/^(gemini|openai|claude)$/.test(dto.provider)) {
      throw new BadRequestException(`provider 必须是 gemini | openai | claude, 收到: ${dto.provider}`);
    }
    if (!dto.model || dto.model.trim().length === 0) {
      throw new BadRequestException('model 不能为空');
    }

    const apiKeyEnc = this.crypto.encrypt(dto.apiKey);
    const row = await this.prisma.aiConfig.upsert({
      where: { provider: dto.provider },
      create: {
        provider: dto.provider,
        apiKeyEnc,
        model: dto.model,
        baseUrl: dto.baseUrl ?? null,
        isActive: dto.isActive ?? true,
      },
      update: {
        apiKeyEnc,
        model: dto.model,
        baseUrl: dto.baseUrl ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLog.log({
      action: 'AI_CONFIG_UPSERT',
      entity: 'ai_config',
      entityId: row.id,
      details: { provider: row.provider, model: row.model },
    });

    return this.toPublic(row);
  }

  async remove(provider: string): Promise<{ message: string }> {
    const row = await this.prisma.aiConfig.findUnique({ where: { provider } });
    if (!row) return { message: 'No-op' };
    await this.prisma.aiConfig.delete({ where: { provider } });
    await this.auditLog.log({
      action: 'AI_CONFIG_DELETE',
      entity: 'ai_config',
      entityId: row.id,
      details: { provider },
    });
    return { message: `Deleted ${provider}` };
  }

  async listForUser(userId: string): Promise<UserAiConfigPublic[]> {
    const rows = await this.prisma.userAiProviderConfig.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      isActive: row.isActive,
      apiKeyMasked: this.mask(this.crypto.decrypt(row.apiKeyEnc)),
    }));
  }

  async upsertForUser(userId: string, dto: UpdateAiConfigDto): Promise<UserAiConfigPublic> {
    if (!USER_AI_PROVIDERS.includes(dto.provider as (typeof USER_AI_PROVIDERS)[number])) {
      throw new BadRequestException(`不支持的 AI 接入方式: ${dto.provider}`);
    }
    if (dto.provider !== 'ollama' && (!dto.apiKey || dto.apiKey.trim().length < 8)) {
      throw new BadRequestException('API Key 至少需要 8 个字符');
    }
    if (!dto.model?.trim()) throw new BadRequestException('模型名称不能为空');
    const baseUrl = dto.baseUrl?.trim() ? await assertSafeAiBaseUrl(dto.provider, dto.baseUrl.trim()) : null;
    const row = await this.prisma.userAiProviderConfig.upsert({
      where: { userId_provider: { userId, provider: dto.provider } },
      create: {
        userId,
        provider: dto.provider,
        apiKeyEnc: this.crypto.encrypt(dto.apiKey?.trim() ?? ''),
        model: dto.model.trim(),
        baseUrl,
        isActive: dto.isActive ?? true,
      },
      update: {
        ...(dto.apiKey?.trim() ? { apiKeyEnc: this.crypto.encrypt(dto.apiKey.trim()) } : {}),
        model: dto.model.trim(),
        baseUrl,
        isActive: dto.isActive ?? true,
      },
    });
    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      isActive: row.isActive,
      apiKeyMasked: this.mask(this.crypto.decrypt(row.apiKeyEnc)),
    };
  }

  async removeForUser(userId: string, provider: string): Promise<void> {
    await this.prisma.userAiProviderConfig.deleteMany({ where: { userId, provider } });
  }

  async getUserActive(userId: string) {
    const row = await this.prisma.userAiProviderConfig.findFirst({ where: { userId, isActive: true } });
    if (!row) return null;
    return { provider: row.provider, apiKey: this.crypto.decrypt(row.apiKeyEnc), model: row.model, baseUrl: row.baseUrl };
  }
}
