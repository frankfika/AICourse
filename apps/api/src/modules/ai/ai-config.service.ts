import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiKeyCrypto } from './ai-crypto.util';
import { AuditLogService } from '../audit/audit-log.service';

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
}
