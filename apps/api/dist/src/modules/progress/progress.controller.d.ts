import { ProgressService } from './progress.service';
export declare class ProgressController {
    private readonly progressService;
    constructor(progressService: ProgressService);
    getMyProgress(req: any): Promise<({
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
    getMyStats(req: any): Promise<{
        totalCompletedLessons: number;
        weekCompletedLessons: number;
        streakDays: number;
        longestStreak: number;
        activity: {
            date: string;
            count: number;
        }[];
    }>;
    getCourseProgress(req: any, courseId: string): Promise<{
        courseId: string;
        totalLessons: number;
        completedLessons: number;
        percent: number;
        isCompleted: boolean;
    }>;
    completeLesson(req: any, lessonId: string): Promise<{
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
}
