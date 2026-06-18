import { BadgesService } from './badges.service';
import { CreateBadgeDto, UpdateBadgeDto } from './badges.dto';
export declare class BadgesController {
    private readonly badgesService;
    constructor(badgesService: BadgesService);
    findAll(): Promise<{
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
    getMyBadges(req: any): Promise<{
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
    create(dto: CreateBadgeDto): Promise<{
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
    update(id: string, dto: UpdateBadgeDto): Promise<{
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
}
