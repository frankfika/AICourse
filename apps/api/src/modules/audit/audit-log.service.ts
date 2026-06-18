import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

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
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  }
}
