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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new BadRequestException('Not your order');
    if (order.status === OrderStatus.paid) {
      throw new ConflictException('Order already paid');
    }
    if (order.status === OrderStatus.expired || order.status === OrderStatus.refunded) {
      throw new BadRequestException('Order is no longer payable');
    }

    const paidOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.paid,
        paidAt: new Date(),
        paymentMethod: paymentMethod ?? order.paymentMethod ?? 'mock',
        transactionId: `mock_${Date.now()}`,
      },
    });

    if (order.type === OrderType.course && order.courseId) {
      await this.prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId,
            courseId: order.courseId,
          },
        },
        update: {},
        create: { userId, courseId: order.courseId, source: 'order' },
      });
    } else if (order.type === OrderType.degree && order.degreeId) {
      await this.prisma.enrollment.upsert({
        where: {
          userId_degreeId: {
            userId,
            degreeId: order.degreeId,
          },
        },
        update: {},
        create: { userId, degreeId: order.degreeId, source: 'order' },
      });
      await this.enrollAllDegreeCourses(userId, order.degreeId);
    }

    return paidOrder;
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
}