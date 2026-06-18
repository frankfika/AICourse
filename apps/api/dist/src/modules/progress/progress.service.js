"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const points_service_1 = require("../points/points.service");
const badges_service_1 = require("../badges/badges.service");
let ProgressService = class ProgressService {
    constructor(prisma, pointsService, badgesService) {
        this.prisma = prisma;
        this.pointsService = pointsService;
        this.badgesService = badgesService;
    }
    async getMyProgress(userId) {
        return this.prisma.progressRecord.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: { lesson: { select: { id: true, title: true, chapterId: true } } },
        });
    }
    async getCourseProgress(userId, courseId) {
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
        if (!course)
            throw new common_1.NotFoundException('Course not found');
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
    async completeLesson(userId, lessonId) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                chapter: { select: { courseId: true } },
            },
        });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        const courseId = lesson.chapter.courseId;
        await this.ensureEnrollment(userId, courseId);
        const wasAlreadyCompleted = await this.prisma.progressRecord.findUnique({
            where: { userId_lessonId: { userId, lessonId } },
        });
        const record = await this.prisma.progressRecord.upsert({
            where: { userId_lessonId: { userId, lessonId } },
            update: {
                status: 'completed',
                completedAt: new Date(),
            },
            create: {
                userId,
                courseId,
                lessonId,
                status: 'completed',
                completedAt: new Date(),
            },
        });
        let pointsAwarded = 0;
        let newlyUnlockedBadges = [];
        if (!wasAlreadyCompleted || wasAlreadyCompleted.status !== 'completed') {
            const transaction = await this.pointsService.award(userId, 10, `完成课时「${lesson.title}」`, 'lesson', lessonId);
            if (transaction)
                pointsAwarded = 10;
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
    async getLearningStats(userId) {
        const [totalCompletedLessons, weekCompletedLessons, activityRecords, longestStreak,] = await Promise.all([
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
        const countsByDate = new Map();
        for (const r of activityRecords) {
            const date = new Date(r.completedAt).toISOString().slice(0, 10);
            countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
        }
        const activity = [];
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
    async ensureEnrollment(userId, courseId) {
        await this.prisma.enrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: {},
            create: { userId, courseId, source: 'direct' },
        });
    }
    async computeStreakDays(userId) {
        const records = await this.prisma.progressRecord.findMany({
            where: { userId, status: 'completed', completedAt: { not: null } },
            select: { completedAt: true },
            orderBy: { completedAt: 'desc' },
        });
        if (records.length === 0)
            return 0;
        const dates = Array.from(new Set(records.map((r) => new Date(r.completedAt).toISOString().slice(0, 10)))).sort().reverse();
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (dates[0] !== today && dates[0] !== yesterday)
            return 0;
        let streak = 1;
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diffDays = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);
            if (diffDays === 1) {
                streak++;
            }
            else {
                break;
            }
        }
        return streak;
    }
    async computeLongestStreak(userId) {
        const records = await this.prisma.progressRecord.findMany({
            where: { userId, status: 'completed', completedAt: { not: null } },
            select: { completedAt: true },
            orderBy: { completedAt: 'asc' },
        });
        if (records.length === 0)
            return 0;
        const dates = Array.from(new Set(records.map((r) => new Date(r.completedAt).toISOString().slice(0, 10))));
        let longest = 1;
        let current = 1;
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
            if (diffDays === 1) {
                current++;
                longest = Math.max(longest, current);
            }
            else {
                current = 1;
            }
        }
        return longest;
    }
};
exports.ProgressService = ProgressService;
exports.ProgressService = ProgressService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        points_service_1.PointsService,
        badges_service_1.BadgesService])
], ProgressService);
//# sourceMappingURL=progress.service.js.map