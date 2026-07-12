import { UrlImportService } from './url-import.service';
import { ImportFromUrlDto, BatchImportFromUrlDto } from './url-import.dto';
import { CoursesService } from '../courses/courses.service';
export declare class UrlImportController {
    private readonly urlImport;
    private readonly coursesService;
    constructor(urlImport: UrlImportService, coursesService: CoursesService);
    importFromUrl(dto: ImportFromUrlDto): Promise<{
        status: "duplicate";
        meta: null;
        draft: null;
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
        };
    } | {
        status: "created";
        meta: import("./url-import.service").VideoMetadata;
        draft: import("../ai/ai.service").CourseDraft;
        course: {
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
            courseType: import("@prisma/client").$Enums.CourseType;
            externalUrl: string | null;
            sourceVideoUrl: string | null;
            sourcePlatform: string | null;
        };
    }>;
    importBatch(dto: BatchImportFromUrlDto): Promise<{
        total: number;
        created: number;
        duplicate: number;
        failed: number;
        results: {
            url: string;
            status: "created" | "duplicate" | "failed";
            courseId?: string;
            error?: string;
            draftTitle?: string;
        }[];
    }>;
}
