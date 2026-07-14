import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { AuditLogService } from '../audit/audit-log.service';
import { OrderType, OrderStatus, CostType } from '@prisma/client';

// Mock PrismaService
const mockPrisma: any = {
  course: {
    findUnique: jest.fn(),
  },
  nanoDegree: {
    findUnique: jest.fn(),
  },
  enrollment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  degreeCourse: {
    findMany: jest.fn(),
  },
};
// $transaction receives a callback; run it against the same mockPrisma so
// conditional updateMany / upsert flows can be exercised.
mockPrisma.$transaction = jest.fn(async (cb: (tx: any) => any) => cb(mockPrisma));

const mockCertificatesService: any = {
  issueCertificate: jest.fn().mockResolvedValue({ id: 'cert-1' }),
};

const mockAuditLog: any = {
  log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset all mock implementations AND once-queues so tests don't leak state.
    mockPrisma.order.findUnique.mockReset();
    mockPrisma.order.create.mockReset();
    mockPrisma.order.update.mockReset();
    mockPrisma.order.updateMany.mockReset();
    mockPrisma.order.findMany.mockReset();
    mockPrisma.course.findUnique.mockReset();
    mockPrisma.nanoDegree.findUnique.mockReset();
    mockPrisma.enrollment.findUnique.mockReset();
    mockPrisma.enrollment.create.mockReset();
    mockPrisma.enrollment.upsert.mockReset();
    mockPrisma.degreeCourse.findMany.mockReset();
    mockCertificatesService.issueCertificate.mockClear();
    mockAuditLog.log.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CertificatesService, useValue: mockCertificatesService },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createOrder — free course (auto-enroll)', () => {
    it('should auto-enroll for free course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        id: 'c1',
        costType: CostType.free,
        price: 0,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.enrollment.create.mockResolvedValue({ id: 'e1', userId: 'u1', courseId: 'c1' });

      const result = await service.createOrder('u1', {
        type: OrderType.course,
        courseId: 'c1',
      });

      expect(result.enrolled).toBe(true);
      expect(mockPrisma.enrollment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', courseId: 'c1', source: 'direct' }),
      });
    });

    it('should throw ConflictException if already enrolled', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        id: 'c1',
        costType: CostType.free,
        price: 0,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });

      await expect(
        service.createOrder('u1', { type: OrderType.course, courseId: 'c1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('u1', { type: OrderType.course, courseId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if courseId missing for course order', async () => {
      await expect(
        service.createOrder('u1', { type: OrderType.course }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createOrder — paid course (create order)', () => {
    it('should create pending order for paid course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        id: 'c1',
        costType: CostType.paid,
        price: 199,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.order.create.mockResolvedValue({ id: 'o1', amount: 199, status: OrderStatus.pending });

      const result = await service.createOrder('u1', {
        type: OrderType.course,
        courseId: 'c1',
      });

      expect(result.enrolled).toBe(false);
      expect(result.order).toMatchObject({ id: 'o1', amount: 199, status: OrderStatus.pending });
      expect(mockAuditLog.log).toHaveBeenCalled();
    });
  });

  describe('mockPay', () => {
    it('should mark order as paid and create enrollment', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o1',
          userId: 'u1',
          type: OrderType.course,
          courseId: 'c1',
          status: OrderStatus.pending,
          paymentMethod: null,
        })
        .mockResolvedValueOnce({
          id: 'o1',
          status: OrderStatus.paid,
        });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.enrollment.upsert.mockResolvedValue({ id: 'e1' });

      const result = await service.mockPay('u1', 'o1', 'alipay');

      expect(result!.status).toBe(OrderStatus.paid);
      expect(mockPrisma.enrollment.upsert).toHaveBeenCalled();
    });

    it('should trigger certificate issuance for degree orders', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o1',
          userId: 'u1',
          type: OrderType.degree,
          degreeId: 'd1',
          status: OrderStatus.pending,
          paymentMethod: null,
        })
        .mockResolvedValueOnce({
          id: 'o1',
          userId: 'u1',
          type: OrderType.degree,
          degreeId: 'd1',
          status: OrderStatus.paid,
        });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.enrollment.upsert.mockResolvedValue({ id: 'e1' });
      mockPrisma.degreeCourse.findMany.mockResolvedValue([]);
      mockPrisma.nanoDegree.findUnique.mockResolvedValue({ id: 'd1', title: 'AI 工程师基础' });

      // wait for async issueCertificate to fire
      await service.mockPay('u1', 'o1', 'alipay');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockCertificatesService.issueCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'degree',
          refId: 'd1',
        }),
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.mockPay('u1', 'invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'other-user', status: OrderStatus.pending });

      await expect(service.mockPay('u1', 'o1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.paid,
      });

      await expect(service.mockPay('u1', 'o1')).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel pending order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.pending,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.expired,
      });

      const result = await service.cancel('u1', 'o1');
      expect(result.status).toBe(OrderStatus.expired);
    });

    it('should throw BadRequestException for paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.paid,
      });

      await expect(service.cancel('u1', 'o1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundOrder', () => {
    it('should refund a paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.paid,
      });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.refunded });

      const result = await service.refundOrder('u1', 'o1');
      expect(result.status).toBe(OrderStatus.refunded);
    });

    it('should throw BadRequestException for non-paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.pending,
      });

      await expect(service.refundOrder('u1', 'o1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOrderById', () => {
    it('should return order with full course/degree include', async () => {
      const fullOrder = {
        id: 'o1',
        userId: 'u1',
        type: OrderType.course,
        courseId: 'c1',
        status: OrderStatus.paid,
        course: { id: 'c1', title: 'C1', thumbnail: null, level: 'Beginner', costType: 'paid', price: 199 },
      };
      mockPrisma.order.findUnique.mockResolvedValue(fullOrder);

      const result = await service.findOrderById('u1', 'o1');
      expect(result).toMatchObject({ id: 'o1', userId: 'u1' });
    });

    it('should throw NotFoundException if not owner (anti-enumeration)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'other' });
      await expect(service.findOrderById('u1', 'o1')).rejects.toThrow(NotFoundException);
    });
  });
});
