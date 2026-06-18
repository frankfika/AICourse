import { EnrollmentsService } from './enrollments.service';
export declare class EnrollmentsController {
    private readonly enrollmentsService;
    constructor(enrollmentsService: EnrollmentsService);
    getMyEnrollments(req: {
        user: {
            userId: string;
        };
    }): Promise<({
        course: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            instructor: string;
            title: string;
            description: string;
            learningPoints: string;
            instructorId: string | null;
            level: import("@prisma/client").$Enums.CourseLevel;
            duration: string;
            thumbnail: string;
            tags: string;
            costType: import("@prisma/client").$Enums.CostType;
            price: import("@prisma/client/runtime/library").Decimal;
            status: import("@prisma/client").$Enums.CourseStatus;
        } | null;
        degree: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string;
            learningPoints: string;
            thumbnail: string | null;
            costType: import("@prisma/client").$Enums.CostType;
            price: import("@prisma/client/runtime/library").Decimal;
            status: import("@prisma/client").$Enums.CourseStatus;
            icon: string;
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
    enrollFreeCourse(req: {
        user: {
            userId: string;
        };
    }, courseId: string): Promise<{
        id: string;
        userId: string;
        expiresAt: Date | null;
        courseId: string | null;
        degreeId: string | null;
        enrolledAt: Date;
        source: import("@prisma/client").$Enums.EnrollmentSource;
    }>;
}
