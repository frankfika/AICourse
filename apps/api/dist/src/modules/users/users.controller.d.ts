import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { UpdateUserDto, GrantCourseAccessDto, GrantDegreeAccessDto, CreateUserDto } from './users.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        enrollments: ({
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
                courseType: import("@prisma/client").$Enums.CourseType;
                externalUrl: string | null;
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
        })[];
    }>;
    findAll(role?: UserRole, search?: string, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            avatarUrl: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        enrollments: ({
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
                courseType: import("@prisma/client").$Enums.CourseType;
                externalUrl: string | null;
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
        })[];
    }>;
    create(dto: CreateUserDto): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(req: {
        user: {
            userId: string;
            role: UserRole;
        };
    }, id: string, dto: UpdateUserDto): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | {
        error: string;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    grantCourseAccess(userId: string, dto: GrantCourseAccessDto): Promise<{
        granted: number;
    }>;
    grantDegreeAccess(userId: string, dto: GrantDegreeAccessDto): Promise<{
        granted: number;
    }>;
}
