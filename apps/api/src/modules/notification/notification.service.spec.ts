import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService, NOTIFICATION_TYPES } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock PrismaService. notification.service uses:
//   - notification.findMany / findFirst / count / create / update / updateMany
const mockPrisma: any = {
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockConfig: any = {
  get: jest.fn((key: string) => {
    if (key === 'EMAIL_PROVIDER') return 'console';
    if (key === 'ENTERPRISE_NOTIFY_EMAIL') return 'contact@ai-academy.local';
    return undefined;
  }),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.notification.findMany.mockReset();
    mockPrisma.notification.findFirst.mockReset();
    mockPrisma.notification.count.mockReset();
    mockPrisma.notification.create.mockReset();
    mockPrisma.notification.update.mockReset();
    mockPrisma.notification.updateMany.mockReset();
    mockConfig.get.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    it('应分页返回通知 + 未读数 + 总数', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ]);
      // total = unread match filter, unreadCount = total unread for badge
      mockPrisma.notification.count
        .mockResolvedValueOnce(1) // total (with filter)
        .mockResolvedValueOnce(3); // unreadCount (bell badge)

      const result = await service.list('u1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(3);
      expect(result.hasMore).toBe(false);
      // 软删过滤必须带上
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'u1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('应支持 unreadOnly 过滤', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await service.list('u1', { unreadOnly: true });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u1', isRead: false }),
        }),
      );
    });

    it('应支持 type 过滤 (除 all 外)', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await service.list('u1', { type: 'comment' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'comment' }),
        }),
      );
    });

    it('type=all 应不附加 type 条件', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await service.list('u1', { type: 'all' });

      const call = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('type');
    });

    it('limit 应被 clamp 到 [1, 100], page < 1 视为 1', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const result = await service.list('u1', { page: -5, limit: 9999 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
    });
  });

  // ============================================================
  // unreadCount
  // ============================================================
  describe('unreadCount', () => {
    it('应返回 isRead=false + deletedAt=null 计数', async () => {
      mockPrisma.notification.count.mockResolvedValue(7);

      const result = await service.unreadCount('u1');

      expect(result).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: false, deletedAt: null },
      });
    });
  });

  // ============================================================
  // markRead
  // ============================================================
  describe('markRead', () => {
    it('未读记录应标已读 + 返 true', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'n1',
        isRead: false,
      });
      mockPrisma.notification.update.mockResolvedValue({ id: 'n1', isRead: true });

      const result = await service.markRead('u1', 'n1');

      expect(result).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      });
    });

    it('已是已读应返 true 幂等, 不再 update', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'n1',
        isRead: true,
      });

      const result = await service.markRead('u1', 'n1');

      expect(result).toBe(true);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('记录不存在 / 软删 / 跨用户 都应返 false', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const result = await service.markRead('u1', 'n-bad');

      expect(result).toBe(false);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // markAllRead
  // ============================================================
  describe('markAllRead', () => {
    it('应批量标已读, 返受影响条数', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('u1');

      expect(result).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: false, deletedAt: null },
        data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      });
    });
  });

  // ============================================================
  // softDelete
  // ============================================================
  describe('softDelete', () => {
    it('单条应软删 (设 deletedAt)', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      mockPrisma.notification.update.mockResolvedValue({ id: 'n1', deletedAt: new Date() });

      const result = await service.softDelete('u1', 'n1');

      expect(result).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('不存在应返 false', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const result = await service.softDelete('u1', 'n-missing');

      expect(result).toBe(false);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // clearRead
  // ============================================================
  describe('clearRead', () => {
    it('应批量软删 isRead=true 的记录, 返条数', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.clearRead('u1');

      expect(result).toBe(3);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: true, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('应写入单条通知 (4 类合法 type)', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'n-new' });

      const result = await service.create({
        userId: 'u1',
        type: 'announcement',
        title: '系统升级',
        body: '本系统将于 8 月 1 日 0 点升级',
        linkUrl: 'https://example.com/ann/1',
      });

      expect(result).toEqual({ id: 'n-new' });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'announcement',
          title: '系统升级',
          body: '本系统将于 8 月 1 日 0 点升级',
          linkUrl: 'https://example.com/ann/1',
        },
        select: { id: true },
      });
    });

    it('非法 type 应兜底为 announcement', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'n-fb' });

      // source 声明 type: NotificationType | string, 故意传非 enum 值测兜底
      await service.create({
        userId: 'u1',
        type: 'something-invalid' as any,
        title: 't',
        body: 'b',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'announcement' }),
        }),
      );
    });

    it('linkUrl 缺省应存 null', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'n-null-link' });

      await service.create({
        userId: 'u1',
        type: 'comment',
        title: '有人 @ 你',
        body: 'b',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ linkUrl: null }),
        }),
      );
    });

    it('NOTIFICATION_TYPES 应为 4 个固定值', () => {
      // 防御: 升级 enum 时如果改动, 显式断一下
      expect([...NOTIFICATION_TYPES].sort()).toEqual(
        ['announcement', 'comment', 'hackathon', 'order'].sort(),
      );
    });
  });
});
