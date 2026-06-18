import { PrismaService } from '../prisma/prisma.service';
export declare function calculateLevel(points: number): number;
export declare function levelThreshold(level: number): number;
export declare class PointsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getUserPoints(userId: string): Promise<{
        points: number;
        level: number;
        currentLevelPoints: number;
        nextLevelPoints: number;
        pointsToNextLevel: number;
        recentTransactions: {
            id: string;
            createdAt: Date;
            userId: string;
            amount: number;
            reason: string;
            refType: string | null;
            refId: string | null;
        }[];
    }>;
    award(userId: string, amount: number, reason: string, refType?: string | null, refId?: string | null): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        amount: number;
        reason: string;
        refType: string | null;
        refId: string | null;
    } | null>;
}
