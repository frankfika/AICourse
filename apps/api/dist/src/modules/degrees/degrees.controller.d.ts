import { DegreesService } from './degrees.service';
import { CourseStatus } from '@prisma/client';
import { CreateDegreeDto, UpdateDegreeDto, LinkCoursesDto } from './degrees.dto';
export declare class DegreesController {
    private readonly degreesService;
    constructor(degreesService: DegreesService);
    findAll(status?: CourseStatus, search?: string): Promise<({
        courses: ({
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
    })[]>;
    findOne(id: string): Promise<{
        courses: ({
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
    create(dto: CreateDegreeDto): Promise<{
        courses: ({
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
