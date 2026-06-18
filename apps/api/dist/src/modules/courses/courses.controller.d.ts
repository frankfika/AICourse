import { CoursesService } from './courses.service';
import { CourseStatus } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from './courses.dto';
export declare class CoursesController {
    private readonly coursesService;
    constructor(coursesService: CoursesService);
    findAll(status?: CourseStatus, search?: string): Promise<({
        chapters: ({
            lessons: ({
                resources: {
                    id: string;
                    createdAt: Date;
                    title: string;
                    url: string;
                    type: import("@prisma/client").$Enums.ResourceType;
                    isLocked: boolean;
                    lessonId: string;
                }[];
            } & {
                id: string;
                createdAt: Date;
                description: string | null;
                orderIndex: number;
                videoDuration: number | null;
                title: string;
                videoUrl: string | null;
                isPreview: boolean;
                chapterId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            orderIndex: number;
            title: string;
            courseId: string;
        })[];
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
    })[]>;
    findOne(id: string): Promise<{
        chapters: ({
            lessons: ({
                resources: {
                    id: string;
                    createdAt: Date;
                    title: string;
                    url: string;
                    type: import("@prisma/client").$Enums.ResourceType;
                    isLocked: boolean;
                    lessonId: string;
                }[];
            } & {
                id: string;
                createdAt: Date;
                description: string | null;
                orderIndex: number;
                videoDuration: number | null;
                title: string;
                videoUrl: string | null;
                isPreview: boolean;
                chapterId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            orderIndex: number;
            title: string;
            courseId: string;
        })[];
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
    }>;
    create(dto: CreateCourseDto): Promise<{
        chapters: ({
            lessons: ({
                resources: {
                    id: string;
                    createdAt: Date;
                    title: string;
                    url: string;
                    type: import("@prisma/client").$Enums.ResourceType;
                    isLocked: boolean;
                    lessonId: string;
                }[];
            } & {
                id: string;
                createdAt: Date;
                description: string | null;
                orderIndex: number;
                videoDuration: number | null;
                title: string;
                videoUrl: string | null;
                isPreview: boolean;
                chapterId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            orderIndex: number;
            title: string;
            courseId: string;
        })[];
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
    }>;
    update(id: string, dto: UpdateCourseDto): Promise<{
        chapters: ({
            lessons: ({
                resources: {
                    id: string;
                    createdAt: Date;
                    title: string;
                    url: string;
                    type: import("@prisma/client").$Enums.ResourceType;
                    isLocked: boolean;
                    lessonId: string;
                }[];
            } & {
                id: string;
                createdAt: Date;
                description: string | null;
                orderIndex: number;
                videoDuration: number | null;
                title: string;
                videoUrl: string | null;
                isPreview: boolean;
                chapterId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            orderIndex: number;
            title: string;
            courseId: string;
        })[];
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
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
