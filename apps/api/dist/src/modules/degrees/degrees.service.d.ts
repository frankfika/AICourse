import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateDegreeDto, UpdateDegreeDto, LinkCoursesDto } from './degrees.dto';
import { CourseStatus } from '@prisma/client';
export declare class DegreesService {
    private readonly prisma;
    private readonly auditLog;
    constructor(prisma: PrismaService, auditLog: AuditLogService);
    private degreeInclude;
    findAll(params: {
        status?: CourseStatus;
        search?: string;
    }): Promise<({
        courses: ({
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
            };
        } & {
            orderIndex: number;
            courseId: string;
            degreeId: string;
        })[];
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
        courses: ({
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
            };
        } & {
            orderIndex: number;
            courseId: string;
            degreeId: string;
        })[];
    } & {
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
    }>;
    create(dto: CreateDegreeDto): Promise<{
        courses: ({
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
            };
        } & {
            orderIndex: number;
            courseId: string;
            degreeId: string;
        })[];
    } & {
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
    }>;
    update(id: string, dto: UpdateDegreeDto): Promise<{
        courses: ({
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
            };
        } & {
            orderIndex: number;
            courseId: string;
            degreeId: string;
        })[];
    } & {
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
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    linkCourses(id: string, dto: LinkCoursesDto): Promise<({
        courses: ({
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
            };
        } & {
            orderIndex: number;
            courseId: string;
            degreeId: string;
        })[];
    } & {
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
    }) | null>;
}
