import { AiService, CourseDraft, DegreeDraft } from './ai.service';
import { GenerateCourseDto, GenerateDegreeDto } from './ai.dto';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    generateCourse(dto: GenerateCourseDto): Promise<{
        draft: CourseDraft;
    }>;
    generateDegree(dto: GenerateDegreeDto): Promise<{
        draft: DegreeDraft;
    }>;
}
