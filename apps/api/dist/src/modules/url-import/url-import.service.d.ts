import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export interface VideoMetadata {
    title: string;
    authorName: string;
    description: string;
    thumbnailUrl: string;
    videoUrl: string;
    embedUrl: string;
    platform: 'youtube' | 'bilibili';
    videoId: string;
}
export interface BatchImportResult {
    url: string;
    status: 'created' | 'duplicate' | 'failed';
    courseId?: string;
    error?: string;
}
export declare class UrlImportService {
    private readonly aiService;
    private readonly prisma;
    private readonly logger;
    constructor(aiService: AiService, prisma: PrismaService);
    importFromUrl(rawUrl: string): Promise<VideoMetadata>;
    private cleanBilibiliThumbnail;
    buildCourseDraftFromMeta(meta: VideoMetadata): Promise<import("../ai/ai.service").CourseDraft>;
    findExistingCourseByVideoUrl(canonicalUrl: string): Promise<{
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
    } | null>;
    importMany(rawUrls: string[]): Promise<BatchImportResult[]>;
    private fetchYouTube;
    private fetchBilibili;
    private safeFetchJson;
    private sleep;
}
