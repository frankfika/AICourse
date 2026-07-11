import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EnterpriseService } from './enterprise.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationService } from '../notification/notification.service';

const mockPrisma = {
  enterpriseInquiry: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuditLog = {
  log: jest.fn(),
};

const mockNotification = {
  sendEnterpriseInquiryNotification: jest.fn(),
};

describe('EnterpriseService', () => {
  let service: EnterpriseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<EnterpriseService>(EnterpriseService);
  });

  describe('create', () => {
    it('should create an inquiry, log audit, and send notification', async () => {
      const dto = {
        name: '张明',
        email: 'zhang@example.com',
        company: '字节跳动',
        teamSize: '51-200',
        topic: 'LLM 应用开发培训',
      };
      mockPrisma.enterpriseInquiry.create.mockResolvedValue({ id: 'inq1', ...dto, status: 'pending' });
      mockAuditLog.log.mockResolvedValue(undefined);
      mockNotification.sendEnterpriseInquiryNotification.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toMatchObject({ id: 'inq1', ...dto, status: 'pending' });
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        action: 'ENTERPRISE_INQUIRY_CREATE',
        entity: 'enterprise_inquiry',
        entityId: 'inq1',
        details: { company: '字节跳动', topic: 'LLM 应用开发培训' },
      });
      expect(mockNotification.sendEnterpriseInquiryNotification).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all inquiries ordered by createdAt desc', async () => {
      const inquiries = [
        { id: 'inq1', name: '张明', company: '字节', status: 'pending' },
        { id: 'inq2', name: '李婷', company: '腾讯', status: 'contacted' },
      ];
      mockPrisma.enterpriseInquiry.findMany.mockResolvedValue(inquiries);

      const result = await service.findAll();

      expect(result).toEqual(inquiries);
      expect(mockPrisma.enterpriseInquiry.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status and log audit', async () => {
      mockPrisma.enterpriseInquiry.findUnique.mockResolvedValue({
        id: 'inq1',
        status: 'pending',
      });
      mockPrisma.enterpriseInquiry.update.mockResolvedValue({
        id: 'inq1',
        status: 'contacted',
      });
      mockAuditLog.log.mockResolvedValue(undefined);

      const result = await service.updateStatus('inq1', { status: 'contacted' });

      expect(result.status).toBe('contacted');
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        action: 'ENTERPRISE_INQUIRY_STATUS_UPDATE',
        entity: 'enterprise_inquiry',
        entityId: 'inq1',
        details: { from: 'pending', to: 'contacted' },
      });
    });

    it('should throw NotFoundException if inquiry not found', async () => {
      mockPrisma.enterpriseInquiry.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('invalid', { status: 'contacted' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete and log audit', async () => {
      mockPrisma.enterpriseInquiry.delete.mockResolvedValue({ id: 'inq1' });
      mockAuditLog.log.mockResolvedValue(undefined);

      await service.delete('inq1');

      expect(mockPrisma.enterpriseInquiry.delete).toHaveBeenCalledWith({ where: { id: 'inq1' } });
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        action: 'ENTERPRISE_INQUIRY_DELETE',
        entity: 'enterprise_inquiry',
        entityId: 'inq1',
      });
    });
  });
});
