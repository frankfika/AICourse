import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { BadgesService } from '../badges/badges.service';
import { ProgressStatus } from '@prisma/client';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly badgesService: BadgesService,
    private readonly certificatesService: CertificatesService,
    private readonly notificationService: NotificationService,
  ) {}

  // ==================== 查询 ====================

  async getMyProgress(userId: string) {
    return this.prisma.progressRecord.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { lesson: { select: { id: true, title: true, chapterId: true } } },
      // P1-7 防御: max 100, 防 DoS
      take: 100,
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
      courseTitle: course.title,
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
        chapter: {
          select: {
            courseId: true,
            course: { select: { costType: true } },
          },
        },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');

    // 免费/公益课程可自动报名；付费课程必须已有有效报名，避免绕过付费墙。
    const courseId = lesson.chapter.courseId;
    await this.ensureCourseAccess(userId, courseId, lesson.chapter.course.costType);

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
    let certificate: Awaited<ReturnType<CertificatesService['issueCertificate']>> | null = null;
    let degreeCertificates: Awaited<ReturnType<CertificatesService['issueCertificate']>>[] = [];
    const isFirstCompletion = !wasAlreadyCompleted || wasAlreadyCompleted.status !== 'completed';

    if (courseProgress.isCompleted) {
      certificate = await this.certificatesService.issueCertificate({
        userId,
        type: 'course',
        refId: courseId,
        title: `${courseProgress.courseTitle} 课程完成证书`,
        description: `已完成课程「${courseProgress.courseTitle}」的全部课时`,
        completedAt: new Date().toISOString(),
      });
      if (isFirstCompletion) {
        await this.notificationService.create({
          userId,
          type: 'announcement',
          title: '课程完成，证书已签发',
          body: `你已完成「${courseProgress.courseTitle}」，证书现已可查看。`,
          linkUrl: `/dashboard/certificates/${certificate.id}`,
        });
      }
      degreeCertificates = await this.issueCompletedDegreeCertificates(
        userId,
        courseId,
        isFirstCompletion,
      );
    }

    return {
      record,
      courseProgress,
      pointsAwarded,
      newlyUnlockedBadges,
      certificate,
      degreeCertificates,
    };
  }

  /**
   * A degree certificate represents completion of every lesson in every course
   * attached to an active degree enrollment. Payment alone never calls this path.
   */
  private async issueCompletedDegreeCertificates(
    userId: string,
    completedCourseId: string,
    notify: boolean,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        degreeId: { not: null },
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        degree: { courses: { some: { courseId: completedCourseId } } },
      },
      select: { degreeId: true },
    });

    const issued = [];
    for (const enrollment of enrollments) {
      if (!enrollment.degreeId) continue;
      const certificate = await this.issueDegreeCertificateIfCompleted(
        userId,
        enrollment.degreeId,
        notify,
      );
      if (certificate) issued.push(certificate);
    }
    return issued;
  }

  /**
   * Re-evaluates a single active degree enrollment. This is public so degree
   * enrollment/payment can recognize coursework completed before enrollment.
   */
  async issueDegreeCertificateIfCompleted(
    userId: string,
    degreeId: string,
    notify = true,
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        degreeId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        degree: {
          include: {
            courses: {
              include: {
                course: {
                  include: {
                    chapters: { include: { lessons: { select: { id: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!enrollment?.degree) return null;

    const lessonIds = enrollment.degree.courses.flatMap((degreeCourse) =>
      degreeCourse.course.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => lesson.id),
      ),
    );
    if (lessonIds.length === 0) return null;

    const completedLessons = await this.prisma.progressRecord.count({
      where: { userId, lessonId: { in: lessonIds }, status: 'completed' },
    });
    if (completedLessons !== lessonIds.length) return null;

    const existing = await this.prisma.certificate.findFirst({
      where: { userId, type: 'degree', refId: degreeId, revokedAt: null },
    });
    if (existing) return existing;

    const degreeCertificate = await this.certificatesService.issueCertificate({
      userId,
      type: 'degree',
      refId: degreeId,
      title: `${enrollment.degree.title} 学位完成证书`,
      description: `已完成学位项目「${enrollment.degree.title}」的全部课程`,
      completedAt: new Date().toISOString(),
    });

    if (notify) {
      await this.notificationService.create({
        userId,
        type: 'announcement',
        title: '学位项目完成，证书已签发',
        body: `你已完成「${enrollment.degree.title}」的全部课程，学位证书现已可查看。`,
        linkUrl: `/dashboard/certificates/${degreeCertificate.id}`,
      });
    }
    return degreeCertificate;
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

  private async ensureCourseAccess(userId: string, courseId: string, costType: string) {
    if (costType === 'free' || costType === 'charity') {
      await this.prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: {
          deletedAt: null,
          expiresAt: null,
          enrolledAt: new Date(),
          source: 'direct',
        },
        create: { userId, courseId, source: 'direct' },
      });
      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('Course enrollment required');
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
