import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PII 脱敏 helpers (P0 2026-07-23)
   *
   * - IPv4: 保留前 3 段,末段置 0 (`192.168.1.100` → `192.168.1.0`)。
   *   /24 网络内仍是 PII (RFC 1918 范围内), 实际是 /16 网络内的位置, 远端看只有
   *   "在 /16 哪个 C 类网段" 信息, 不暴露具体设备。
   * - IPv6: 保留前 4 组,后 4 组置 0 (RFC 4291 /48 prefix)。
   * - UA: 取浏览器家族 + OS 家族, 不存完整 UA (完整 UA 含精确版本 + 设备指纹)。
   * - 异常输入: 走 fallback, 不抛 (audit log 写入失败不应阻塞业务请求)。
   */
  static maskIpAddress(ip: string | undefined | null): string | null {
    if (!ip) return null;
    const trimmed = ip.trim();
    if (!trimmed) return null;
    // IPv4
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(trimmed);
    if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`;
    // IPv6: 8 组, 保留前 4
    const v6Parts = trimmed.split(':');
    if (v6Parts.length >= 4) {
      return v6Parts.slice(0, 4).join(':') + '::';
    }
    // 异常格式: 整体截断到 16 字符 + 哈希
    return `unknown:${trimmed.length}`;
  }

  static maskUserAgent(ua: string | undefined | null): string | null {
    if (!ua) return null;
    const trimmed = ua.trim();
    if (!trimmed) return null;
    // 简化: 提取浏览器家族 (括号外首个 token) + 截断到 64 字符
    // 例子: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ..." → "Mozilla/5.0..."
    const firstSlash = trimmed.split('/')[0]?.split(' ')[0] ?? 'unknown';
    const browser = firstSlash.slice(0, 16);
    // 提取 OS 信息 (括号内, 取分号第一段)
    const osMatch = /\(([^)]*)\)/.exec(trimmed);
    const os = osMatch ? osMatch[1].split(';')[0].trim().slice(0, 24) : 'unknown';
    return `${browser} (${os})`.slice(0, 64);
  }

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ...params,
        ipAddress: AuditLogService.maskIpAddress(params.ipAddress),
        userAgent: AuditLogService.maskUserAgent(params.userAgent),
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  }

  /**
   * 列出审计日志(分页)
   * 支持按 userId / entity / action 过滤
   */
  async list(params: {
    userId?: string;
    entity?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: any = {};
    if (params.userId) where.userId = params.userId;
    if (params.entity) where.entity = params.entity;
    if (params.action) where.action = params.action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: data.map((d) => ({
        ...d,
        details: d.details ? JSON.parse(d.details as string) : null,
      })),
      total,
      page,
      limit,
    };
  }
}
