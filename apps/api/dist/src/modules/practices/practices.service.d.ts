import { PrismaService } from '../prisma/prisma.service';
import { BadgesService } from '../badges/badges.service';
import { CreatePracticeProjectDto, UpdatePracticeProjectDto, CompletePracticeDto } from './practices.dto';
export declare class PracticesService {
    private prisma;
    private readonly badgesService;
    constructor(prisma: PrismaService, badgesService: BadgesService);
    getProjectsByCourseId(courseId: string): Promise<{
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
