import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateUserDto, UpdateUserDto, GrantCourseAccessDto, GrantDegreeAccessDto } from './users.dto';
import { UserRole } from '@prisma/client';
export declare class UsersService {
    private readonly prisma;
    private readonly auditLog;
    constructor(prisma: PrismaService, auditLog: AuditLogService);
    private userSelect;
    findAll(params: {
        role?: UserRole;
        search?: string;
        page: number;
        limit: number;
    }): Promise<{
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
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
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
