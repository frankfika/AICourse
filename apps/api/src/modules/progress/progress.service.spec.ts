/**
 * ProgressService 单测 (2026-07-27)
 *
 * 覆盖:
 *   - completeLesson happy path (新 record + 发积分 + 返回 course progress)
 *   - completeLesson 幂等: 重复 complete 同一 lesson 不双倍发积分
 *   - completeLesson lessonId not found → NotFoundException
 *   - completeLesson 完成最后一课 → courseProgress.percent=100
 *   - getCourseProgress 课程不存在 → NotFoundException
 *   - getCourseProgress 0 lessons 课程 → 0% (不崩)
 *   - getCourseProgress 部分完成 → 正确 percent
 *   - getMyProgress: 返回 max 100 (DoS 防御)
 *   - getLearningStats: 字段完整 + streak 计算
 *   - 跨设备同步: 设备 1 complete → 设备 2 getMyProgress 立刻看到 (同一 DB 视角)
 *
 * 风格: jest mock prisma + points / badges service (参考 orders.service.spec.ts)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { BadgesService } from '../badges/badges.service';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationService } from '../notification/notification.service';

// =================== 桩 ===================

const mockPrisma: any = {
  progressRecord: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  lesson: {
    findUnique: jest.fn(),
  },
  chapter: {},
  course: {
    findUnique: jest.fn(),
  },
  enrollment: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockPointsService: any = {
  // 第一次调返回 transaction (代表发积分成功), 第二次幂等命中返 null
  award: jest.fn(),
};

const mockBadgesService: any = {
  checkAndAward: jest.fn().mockResolvedValue([]),
};
const mockCertificatesService = {
  issueCertificate: jest.fn(),
};
const mockNotificationService = {
  create: jest.fn(),
};

// 工具: 返回 course + chapters + lessons 完整结构
function makeCourse(courseId: string, lessonIds: string[]) {
  return {
    id: courseId,
    title: 'Test Course',
    chapters: lessonIds.map((lid, idx) => ({
      id: `ch${idx}`,
      courseId,
      lessons: [{ id: lid }],
    })),
  };
}

// =================== 测试 ===================

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(mockPrisma).forEach((model: any) => {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach((fn: any) => {
          if (typeof fn?.mockReset === 'function') fn.mockReset();
        });
      }
    });
    mockPointsService.award.mockReset();
    mockBadgesService.checkAndAward.mockReset();
    mockBadgesService.checkAndAward.mockResolvedValue([]);
    mockCertificatesService.issueCertificate.mockReset();
    mockCertificatesService.issueCertificate.mockResolvedValue({ id: 'cert-1' });
    mockNotificationService.create.mockReset();
    mockNotificationService.create.mockResolvedValue({ id: 'notification-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsService, useValue: mockPointsService },
        { provide: BadgesService, useValue: mockBadgesService },
        { provide: CertificatesService, useValue: mockCertificatesService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  // =============================================================
  // completeLesson
  // =============================================================

  describe('completeLesson(userId, lessonId)', () => {
    it('happy path: lesson 存在 + 新 record → upsert + award 10 分 + 返回 course progress', async () => {
      // lesson 含 chapter.courseId
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'l1',
        title: 'L1',
        chapter: { courseId: 'c1', course: { costType: 'free' } },
      });
      // wasAlreadyCompleted 查 → null (首次)
      mockPrisma.progressRecord.findUnique.mockResolvedValueOnce(null);
      // upsert → 新 record
      mockPrisma.progressRecord.upsert.mockResolvedValueOnce({
        id: 'pr1',
        userId: 'u1',
        courseId: 'c1',
        lessonId: 'l1',
        status: 'completed',
        completedAt: new Date(),
      });
      // enrollment upsert
      mockPrisma.enrollment.upsert.mockResolvedValueOnce({ id: 'e1' });
      // 发积分成功
      mockPointsService.award.mockResolvedValueOnce({ id: 'tx1', amount: 10 });
      // 后续 getCourseProgress: 1 课时 1 完成 → 100%
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      const result = await service.completeLesson('u1', 'l1');

      expect(result.pointsAwarded).toBe(10);
      expect(result.courseProgress.percent).toBe(100);
      expect(result.courseProgress.isCompleted).toBe(true);
      // 验证 award 调用 (lesson refType, lessonId refId)
      expect(mockPointsService.award).toHaveBeenCalledWith(
        'u1',
        10,
        expect.stringContaining('L1'),
        'lesson',
        'l1',
      );
      // 验证 enrollment 自动创建
      expect(mockPrisma.enrollment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_courseId: { userId: 'u1', courseId: 'c1' } },
          create: expect.objectContaining({ userId: 'u1', courseId: 'c1', source: 'direct' }),
        }),
      );
      // 验证 badge 检查
      expect(mockBadgesService.checkAndAward).toHaveBeenCalledWith('u1');
      expect(mockCertificatesService.issueCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'course',
          refId: 'c1',
        }),
      );
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'announcement',
          linkUrl: '/certificates/cert-1',
        }),
      );
    });

    it('幂等: 重复 complete 同一 lesson → 不双倍 award, pointsAwarded=0', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'l1',
        title: 'L1',
        chapter: { courseId: 'c1', course: { costType: 'free' } },
      });
      // wasAlreadyCompleted 查 → 已存在且 status=completed
      mockPrisma.progressRecord.findUnique.mockResolvedValueOnce({
        id: 'pr1',
        userId: 'u1',
        courseId: 'c1',
        lessonId: 'l1',
        status: 'completed',
      });
      mockPrisma.enrollment.upsert.mockResolvedValueOnce({ id: 'e1' });
      mockPrisma.progressRecord.upsert.mockResolvedValueOnce({
        id: 'pr1',
        userId: 'u1',
        courseId: 'c1',
        lessonId: 'l1',
        status: 'completed',
      });
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      const result = await service.completeLesson('u1', 'l1');

      // 关键: 幂等场景 pointsAwarded=0, 且 award 完全没调
      expect(result.pointsAwarded).toBe(0);
      expect(mockPointsService.award).not.toHaveBeenCalled();
      // badge check 也不调 (避免重复发徽章)
      expect(mockBadgesService.checkAndAward).not.toHaveBeenCalled();
      // 证书签发自身幂等；重复完成时仍重试，防止首次完成时下游瞬时失败。
      expect(mockCertificatesService.issueCertificate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', refId: 'c1' }),
      );
      expect(mockNotificationService.create).not.toHaveBeenCalled();
      // 但 upsert 还是调了 (更新 completedAt)
      expect(mockPrisma.progressRecord.upsert).toHaveBeenCalled();
    });

    it('wasAlreadyCompleted 存在但 status≠completed → 当首次处理, 发积分', async () => {
      // 边界: user 之前看过但没 mark complete (status=in_progress)
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'l1',
        title: 'L1',
        chapter: { courseId: 'c1', course: { costType: 'free' } },
      });
      mockPrisma.progressRecord.findUnique.mockResolvedValueOnce({
        id: 'pr1',
        userId: 'u1',
        courseId: 'c1',
        lessonId: 'l1',
        status: 'in_progress',
      });
      mockPrisma.enrollment.upsert.mockResolvedValueOnce({ id: 'e1' });
      mockPrisma.progressRecord.upsert.mockResolvedValueOnce({ id: 'pr1' });
      mockPointsService.award.mockResolvedValueOnce({ id: 'tx1' });
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      const result = await service.completeLesson('u1', 'l1');

      expect(result.pointsAwarded).toBe(10);
      expect(mockPointsService.award).toHaveBeenCalled();
    });

    it('lessonId 不存在 → NotFoundException', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce(null);

      await expect(service.completeLesson('u1', 'missing')).rejects.toThrow(NotFoundException);
      // 任何写入都不应发生
      expect(mockPrisma.progressRecord.upsert).not.toHaveBeenCalled();
      expect(mockPointsService.award).not.toHaveBeenCalled();
    });

    it('拒绝未报名用户完成付费课程课时', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'paid-l1',
        title: 'Paid lesson',
        chapter: { courseId: 'paid-c1', course: { costType: 'paid' } },
      });
      mockPrisma.enrollment.findFirst.mockResolvedValueOnce(null);

      await expect(service.completeLesson('u1', 'paid-l1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.progressRecord.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.upsert).not.toHaveBeenCalled();
    });

    it('允许有效报名用户完成付费课程课时', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'paid-l1',
        title: 'Paid lesson',
        chapter: { courseId: 'paid-c1', course: { costType: 'paid' } },
      });
      mockPrisma.enrollment.findFirst.mockResolvedValueOnce({ id: 'e1' });
      mockPrisma.progressRecord.findUnique.mockResolvedValueOnce({ status: 'completed' });
      mockPrisma.progressRecord.upsert.mockResolvedValueOnce({ id: 'pr1', status: 'completed' });
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('paid-c1', ['paid-l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      await expect(service.completeLesson('u1', 'paid-l1')).resolves.toBeDefined();
      expect(mockPrisma.enrollment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', courseId: 'paid-c1', deletedAt: null }),
      }));
    });
  });

  // =============================================================
  // getCourseProgress
  // =============================================================

  describe('getCourseProgress(userId, courseId)', () => {
    it('课程不存在 → NotFoundException', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(null);

      await expect(service.getCourseProgress('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('0 课时课程 → totalLessons=0, percent=0, isCompleted=false (不崩)', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce({
        id: 'c1',
        chapters: [],
      });
      // 注: 即便 totalLessons=0, 仍会调 count (lessonId: { in: [] } → 0)
      mockPrisma.progressRecord.count.mockResolvedValueOnce(0);

      const result = await service.getCourseProgress('u1', 'c1');

      expect(result.totalLessons).toBe(0);
      expect(result.completedLessons).toBe(0);
      expect(result.percent).toBe(0);
      expect(result.isCompleted).toBe(false);
    });

    it('3 课时 1 完成 → 33% (Math.round)', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1', 'l2', 'l3']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      const result = await service.getCourseProgress('u1', 'c1');

      expect(result.totalLessons).toBe(3);
      expect(result.completedLessons).toBe(1);
      expect(result.percent).toBe(33);
      expect(result.isCompleted).toBe(false);
    });

    it('完成最后一课 → isCompleted=true (cross-module trigger: 后续 cert/badges)', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1', 'l2']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(2);

      const result = await service.getCourseProgress('u1', 'c1');

      expect(result.percent).toBe(100);
      expect(result.isCompleted).toBe(true);
    });

    it('完成数 > 总数 (脏数据防御) → isCompleted 仍用 === 严格判等', async () => {
      // 防御: 不会出现, 但验证代码 isCompleted 用 === 不是 >=
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(5);

      const result = await service.getCourseProgress('u1', 'c1');

      // total=1, completed=5 → 实际不可能, 但 code 是 === , 不会 true
      expect(result.isCompleted).toBe(false);
    });
  });

  // =============================================================
  // getMyProgress
  // =============================================================

  describe('getMyProgress(userId)', () => {
    it('返回 progress records (含 lesson info) + max 100 (DoS 防御)', async () => {
      const records = [
        { id: 'pr1', userId: 'u1', lessonId: 'l1', status: 'completed', lesson: { id: 'l1', title: 'L1', chapterId: 'ch1' } },
      ];
      mockPrisma.progressRecord.findMany.mockResolvedValueOnce(records);

      const result = await service.getMyProgress('u1');

      expect(result).toEqual(records);
      // 验证 take=100 (DoS 防御)
      expect(mockPrisma.progressRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // =============================================================
  // getLearningStats
  // =============================================================

  describe('getLearningStats(userId)', () => {
    it('返回 total / week / streak / longestStreak / activity (365 天)', async () => {
      // 简化: 3 个 completed records 都算 today
      const today = new Date();
      mockPrisma.progressRecord.count
        .mockResolvedValueOnce(3) // totalCompleted
        .mockResolvedValueOnce(2); // weekCompleted
      mockPrisma.progressRecord.findMany.mockResolvedValueOnce([
        { completedAt: today },
        { completedAt: today },
        { completedAt: today },
      ]);
      // computeLongestStreak → 内部又 findMany
      mockPrisma.progressRecord.findMany.mockResolvedValueOnce([
        { completedAt: today },
        { completedAt: today },
        { completedAt: today },
      ]);
      // computeStreakDays 内部又 findMany (orderBy: desc)
      mockPrisma.progressRecord.findMany.mockResolvedValueOnce([
        { completedAt: today },
      ]);

      const result = await service.getLearningStats('u1');

      expect(result.totalCompletedLessons).toBe(3);
      expect(result.weekCompletedLessons).toBe(2);
      expect(result.streakDays).toBeGreaterThanOrEqual(1);
      expect(result.activity).toHaveLength(365);
      expect(result.activity[result.activity.length - 1].date).toBe(today.toISOString().slice(0, 10));
    });

    it('0 完成记录 → 全 0 + 空 activity 不崩', async () => {
      mockPrisma.progressRecord.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0); // week
      mockPrisma.progressRecord.findMany
        .mockResolvedValueOnce([]) // activity records
        .mockResolvedValueOnce([]) // longestStreak
        .mockResolvedValueOnce([]); // streakDays

      const result = await service.getLearningStats('u1');

      expect(result.totalCompletedLessons).toBe(0);
      expect(result.weekCompletedLessons).toBe(0);
      expect(result.streakDays).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.activity).toHaveLength(365);
    });
  });

  // =============================================================
  // 跨设备同步 (语义测试, 同一 DB 视角)
  // =============================================================

  describe('跨设备同步 (同 DB 视角)', () => {
    it('设备 1 complete → 设备 2 getMyProgress 立刻看到 (因为共享 prisma mock)', async () => {
      // 设备 1: completeLesson 写 prisma
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({
        id: 'l1',
        title: 'L1',
        chapter: { courseId: 'c1', course: { costType: 'free' } },
      });
      mockPrisma.progressRecord.findUnique.mockResolvedValueOnce(null); // 首次
      mockPrisma.enrollment.upsert.mockResolvedValueOnce({ id: 'e1' });
      mockPrisma.progressRecord.upsert.mockResolvedValueOnce({
        id: 'pr1',
        userId: 'u1',
        courseId: 'c1',
        lessonId: 'l1',
        status: 'completed',
      });
      mockPointsService.award.mockResolvedValueOnce({ id: 'tx1' });
      mockPrisma.course.findUnique.mockResolvedValueOnce(makeCourse('c1', ['l1']));
      mockPrisma.progressRecord.count.mockResolvedValueOnce(1);

      await service.completeLesson('u1', 'l1');

      // 设备 2: getMyProgress → 查 prisma, 看到设备 1 写的 record
      mockPrisma.progressRecord.findMany.mockResolvedValueOnce([
        { id: 'pr1', userId: 'u1', lessonId: 'l1', status: 'completed' },
      ]);

      const result = await service.getMyProgress('u1');

      expect(result).toHaveLength(1);
      expect(result[0].lessonId).toBe('l1');
      expect(result[0].status).toBe('completed');
    });
  });
});
