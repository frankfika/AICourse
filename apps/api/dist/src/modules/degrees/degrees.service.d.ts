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
    }): Promise<any[]>;
    findOne(id: string, includeDraft?: boolean): Promise<any>;
    private shapeDegree;
    create(dto: CreateDegreeDto): Promise<{
        courses: ({
            course: {
                enrollments: {
                    id: string;
                    userId: string;
                }[];
                chapters: {
                    id: string;
                }[];
            } & {
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
        description: string;
        icon: string;
        title: string;
        learningPoints: string;
        thumbnail: string | null;
        costType: import("@prisma/client").$Enums.CostType;
        price: import("@prisma/client/runtime/library").Decimal;
        status: import("@prisma/client").$Enums.CourseStatus;
    }>;
    update(id: string, dto: UpdateDegreeDto): Promise<{
        courses: ({
            course: {
                enrollments: {
                    id: string;
                    userId: string;
                }[];
                chapters: {
                    id: string;
                }[];
            } & {
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
        description: string;
        icon: string;
        title: string;
        learningPoints: string;
        thumbnail: string | null;
        costType: import("@prisma/client").$Enums.CostType;
        price: import("@prisma/client/runtime/library").Decimal;
        status: import("@prisma/client").$Enums.CourseStatus;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    linkCourses(id: string, dto: LinkCoursesDto): Promise<({
        courses: ({
            course: {
                enrollments: {
                    id: string;
                    userId: string;
                }[];
                chapters: {
                    id: string;
                }[];
            } & {
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
        description: string;
        icon: string;
        title: string;
        learningPoints: string;
        thumbnail: string | null;
        costType: import("@prisma/client").$Enums.CostType;
        price: import("@prisma/client/runtime/library").Decimal;
        status: import("@prisma/client").$Enums.CourseStatus;
    }) | null>;
}
