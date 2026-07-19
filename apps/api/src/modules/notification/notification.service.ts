import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * NotificationService — P1-7 通知中心
 *
 * 重写自 P0 阶段 enterprise-inquiry email 通知专用,扩展为:
 *  1. CRUD: list / unreadCount / markRead / markAllRead / softDelete
 *  2. 4 类:type = 'announcement' | 'comment' | 'hackathon' | 'order'
 *  3. 触发点钩子:create() 接收 userId,业务侧在 comment/enroll/hackathon-deadline
 *     事件中调用(本任务**不**接入触发点,只暴露 API,P2 接入)
 *  4. 多通道:写库即"站内通知" + 调原有 email provider(P1-7 保留 email 接口,
 *     默认 console 模式不真发,P1-8+ 接 sendgrid)
 *
 * 4 类 (spec §7.2 P1-7):
 *   - announcement: 系统公告 / 课程更新
 *   - comment:      评论 @ 提及 / 讲师回复
 *   - hackathon:    黑客松截止提醒 / 评审结果
 *   - order:        订单支付成功 / 退款
 */
export const NOTIFICATION_TYPES = [
  'announcement',
  'comment',
  'hackathon',
  'order',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string; // string 兜底,后续扩展可走 enum
  title: string;
  body: string;
  linkUrl?: string | null;
}

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string; // 'announcement' | 'comment' | 'hackathon' | 'order' | 'all'
  includeDeleted?: boolean;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // CRUD — 控制器直接调用
  // ============================================================

  /**
   * 列出当前用户通知 + 返回未读数。
   * 软删过滤:默认隐藏 deletedAt 非空的。
   */
  async list(userId: string, q: ListNotificationsQuery = {}) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const unreadOnly = !!q.unreadOnly;

    const where: {
      userId: string;
      isRead?: boolean;
      type?: string;
      deletedAt: null;
    } = { userId, deletedAt: null };
    if (unreadOnly) where.isRead = false;
    if (q.type && q.type !== 'all') where.type = q.type;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
      this.prisma.notification.count({
        where: { userId, isRead: false, deletedAt: null },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total, // 满足当前过滤条件的"未读"总数
      unreadCount, // 站内总未读(bell 角标用)
      hasMore: items.length === limit,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
  }

  /**
   * 标已读。已读/已删 → 返回 false 便于 controller 决定 404/200。
   */
  async markRead(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, isRead: true },
    });
    if (!existing) return false;
    if (existing.isRead) return true; // 幂等

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return true;
  }

  /**
   * 全部标已读。返回受影响条数。
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * 软删单条。
   */
  async softDelete(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return false;
    await this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return true;
  }

  /**
   * 清空已读 — 批量软删所有 isRead=true 的通知。
   */
  async clearRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: true, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  // ============================================================
  // 触发点 — create() 业务侧调用
  // ============================================================

  /**
   * 创建一条站内通知(可选手:同时发邮件)。
   *
   * P1-7 任务要求**不**实现具体触发点(评论@/报名/黑客松截止),但 API
   * 必须先到位,后续 P2 在 comment / enrollment / hackathon service
   * 注入本 service 并调用。
   *
   * TODO(P2 触发点接入):
   *   - comment.service: @-mention 解析 → 通知被 @ 的讲师
   *   - enrollment.service: 新学员报名 → 通知讲师
   *   - hackathon.service: 截止前 24h cron → 通知已报名用户
   */
  async create(input: CreateNotificationInput): Promise<{ id: string }> {
    // 防御:非法 type 兜底(后续扩 enum 可去)
    const safeType = (NOTIFICATION_TYPES as readonly string[]).includes(input.type)
      ? input.type
      : 'announcement';

    const n = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: safeType,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
      },
      select: { id: true },
    });

    // 同时打印日志,生产可换 email provider
    this.logger.log(
      `[Notification] user=${input.userId} type=${safeType} title="${input.title}"`,
    );

    // P1-7 暂不接 email,留 hook 等 P1-8 sendgrid
    // (保留原 enterprise-inquiry 邮件能力在 service 上,本函数只发站内)
    return n;
  }

  // ============================================================
  // 向后兼容:旧 enterprise-inquiry 邮件通道(P0 已用,保留)
  // ============================================================

  private get provider(): string {
    return this.config.get<string>('EMAIL_PROVIDER') ?? 'console';
  }

  async sendEnterpriseInquiryNotification(data: {
    name: string;
    email: string;
    company: string;
    teamSize: string;
    phone?: string;
    topic: string;
    description?: string;
  }) {
    const subject = `【企业咨询】${data.company} - ${data.topic}`;
    const body = this.buildEnterpriseInquiryEmail(data);

    await this.send({
      to: this.config.get<string>('ENTERPRISE_NOTIFY_EMAIL') ?? 'contact@opencsg.com',
      subject,
      body,
    });

    this.logger.log(
      `[Email Notification]\n  To: contact@opencsg.com\n  Subject: ${subject}\n  Body:\n${body}`,
    );
  }

  private buildEnterpriseInquiryEmail(data: {
    name: string;
    email: string;
    company: string;
    teamSize: string;
    phone?: string;
    topic: string;
    description?: string;
  }): string {
    return [
      `【企业咨询报名】`,
      ``,
      `姓名：${data.name}`,
      `邮箱：${data.email}`,
      `公司：${data.company}`,
      `团队规模：${data.teamSize} 人`,
      data.phone ? `电话：${data.phone}` : '',
      ``,
      `培训主题：${data.topic}`,
      data.description ? `\n详细描述：\n${data.description}` : '',
      ``,
      `提交时间：${new Date().toLocaleString('zh-CN')}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async send(opts: { to: string; subject: string; body: string }) {
    switch (this.provider) {
      case 'sendgrid':
        await this.sendViaSendGrid(opts);
        break;
      case 'ses':
        await this.sendViaSes(opts);
        break;
      default:
        // console
        break;
    }
  }

  private async sendViaSendGrid(_opts: { to: string; subject: string; body: string }) {
    this.logger.warn('[sendgrid] stub — P1-8 真实接入');
  }

  private async sendViaSes(_opts: { to: string; subject: string; body: string }) {
    this.logger.warn('[ses] stub — TODO');
  }
}
