import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationService } from '../notification/notification.service';
import { CreateEnterpriseInquiryDto, UpdateInquiryStatusDto } from './enterprise.dto';
export declare class EnterpriseService {
    private readonly prisma;
    private readonly auditLog;
    private readonly notification;
    constructor(prisma: PrismaService, auditLog: AuditLogService, notification: NotificationService);
    create(dto: CreateEnterpriseInquiryDto): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }>;
    findAll(): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }[]>;
    updateStatus(id: string, dto: UpdateInquiryStatusDto): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
