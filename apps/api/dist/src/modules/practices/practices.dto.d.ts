export declare enum ProjectDifficulty {
    BEGINNER = "beginner",
    INTERMEDIATE = "intermediate",
    ADVANCED = "advanced",
    EXPERT = "expert"
}
export declare enum ProjectType {
    MODEL_DEPLOYMENT = "model_deployment",
    MODEL_TRAINING = "model_training",
    MODEL_INFERENCE = "model_inference",
    API_INTEGRATION = "api_integration",
    NOTEBOOK = "notebook",
    SANDBOX = "sandbox",
    REPOSITORY = "repository",
    CSGHUB_SPACE = "csghub_space"
}
export declare enum CompletionStatus {
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    SKIPPED = "skipped"
}
export declare class CreatePracticeProjectDto {
    courseId: string;
    title: string;
    description: string;
    projectUrl: string;
    thumbnailUrl?: string;
    difficulty: ProjectDifficulty;
    estimatedTime: number;
    tags?: string;
    projectType: ProjectType;
    orderIndex?: number;
    requirements?: string;
    objectives?: string;
    isActive?: boolean;
}
export declare class UpdatePracticeProjectDto {
    title?: string;
    description?: string;
    projectUrl?: string;
    thumbnailUrl?: string;
    difficulty?: ProjectDifficulty;
    estimatedTime?: number;
    tags?: string;
    projectType?: ProjectType;
    orderIndex?: number;
    requirements?: string;
    objectives?: string;
    isActive?: boolean;
}
export declare class CompletePracticeDto {
    submissionUrl?: string;
    notes?: string;
}
