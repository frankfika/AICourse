import { PrismaService } from '../prisma/prisma.service';
import { BadgesService } from '../badges/badges.service';
export declare class EnrollmentsService {
    private readonly prisma;
    private readonly badgesService;
    constructor(prisma: PrismaService, badgesService: BadgesService);
    findByUser(userId: string): Promise<({
        course: {
            id: string;
            level: import("@prisma/client").$Enums.CourseLevel;
            createdAt: Date;
            updatedAt: Date;
            instructor: string;
            description: string;
            title: string;
            learningPoints: string;
            instructorId: string | null;
            duration: string;
            thumbnail: string;
            tags: string;
            costType: import("@prisma/client").$Enums.CostType;
            price: import("@prisma/client/runtime/library").Decimal;
            status: import("@prisma/client").$Enums.CourseStatus;
            sourceVideoUrl: string | null;
            sourcePlatform: string | null;
        } | null;
        degree: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            icon: string;
            title: string;
            learningPoints: string;
            thumbnail: string | null;
            costType: import("@prisma/client").$Enums.CostType;
            price: import("@prisma/client/runtime/library").Decimal;
            status: import("@prisma/client").$Enums.CourseStatus;
        } | null;
    } & {
        id: string;
        userId: string;
        expiresAt: Date | null;
        courseId: string | null;
        degreeId: string | null;
        enrolledAt: Date;
        source: import("@prisma/client").$Enums.EnrollmentSource;
    })[]>;
    enrollFreeCourse(userId: string, courseId: string): Promise<{
        id: string;
        userId: string;
        expiresAt: Date | null;
        courseId: string | null;
        degreeId: string | null;
        enrolledAt: Date;
        source: import("@prisma/client").$Enums.EnrollmentSource;
    }>;
}
