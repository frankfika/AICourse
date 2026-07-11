import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderType, OrderStatus, CostType } from '@prisma/client';
import { CreateOrderDto } from './orders.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true, thumbnail: true } },
        degree: { select: { id: true, title: true, thumbnail: true } },
      },
    });
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    let amount = 0;
    let costType: CostType;

    if (dto.type === OrderType.course) {
      if (!dto.courseId) throw new BadRequestException('courseId required');
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course) throw new NotFoundException('Course not found');
      costType = course.costType;

      // 已注册就直接返回
      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: dto.courseId } },
      });
      if (existing) throw new ConflictException('Already enrolled');

      if (costType === CostType.free) {
        // 免费课程直接注册
        const enrollment = await this.prisma.enrollment.create({
          data: { userId, courseId: dto.courseId, source: 'direct' },
        });
        return { enrolled: true, enrollment };
      }

      amount = Number(course.price);
    } else if (dto.type === OrderType.degree) {
      if (!dto.degreeId) throw new BadRequestException('degreeId required');
      const degree = await this.prisma.nanoDegree.findUnique({
        where: { id: dto.degreeId },
      });
      if (!degree) throw new NotFoundException('Degree not found');
      costType = degree.costType;

      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_degreeId: { userId, degreeId: dto.degreeId } },
      });
      if (existing) throw new ConflictException('Already enrolled');

      if (costType === CostType.free) {
        const enrollment = await this.prisma.enrollment.create({
          data: { userId, degreeId: dto.degreeId, source: 'direct' },
        });
        // 报名学位同步报名底下所有课程
        await this.enrollAllDegreeCourses(userId, dto.degreeId);
        return { enrolled: true, enrollment };
      }

      amount = Number(degree.price);
    } else {
      throw new BadRequestException('Invalid order type');
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: dto.type,
        courseId: dto.courseId,
        degreeId: dto.degreeId,
        amount,
        currency: 'CNY',
        paymentMethod: dto.paymentMethod ?? null,
        status: OrderStatus.pending,
      },
      include: {
        course: { select: { id: true, title: true, thumbnail: true } },
        degree: { select: { id: true, title: true, thumbnail: true } },
      },
    });

    return { enrolled: false, order };
  }

  /**
   * Mock 支付：直接标记 paid 并创建 enrollment。
   * 真实接入时改为异步回调。
   */
  async mockPay(userId: string, orderId: string, paymentMethod?: string) {
    // Security: lock the order row first to fail fast on auth/status checks
    // without entering a transaction. The real write below is conditional
    // and atomic (updateMany with status guard + transaction).
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Order not found');
    if (existing.userId !== userId) throw new BadRequestException('Not your order');
    if (existing.status === OrderStatus.paid) {
      throw new ConflictException('Order already paid');
    }
    if (existing.status === OrderStatus.expired || existing.status === OrderStatus.refunded) {
      throw new BadRequestException('Order is no longer payable');
    }

    const transactionId = `mock_${this.randomTransactionId()}`;

    const paidOrder = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional update: only flip from pending → paid. Two
      // concurrent pay requests cannot both succeed.
      const updateResult = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.pending },
        data: {
          status: OrderStatus.paid,
          paidAt: new Date(),
          paymentMethod: paymentMethod ?? existing.paymentMethod ?? 'mock',
          transactionId,
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictException('Order already processed');
      }

      if (existing.type === OrderType.course && existing.courseId) {
        await tx.enrollment.upsert({
          where: {
            userId_courseId: {
              userId,
              courseId: existing.courseId,
            },
          },
          update: {},
          create: { userId, courseId: existing.courseId, source: 'order' },
        });
      } else if (existing.type === OrderType.degree && existing.degreeId) {
        await tx.enrollment.upsert({
          where: {
            userId_degreeId: {
              userId,
              degreeId: existing.degreeId,
            },
          },
          update: {},
          create: { userId, degreeId: existing.degreeId, source: 'order' },
        });
        await this.enrollAllDegreeCoursesTx(tx, userId, existing.degreeId);
      }

      return tx.order.findUnique({ where: { id: orderId } });
    });

    return paidOrder;
  }

  private randomTransactionId(): string {
    // Security: replace Date.now() in transaction IDs with a random component
    // so they cannot be guessed / replayed.
    const { randomBytes } = require('crypto') as typeof import('crypto');
    return randomBytes(8).toString('hex');
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new BadRequestException('Not your order');
    if (order.status === OrderStatus.paid) {
      throw new BadRequestException('Paid order cannot be cancelled');
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.expired },
    });
  }

  private async enrollAllDegreeCourses(userId: string, degreeId: string) {
    const links = await this.prisma.degreeCourse.findMany({
      where: { degreeId },
      select: { courseId: true },
    });
    for (const link of links) {
      await this.prisma.enrollment.upsert({
        where: {
          userId_courseId: { userId, courseId: link.courseId },
        },
        update: {},
        create: { userId, courseId: link.courseId, source: 'order' },
      });
    }
  }

  // Transaction-bound variant of enrollAllDegreeCourses for atomic pay flow.
  private async enrollAllDegreeCoursesTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    degreeId: string,
  ) {
    const links = await tx.degreeCourse.findMany({
      where: { degreeId },
      select: { courseId: true },
    });
    for (const link of links) {
      await tx.enrollment.upsert({
        where: {
          userId_courseId: { userId, courseId: link.courseId },
        },
        update: {},
        create: { userId, courseId: link.courseId, source: 'order' },
      });
    }
  }
}