import { CourseLevel, CostType, CourseStatus } from '@prisma/client';
import { ResourceType } from '@prisma/client';
declare class CreateResourceDto {
    title: string;
    url: string;
    type: ResourceType;
    isLocked?: boolean;
}
declare class CreateLessonDto {
    title: string;
    description?: string;
    videoUrl?: string;
    videoDuration?: number;
    orderIndex: number;
    isPreview?: boolean;
    resources?: CreateResourceDto[];
}
declare class CreateChapterDto {
    title: string;
    description?: string;
    orderIndex: number;
    lessons?: CreateLessonDto[];
}
export declare class CreateCourseDto {
    title: string;
    description: string;
    learningPoints: string;
    instructor: string;
    instructorId?: string;
    level: CourseLevel;
    duration: string;
    thumbnail: string;
    tags: string;
    costType: CostType;
    price: number;
    status?: CourseStatus;
    sourceVideoUrl?: string;
    sourcePlatform?: string;
    chapters?: CreateChapterDto[];
}
export declare class UpdateCourseDto extends CreateCourseDto {
}
export {};
