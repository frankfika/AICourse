import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
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
  },
  degreeCourse: {
    findMany: jest.fn(),
  },
};
// $transaction receives a callback; run it against the same mockPrisma so
// conditional updateMany / upsert flows can be exercised.
mockPrisma.$transaction = jest.fn(async (cb: (tx: any) => any) => cb(mockPrisma));

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
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
});
