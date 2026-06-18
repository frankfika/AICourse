import { PrismaService } from '../prisma/prisma.service';
import { CreatePracticeProjectDto, UpdatePracticeProjectDto, CompletePracticeDto } from './practices.dto';
export declare class PracticesService {
    private prisma;
    constructor(prisma: PrismaService);
    getProjectsByCourseId(courseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        tags: string | null;
        orderIndex: number;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
        isActive: boolean;
    }[]>;
    getProjectById(id: string): Promise<{
        course: {
            id: string;
            title: string;
            thumbnail: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        tags: string | null;
        orderIndex: number;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
        isActive: boolean;
    }>;
    createProject(dto: CreatePracticeProjectDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        tags: string | null;
        orderIndex: number;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
        isActive: boolean;
    }>;
    updateProject(id: string, dto: UpdatePracticeProjectDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        tags: string | null;
        orderIndex: number;
        courseId: string;
        projectUrl: string;
        thumbnailUrl: string | null;
        difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
        estimatedTime: number;
        projectType: import("@prisma/client").$Enums.ProjectType;
        requirements: string | null;
        objectives: string | null;
        isActive: boolean;
    }>;
    deleteProject(id: string): Promise<{
        message: string;
    }>;
    getUserProgress(userId: string, courseId?: string): Promise<({
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
    startProject(userId: string, projectId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.CompletionStatus;
        userId: string;
        completedAt: Date | null;
        submissionUrl: string | null;
        notes: string | null;
        projectId: string;
        startedAt: Date;
    }>;
    completeProject(userId: string, projectId: string, dto: CompletePracticeDto): Promise<{
        project: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string;
            tags: string | null;
            orderIndex: number;
            courseId: string;
            projectUrl: string;
            thumbnailUrl: string | null;
            difficulty: import("@prisma/client").$Enums.ProjectDifficulty;
            estimatedTime: number;
            projectType: import("@prisma/client").$Enums.ProjectType;
            requirements: string | null;
            objectives: string | null;
            isActive: boolean;
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
    skipProject(userId: string, projectId: string): Promise<{
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
