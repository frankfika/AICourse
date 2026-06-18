import { PracticesService } from './practices.service';
import { CreatePracticeProjectDto, UpdatePracticeProjectDto, CompletePracticeDto } from './practices.dto';
export declare class PracticesController {
    private practicesService;
    constructor(practicesService: PracticesService);
    getProjectsByCourse(courseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        isActive: boolean;
        orderIndex: number;
        title: string;
        tags: string | null;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
    }[]>;
    getProject(id: string): Promise<{
        course: {
            id: string;
            title: string;
            thumbnail: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        isActive: boolean;
        orderIndex: number;
        title: string;
        tags: string | null;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
    }>;
    createProject(dto: CreatePracticeProjectDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        isActive: boolean;
        orderIndex: number;
        title: string;
        tags: string | null;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
    }>;
    updateProject(id: string, dto: UpdatePracticeProjectDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        isActive: boolean;
        orderIndex: number;
        title: string;
        tags: string | null;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
    }>;
    deleteProject(id: string): Promise<{
        message: string;
    }>;
    getUserProgress(req: any, courseId?: string): Promise<({
        project: {
            id: string;
            title: string;
            courseId: string;
            difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
            estimatedTime: number;
            projectType: import("@prisma/client").$Enums.ProjectType;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.CompletionStatus;
        userId: string;
        completedAt: Date | null;
        submissionUrl: string | null;
        notes: string | null;
        projectId: string;
        startedAt: Date;
    })[]>;
    startProject(req: any, id: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.CompletionStatus;
        userId: string;
        completedAt: Date | null;
        submissionUrl: string | null;
        notes: string | null;
        projectId: string;
        startedAt: Date;
    }>;
    completeProject(req: any, id: string, dto: CompletePracticeDto): Promise<{
        project: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            isActive: boolean;
            orderIndex: number;
            title: string;
            tags: string | null;
            courseId: string;
            projectUrl: string;
            thumbnailUrl: string | null;
            difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
            estimatedTime: number;
            projectType: import("@prisma/client").$Enums.ProjectType;
            requirements: string | null;
            objectives: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.CompletionStatus;
        userId: string;
        completedAt: Date | null;
        submissionUrl: string | null;
        notes: string | null;
        projectId: string;
        startedAt: Date;
    }>;
    skipProject(req: any, id: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.CompletionStatus;
        userId: string;
        completedAt: Date | null;
        submissionUrl: string | null;
        notes: string | null;
        projectId: string;
        startedAt: Date;
    }>;
}
