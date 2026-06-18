import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { BadgesService } from '../badges/badges.service';
import { ProgressStatus } from '@prisma/client';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly badgesService: BadgesService,
  ) {}

  // ==================== 查询 ====================

  async getMyProgress(userId: string) {
    return this.prisma.progressRecord.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { lesson: { select: { id: true, title: true, chapterId: true } } },
    });
  }

  async getCourseProgress(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          include: {
            lessons: { select: { id: true } },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    const allLessonIds = course.chapters.flatMap((c) => c.lessons.map((l) => l.id));
    const totalLessons = allLessonIds.length;

    const completedCount = await this.prisma.progressRecord.count({
      where: {
        userId,
        lessonId: { in: allLessonIds },
        status: 'completed',
      },
    });

    const percent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

    return {
      courseId,
      totalLessons,
      completedLessons: completedCount,
      percent,
      isCompleted: completedCount > 0 && completedCount === totalLessons,
    };
  }

  // ==================== 标记完成 ====================

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: { select: { courseId: true } },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');

    // 确保用户已报名该课程（自动创建 enrollment 如果不存在，与免费课程逻辑一致）
    const courseId = lesson.chapter.courseId;
    await this.ensureEnrollment(userId, courseId);

    const wasAlreadyCompleted = await this.prisma.progressRecord.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    const record = await this.prisma.progressRecord.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        status: 'completed' as ProgressStatus,
        completedAt: new Date(),
      },
      create: {
        userId,
        courseId,
        lessonId,
        status: 'completed' as ProgressStatus,
        completedAt: new Date(),
      },
    });

    let pointsAwarded = 0;
    let newlyUnlockedBadges: { badgeId: string; name: string; pointsAwarded: number }[] = [];

    // 首次完成该课时发放积分
    if (!wasAlreadyCompleted || wasAlreadyCompleted.status !== 'completed') {
      const transaction = await this.pointsService.award(
        userId,
        10,
        `完成课时「${lesson.title}」`,
        'lesson',
        lessonId,
      );
      if (transaction) pointsAwarded = 10;

      // 检查徽章
      newlyUnlockedBadges = await this.badgesService.checkAndAward(userId);
    }

    const courseProgress = await this.getCourseProgress(userId, courseId);

    return {
      record,
      courseProgress,
      pointsAwarded,
      newlyUnlockedBadges,
    };
  }

  // ==================== 仪表盘统计 ====================

  async getLearningStats(userId: string) {
    const [
      totalCompletedLessons,
      weekCompletedLessons,
      activityRecords,
      longestStreak,
    ] = await Promise.all([
      this.prisma.progressRecord.count({ where: { userId, status: 'completed' } }),
      this.prisma.progressRecord.count({
        where: {
          userId,
          status: 'completed',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.progressRecord.findMany({
        where: { userId, status: 'completed', completedAt: { not: null } },
        select: { completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      this.computeLongestStreak(userId),
    ]);

    // 按天聚合活动量，补齐最近一年 0 值
    const countsByDate = new Map<string, number>();
    for (const r of activityRecords) {
      const date = new Date(r.completedAt!).toISOString().slice(0, 10);
      countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
    }

    const activity: { date: string; count: number }[] = [];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 364);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      activity.push({ date, count: countsByDate.get(date) ?? 0 });
    }

    const streakDays = await this.computeStreakDays(userId);

    return {
      totalCompletedLessons,
      weekCompletedLessons,
      streakDays,
      longestStreak,
      activity,
    };
  }

  // ==================== 内部工具 ====================

  private async ensureEnrollment(userId: string, courseId: string) {
    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId, source: 'direct' },
    });
  }

  private async computeStreakDays(userId: string): Promise<number> {
    const records = await this.prisma.progressRecord.findMany({
      where: { userId, status: 'completed', completedAt: { not: null } },
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    if (records.length === 0) return 0;

    const dates = Array.from(
      new Set(records.map((r) => new Date(r.completedAt!).toISOString().slice(0, 10))),
    ).sort().reverse();

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async computeLongestStreak(userId: string): Promise<number> {
    const records = await this.prisma.progressRecord.findMany({
      where: { userId, status: 'completed', completedAt: { not: null } },
      select: { completedAt: true },
      orderBy: { completedAt: 'asc' },
    });

    if (records.length === 0) return 0;

    const dates = Array.from(
      new Set(records.map((r) => new Date(r.completedAt!).toISOString().slice(0, 10))),
    );

    let longest = 1;
    let current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }
}
