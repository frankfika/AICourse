import { PointsService } from './points.service';
export declare class PointsController {
    private readonly pointsService;
    constructor(pointsService: PointsService);
    getMyPoints(req: any): Promise<{
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
}
