"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PracticesService = class PracticesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProjectsByCourseId(courseId) {
        return this.prisma.practiceProject.findMany({
            where: { courseId, isActive: true },
            orderBy: { orderIndex: 'asc' },
        });
    }
    async getProjectById(id) {
        const project = await this.prisma.practiceProject.findUnique({
            where: { id },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        thumbnail: true,
                    },
                },
            },
        });
        if (!project) {
            throw new common_1.NotFoundException('Practice project not found');
        }
        return project;
    }
    async createProject(dto) {
        const course = await this.prisma.course.findUnique({
            where: { id: dto.courseId },
        });
        if (!course) {
            throw new common_1.NotFoundException('Course not found');
        }
        return this.prisma.practiceProject.create({
            data: {
                ...dto,
                orderIndex: dto.orderIndex ?? 0,
                isActive: dto.isActive ?? true,
            },
        });
    }
    async updateProject(id, dto) {
        const project = await this.prisma.practiceProject.findUnique({
            where: { id },
        });
        if (!project) {
            throw new common_1.NotFoundException('Practice project not found');
        }
        return this.prisma.practiceProject.update({
            where: { id },
            data: dto,
        });
    }
    async deleteProject(id) {
        const project = await this.prisma.practiceProject.findUnique({
            where: { id },
        });
        if (!project) {
            throw new common_1.NotFoundException('Practice project not found');
        }
        await this.prisma.practiceProject.delete({
            where: { id },
        });
        return { message: 'Practice project deleted successfully' };
    }
    async getUserProgress(userId, courseId) {
        const where = { userId };
        if (courseId) {
            where.project = { courseId };
        }
        return this.prisma.practiceCompletion.findMany({
            where,
            include: {
                project: {
                    select: {
                        id: true,
                        title: true,
                        courseId: true,
                        difficulty: true,
                        estimatedTime: true,
                        projectType: true,
                    },
                },
            },
            orderBy: { startedAt: 'desc' },
        });
    }
    async startProject(userId, projectId) {
        const project = await this.prisma.practiceProject.findUnique({
            where: { id: projectId },
        });
        if (!project) {
            throw new common_1.NotFoundException('Practice project not found');
        }
        if (!project.isActive) {
            throw new common_1.ForbiddenException('This practice project is not active');
        }
        const existing = await this.prisma.practiceCompletion.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
        });
        if (existing) {
            return existing;
        }
        return this.prisma.practiceCompletion.create({
            data: {
                userId,
                projectId,
                status: 'in_progress',
            },
            include: {
                project: true,
            },
        });
    }
    async completeProject(userId, projectId, dto) {
        const completion = await this.prisma.practiceCompletion.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
        });
        if (!completion) {
            throw new common_1.NotFoundException('Practice completion not found. Please start the project first.');
        }
        return this.prisma.practiceCompletion.update({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
            data: {
                status: 'completed',
                completedAt: new Date(),
                submissionUrl: dto.submissionUrl,
                notes: dto.notes,
            },
            include: {
                project: true,
            },
        });
    }
    async skipProject(userId, projectId) {
        const completion = await this.prisma.practiceCompletion.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
        });
        if (!completion) {
            throw new common_1.NotFoundException('Practice completion not found');
        }
        return this.prisma.practiceCompletion.update({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
            data: {
                status: 'skipped',
            },
        });
    }
};
exports.PracticesService = PracticesService;
exports.PracticesService = PracticesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PracticesService);
//# sourceMappingURL=practices.service.js.map