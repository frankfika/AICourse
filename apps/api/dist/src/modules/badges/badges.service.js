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
exports.BadgesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const points_service_1 = require("../points/points.service");
let BadgesService = class BadgesService {
    constructor(prisma, pointsService) {
        this.prisma = prisma;
        this.pointsService = pointsService;
    }
    async findAllActive() {
        return this.prisma.badge.findMany({
            where: { isActive: true },
            orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
        });
    }
    async findById(id) {
        const badge = await this.prisma.badge.findUnique({ where: { id } });
        if (!badge)
            throw new common_1.NotFoundException('Badge not found');
        return badge;
    }
    async findByCode(code) {
        return this.prisma.badge.findUnique({ where: { code } });
    }
    async getUserBadgesWithStatus(userId) {
        const [badges, userStats, userBadges] = await Promise.all([
            this.findAllActive(),
            this.computeUserStats(userId),
            this.prisma.userBadge.findMany({
                where: { userId },
                include: { badge: true },
            }),
        ]);
        const unlockedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub.unlockedAt]));
        return badges.map((badge) => {
            const progress = this.computeProgress(badge.criteriaType, badge.criteriaValue, userStats);
            const unlocked = !!unlockedMap.get(badge.id);
            return {
                ...badge,
                unlocked,
                unlockedAt: unlockedMap.get(badge.id) ?? null,
                progress: progress.current,
                target: progress.target,
            };
        });
    }
    async checkAndAward(userId) {
        const [badges, userStats, existingUserBadges] = await Promise.all([
            this.findAllActive(),
            this.computeUserStats(userId),
            this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
        ]);
        const unlockedBadgeIds = new Set(existingUserBadges.map((ub) => ub.badgeId));
        const newlyUnlocked = [];
        for (const badge of badges) {
            if (unlockedBadgeIds.has(badge.id))
                continue;
            const { current, target } = this.computeProgress(badge.criteriaType, badge.criteriaValue, userStats);
            if (current >= target) {
                try {
                    await this.prisma.userBadge.create({
                        data: { userId, badgeId: badge.id },
                    });
                    let pointsAwarded = 0;
                    if (badge.points > 0) {
                        await this.pointsService.award(userId, badge.points, `解锁徽章「${badge.name}」`, 'badge', badge.id);
                        pointsAwarded = badge.points;
                    }
                    newlyUnlocked.push({ badgeId: badge.id, name: badge.name, pointsAwarded });
                    unlockedBadgeIds.add(badge.id);
                }
                catch (e) {
                    if (e.code !== 'P2002')
                        throw e;
                }
            }
        }
        return newlyUnlocked;
    }
    async create(dto) {
        return this.prisma.badge.create({
            data: {
                ...dto,
                criteriaValue: dto.criteriaValue ?? 1,
                points: dto.points ?? 0,
                isActive: dto.isActive ?? true,
                orderIndex: dto.orderIndex ?? 0,
                icon: dto.icon ?? 'award',
                category: dto.category ?? 'general',
            },
        });
    }
    async update(id, dto) {
        await this.findById(id);
        return this.prisma.badge.update({ where: { id }, data: dto });
    }
    async delete(id) {
        await this.findById(id);
        await this.prisma.badge.delete({ where: { id } });
        return { message: 'Badge deleted successfully' };
    }
    async getAdminStats() {
        const [totalUsers, activeUsers7d, totalLessonsCompleted, totalBadgesUnlocked, badgeDistribution, leaderboard,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.progressRecord.groupBy({
                by: ['userId'],
                where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            }).then((rows) => rows.length),
            this.prisma.progressRecord.count({ where: { status: 'completed' } }),
            this.prisma.userBadge.count(),
            this.prisma.userBadge.groupBy({
                by: ['badgeId'],
                _count: { badgeId: true },
            }),
            this.prisma.user.findMany({
                orderBy: { points: 'desc' },
                take: 10,
                select: { id: true, name: true, points: true, level: true },
            }),
        ]);
        const badges = await this.prisma.badge.findMany({
            where: { id: { in: badgeDistribution.map((d) => d.badgeId) } },
            select: { id: true, name: true, icon: true },
        });
        const badgeMap = new Map(badges.map((b) => [b.id, b]));
        return {
            totalUsers,
            activeUsers7d,
            totalLessonsCompleted,
            totalBadgesUnlocked,
            badgeDistribution: badgeDistribution
                .map((d) => ({
                badgeId: d.badgeId,
                name: badgeMap.get(d.badgeId)?.name ?? d.badgeId,
                icon: badgeMap.get(d.badgeId)?.icon ?? 'award',
                count: d._count.badgeId,
            }))
                .sort((a, b) => b.count - a.count),
            leaderboard: leaderboard.map((u) => ({
                userId: u.id,
                name: u.name ?? '匿名用户',
                points: u.points,
                level: u.level,
            })),
        };
    }
    async computeUserStats(userId) {
        const [completedLessons, completedCourses, enrollmentsCount, completedPractices, user, streakDays,] = await Promise.all([
            this.prisma.progressRecord.count({ where: { userId, status: 'completed' } }),
            this.getCompletedCourseIds(userId),
            this.prisma.enrollment.count({ where: { userId } }),
            this.prisma.practiceCompletion.count({ where: { userId, status: 'completed' } }),
            this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
            this.computeStreakDays(userId),
        ]);
        return {
            completedCourseIds: completedCourses,
            completedLessonsCount: completedLessons,
            streakDays,
            enrollmentsCount,
            completedPracticesCount: completedPractices,
            points: user?.points ?? 0,
        };
    }
    async getCompletedCourseIds(userId) {
        const enrollments = await this.prisma.enrollment.findMany({
            where: { userId },
            select: { courseId: true },
        });
        const courseIds = enrollments.map((e) => e.courseId).filter((id) => !!id);
        if (courseIds.length === 0)
            return [];
        const courses = await this.prisma.course.findMany({
            where: { id: { in: courseIds } },
            include: {
                chapters: {
                    include: {
                        lessons: { select: { id: true } },
                    },
                },
            },
        });
        const progressRecords = await this.prisma.progressRecord.findMany({
            where: { userId, status: 'completed' },
            select: { lessonId: true },
        });
        const completedLessonIds = new Set(progressRecords.map((p) => p.lessonId));
        const completedCourseIds = [];
        for (const course of courses) {
            const allLessonIds = course.chapters.flatMap((c) => c.lessons.map((l) => l.id));
            if (allLessonIds.length > 0 && allLessonIds.every((id) => completedLessonIds.has(id))) {
                completedCourseIds.push(course.id);
            }
        }
        return completedCourseIds;
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
        let streak = 1;
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (dates[0] !== today && dates[0] !== yesterday)
            return 0;
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
    computeProgress(type, target, stats) {
        switch (type) {
            case 'course_completed':
                return { current: stats.completedCourseIds.length, target };
            case 'lessons_completed':
                return { current: stats.completedLessonsCount, target };
            case 'streak_days':
                return { current: stats.streakDays, target };
            case 'first_enrollment':
                return { current: stats.enrollmentsCount, target: Math.max(1, target) };
            case 'practice_completed':
                return { current: stats.completedPracticesCount, target };
            case 'points_reached':
                return { current: stats.points, target };
            default:
                return { current: 0, target };
        }
    }
};
exports.BadgesService = BadgesService;
exports.BadgesService = BadgesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        points_service_1.PointsService])
], BadgesService);
//# sourceMappingURL=badges.service.js.map