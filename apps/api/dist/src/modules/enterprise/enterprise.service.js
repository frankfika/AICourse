"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit/audit-log.service");
const notification_service_1 = require("../notification/notification.service");
let EnterpriseService = class EnterpriseService {
    constructor(prisma, auditLog, notification) {
        this.prisma = prisma;
        this.auditLog = auditLog;
        this.notification = notification;
    }
    async create(dto) {
        const inquiry = await this.prisma.enterpriseInquiry.create({
            data: dto,
        });
        await this.auditLog.log({
            action: 'ENTERPRISE_INQUIRY_CREATE',
            entity: 'enterprise_inquiry',
            entityId: inquiry.id,
            details: { company: dto.company, topic: dto.topic },
        });
        await this.notification.sendEnterpriseInquiryNotification(dto);
        return inquiry;
    }
    async findAll() {
        return this.prisma.enterpriseInquiry.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateStatus(id, dto) {
        const existing = await this.prisma.enterpriseInquiry.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Inquiry not found');
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
    async delete(id) {
        await this.prisma.enterpriseInquiry.delete({ where: { id } });
        await this.auditLog.log({
            action: 'ENTERPRISE_INQUIRY_DELETE',
            entity: 'enterprise_inquiry',
            entityId: id,
        });
        return { message: 'Inquiry deleted' };
    }
};
exports.EnterpriseService = EnterpriseService;
exports.EnterpriseService = EnterpriseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        notification_service_1.NotificationService])
], EnterpriseService);
//# sourceMappingURL=enterprise.service.js.map