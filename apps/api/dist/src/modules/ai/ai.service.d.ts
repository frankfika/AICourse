import { ConfigService } from '@nestjs/config';
import { CourseLevel, CostType } from '@prisma/client';
export declare class AiService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    private get apiKey();
    private get model();
    generateCourse(topic: string, hint?: string): Promise<CourseDraft>;
    generateDegree(topic: string, hint?: string): Promise<DegreeDraft>;
    private sanitize;
    private buildCoursePrompt;
    private buildDegreePrompt;
    private callGemini;
    private extractJson;
    private mergeWithFallback;
    private fallbackCourse;
    private fallbackDegree;
    private inferTags;
    private inferLevel;
    private inferCostType;
    private inferDuration;
}
export interface CourseDraft {
    title: string;
    description: string;
    learningPoints: string;
    instructor: string;
    level: CourseLevel;
    duration: string;
    thumbnail: string;
    tags: string;
    costType: CostType;
    price: number;
}
export interface DegreeDraft {
    title: string;
    description: string;
    learningPoints: string;
    icon: string;
    costType: CostType;
    price: number;
    thumbnail: string;
    tags: string;
}
