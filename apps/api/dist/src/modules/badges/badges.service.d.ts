import { PrismaService } from '../prisma/prisma.service';
import { BadgeCriteriaType } from '@prisma/client';
import { PointsService } from '../points/points.service';
export interface UserStats {
    completedCourseIds: string[];
    completedLessonsCount: number;
    streakDays: number;
    enrollmentsCount: number;
    completedPracticesCount: number;
    points: number;
}
export declare class BadgesService {
    private readonly prisma;
    private readonly pointsService;
    constructor(prisma: PrismaService, pointsService: PointsService);
    findAllActive(): Promise<{
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    }[]>;
    findById(id: string): Promise<{
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    }>;
    findByCode(code: string): Promise<{
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    } | null>;
    getUserBadgesWithStatus(userId: string): Promise<{
        unlocked: boolean;
        unlockedAt: Date | null;
        progress: number;
        target: number;
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    }[]>;
    checkAndAward(userId: string): Promise<{
        badgeId: string;
        name: string;
        pointsAwarded: number;
    }[]>;
    create(dto: {
        code: string;
        name: string;
        description: string;
        icon?: string;
        category?: string;
        criteriaType: BadgeCriteriaType;
        criteriaValue?: number;
        points?: number;
        isActive?: boolean;
        orderIndex?: number;
    }): Promise<{
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    }>;
    update(id: string, dto: Partial<Parameters<BadgesService['create']>[0]>): Promise<{
        id: string;
        name: string;
        points: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string;
        icon: string;
        category: string;
        criteriaType: import("@prisma/client").$Enums.BadgeCriteriaType;
        criteriaValue: number;
        isActive: boolean;
        orderIndex: number;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    getAdminStats(): Promise<{
        totalUsers: number;
        activeUsers7d: number;
        totalLessonsCompleted: number;
        totalBadgesUnlocked: number;
        badgeDistribution: {
            badgeId: string;
            name: string;
            icon: string;
            count: number;
        }[];
        leaderboard: {
            userId: string;
            name: string;
            points: number;
            level: number;
        }[];
    }>;
    private computeUserStats;
    private getCompletedCourseIds;
    private computeStreakDays;
    private computeProgress;
}
