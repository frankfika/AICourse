import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { BadgesService } from '../badges/badges.service';
export declare class ProgressService {
    private readonly prisma;
    private readonly pointsService;
    private readonly badgesService;
    constructor(prisma: PrismaService, pointsService: PointsService, badgesService: BadgesService);
    getMyProgress(userId: string): Promise<({
        lesson: {
            id: string;
            title: string;
            chapterId: string;
        };
    } & {
        id: string;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ProgressStatus;
        userId: string;
        courseId: string;
        lessonId: string;
        completedAt: Date | null;
        lastPosition: number | null;
    })[]>;
    getCourseProgress(userId: string, courseId: string): Promise<{
        courseId: string;
        totalLessons: number;
        completedLessons: number;
        percent: number;
        isCompleted: boolean;
    }>;
    completeLesson(userId: string, lessonId: string): Promise<{
        record: {
            id: string;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.ProgressStatus;
            userId: string;
            courseId: string;
            lessonId: string;
            completedAt: Date | null;
            lastPosition: number | null;
        };
        courseProgress: {
            courseId: string;
            totalLessons: number;
            completedLessons: number;
            percent: number;
            isCompleted: boolean;
        };
        pointsAwarded: number;
        newlyUnlockedBadges: {
            badgeId: string;
            name: string;
            pointsAwarded: number;
        }[];
    }>;
    getLearningStats(userId: string): Promise<{
        totalCompletedLessons: number;
        weekCompletedLessons: number;
        streakDays: number;
        longestStreak: number;
        activity: {
            date: string;
            count: number;
        }[];
    }>;
    private ensureEnrollment;
    private computeStreakDays;
    private computeLongestStreak;
}
