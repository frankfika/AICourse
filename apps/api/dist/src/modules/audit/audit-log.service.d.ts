import { PrismaService } from '../prisma/prisma.service';
export declare class AuditLogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(params: {
        userId?: string;
        action: string;
        entity: string;
        entityId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string | null;
        action: string;
        entity: string;
        entityId: string | null;
        details: string | null;
        ipAddress: string | null;
        userAgent: string | null;
    }>;
}
