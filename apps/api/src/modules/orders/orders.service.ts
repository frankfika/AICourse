import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderType, OrderStatus, CostType } from '@prisma/client';
import { CreateOrderDto } from './orders.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CertificatesService))
    private readonly certificatesService: CertificatesService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * 我的订单(返回完整 course/degree 摘要 + items, P1-8 起加大字段)
   */
  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true, level: true, costType: true, price: true },
        },
        degree: {
          select: { id: true, title: true, thumbnail: true, costType: true, price: true },
        },
      },
      // P1-7 防御: max 100, 防 DoS
      take: 100,
    });
  }

  /**
   * 单订单详情, 校验 ownership。
   */
  async findOrderById(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true, level: true, costType: true, price: true },
        },
        degree: {
          select: { id: true, title: true, thumbnail: true, costType: true, price: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) {
      // 防止 ID 枚举, 返 404 而不是 403
      throw new NotFoundException('Order not found');
    }
    return order;
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
        await this.auditLog.log({
          userId,
          action: 'order.create.free_enroll',
          entity: 'Enrollment',
          entityId: enrollment.id,
          details: { type: 'course', courseId: dto.courseId },
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
        await this.auditLog.log({
          userId,
          action: 'order.create.free_enroll',
          entity: 'Enrollment',
          entityId: enrollment.id,
          details: { type: 'degree', degreeId: dto.degreeId },
        });
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

    await this.auditLog.log({
      userId,
      action: 'order.create',
      entity: 'Order',
      entityId: order.id,
      details: { type: dto.type, amount, courseId: dto.courseId, degreeId: dto.degreeId },
    });

    return { enrolled: false, order };
  }

  /**
   * Mock 支付：直接标记 paid 并创建 enrollment。
   * 真实接入时改为异步回调。
   *
   * P1-8 新增: degree 订单支付成功后, 自动签发证书(占位 mock, 实际是
   * "完成 = 自动发证书" 业务规则的简化)。course 订单不在此发,
   * 等 course 完成钩子(P2 接入)。
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
          paymentMethod: (paymentMethod ?? existing.paymentMethod ?? 'mock') as 'wechat' | 'alipay' | 'stripe',
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

    // 事务提交后, 触发 degree 证书签发(异步, 不阻塞 pay 响应)
    if (paidOrder && paidOrder.status === OrderStatus.paid) {
      if (paidOrder.type === OrderType.degree && paidOrder.degreeId) {
        // 异步 issueCertificate: 失败不影响 pay 成功
        this.issueDegreeCertificateAsync(userId, paidOrder.degreeId).catch((err) => {
          this.logger.error(
            `Failed to issue degree certificate for user=${userId} degree=${paidOrder.degreeId}: ${err?.message}`,
          );
        });
      }
      // course 不在此处发: 实际业务是 course 全部 lessons 完成才发, 等 P2 接入
    }

    await this.auditLog.log({
      userId,
      action: 'order.pay',
      entity: 'Order',
      entityId: orderId,
      details: { paymentMethod, transactionId, type: existing.type },
    });

    return paidOrder;
  }

  private async issueDegreeCertificateAsync(userId: string, degreeId: string) {
    const degree = await this.prisma.nanoDegree.findUnique({ where: { id: degreeId } });
    if (!degree) return;
    await this.certificatesService.issueCertificate({
      userId,
      type: 'degree',
      refId: degreeId,
      title: `${degree.title} · 学位证书`,
      description: `恭喜您完成学位项目《${degree.title}》。`,
      completedAt: new Date().toISOString(),
      metadata: { source: 'order.mockPay' },
    });
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
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.expired },
    });
    await this.auditLog.log({
      userId,
      action: 'order.cancel',
      entity: 'Order',
      entityId: orderId,
    });
    return updated;
  }

  /**
   * 申请退款 (P1-8 升级): 落地 USER_MANUAL §12.4 退款规则
   *
   * 规则(分订单类型):
   *   课程订单:
   *     - 未开始(0 ProgressRecord)              → 全额退
   *     - 已开始 < 7 天 + 进度 < 20%            → 95% 退(扣 5% 手续费)
   *     - 其他(已学 / 超 7 天 / 进度 ≥ 20%)    → 不支持
   *   学位订单:
   *     - 所有关联课程都没开始                  → 全额退
   *     - 任一课程已开始                        → 不支持
   *
   * 计算进度:已完成 lesson 数 / 课程总 lesson 数
   *
   * 真实流程在 P1-6 Stripe webhook 接入后改用 async refund。
   */
  async refundOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.paid) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    // 1) 校验规则
    const check = await this.checkRefundEligibility(userId, order);
    if (!check.allowed) {
      throw new BadRequestException(check.reason);
    }

    // 2) 计算退款金额(可能扣 5% 手续费)
    const fullAmount = Number(order.amount);
    const refundAmount = check.feeRate ? fullAmount * (1 - check.feeRate) : fullAmount;

    // 3) mock 改状态 + 写 audit
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.refunded },
    });
    await this.auditLog.log({
      userId,
      action: 'order.refund',
      entity: 'Order',
      entityId: orderId,
      details: {
        reason: 'user_request',
        feeRate: check.feeRate,
        refundAmount,
        originalAmount: fullAmount,
      },
    });
    return { ...updated, refundAmount };
  }

  /**
   * 校验退款资格(纯函数,可在退款按钮 disable 时调用)
   * 返回:
   *   - { allowed: true, feeRate?: 0 | 0.05 }  允许退,feeRate = 0 全退 / 0.05 扣手续费
   *   - { allowed: false, reason: string }     不允许
   */
  private async checkRefundEligibility(
    userId: string,
    order: { type: OrderType; courseId: string | null; degreeId: string | null; paidAt: Date | null },
  ): Promise<{ allowed: true; feeRate?: number } | { allowed: false; reason: string }> {
    // 兜底:没 paidAt 当作"刚支付",从现在算
    const paidAt = order.paidAt ?? new Date();
    const daysSincePaid = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24);

    if (order.type === OrderType.course) {
      if (!order.courseId) {
        return { allowed: false, reason: '订单缺少课程 ID' };
      }
      // 计算课程进度
      const [completed, total] = await Promise.all([
        this.prisma.progressRecord.count({
          where: {
            userId,
            courseId: order.courseId,
            status: 'completed',
          },
        }),
        this.prisma.lesson.count({
          where: { chapter: { courseId: order.courseId } },
        }),
      ]);

      // 规则 1: 未开始
      if (completed === 0) {
        return { allowed: true, feeRate: 0 };
      }
      // 规则 2: 7 天内 + 进度 < 20%
      const progress = total > 0 ? completed / total : 0;
      if (daysSincePaid < 7 && progress < 0.2) {
        return { allowed: true, feeRate: 0.05 };
      }
      // 规则 3: 其他
      if (daysSincePaid >= 7) {
        return { allowed: false, reason: '已超过 7 天退款窗口,无法退款' };
      }
      return { allowed: false, reason: `学习进度 ${(progress * 100).toFixed(0)}% ≥ 20%,无法退款` };
    }

    if (order.type === OrderType.degree) {
      if (!order.degreeId) {
        return { allowed: false, reason: '订单缺少学位 ID' };
      }
      // 规则 4: 所有关联课程都未开始
      const links = await this.prisma.degreeCourse.findMany({
        where: { degreeId: order.degreeId },
        select: { courseId: true },
      });
      const courseIds = links.map((l) => l.courseId);
      if (courseIds.length === 0) {
        return { allowed: true, feeRate: 0 }; // 没关联课程,容许退
      }
      const startedCount = await this.prisma.progressRecord.count({
        where: {
          userId,
          courseId: { in: courseIds },
          status: { in: ['in_progress', 'completed'] },
        },
      });
      if (startedCount === 0) {
        return { allowed: true, feeRate: 0 };
      }
      return {
        allowed: false,
        reason: '学位关联课程中已有学习记录,学位不支持退款',
      };
    }

    return { allowed: false, reason: '不支持的订单类型' };
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
