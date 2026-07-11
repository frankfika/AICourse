import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationService } from '../notification/notification.service';
import { CreateEnterpriseInquiryDto, UpdateInquiryStatusDto } from './enterprise.dto';

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notification: NotificationService,
  ) {}

  async create(dto: CreateEnterpriseInquiryDto) {
    const inquiry = await this.prisma.enterpriseInquiry.create({
      data: dto,
    });

    await this.auditLog.log({
      action: 'ENTERPRISE_INQUIRY_CREATE',
      entity: 'enterprise_inquiry',
      entityId: inquiry.id,
      details: { company: dto.company, topic: dto.topic },
    });

    // 发送通知（console / SendGrid / SES）
    await this.notification.sendEnterpriseInquiryNotification(dto);

    return inquiry;
  }

  async findAll() {
    return this.prisma.enterpriseInquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateInquiryStatusDto) {
    const existing = await this.prisma.enterpriseInquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Inquiry not found');

    const updated = await this.prisma.enterpriseInquiry.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditLog.log({
      action: 'ENTERPRISE_INQUIRY_STATUS_UPDATE',
      entity: 'enterprise_inquiry',
      entityId: id,
      details: { from: existing.status, to: dto.status },
    });

    return updated;
  }

  async delete(id: string) {
    await this.prisma.enterpriseInquiry.delete({ where: { id } });
    await this.auditLog.log({
      action: 'ENTERPRISE_INQUIRY_DELETE',
      entity: 'enterprise_inquiry',
      entityId: id,
    });
    return { message: 'Inquiry deleted' };
  }
}
