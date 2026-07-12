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
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit/audit-log.service");
const client_1 = require("@prisma/client");
let CoursesService = class CoursesService {
    constructor(prisma, auditLog) {
        this.prisma = prisma;
        this.auditLog = auditLog;
        this.courseInclude = {
            chapters: {
                include: {
                    lessons: {
                        include: { resources: true },
                        orderBy: { orderIndex: 'asc' },
                    },
                },
                orderBy: { orderIndex: 'asc' },
            },
        };
    }
    async findAll(params) {
        const where = {};
        if (params.status)
            where.status = params.status;
        if (params.courseType)
            where.courseType = params.courseType;
        if (params.search) {
            where.OR = [
                { title: { contains: params.search } },
                { description: { contains: params.search } },
                { instructor: { contains: params.search } },
            ];
        }
        return this.prisma.course.findMany({
            where,
            include: this.courseInclude,
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id, includeDraft = false) {
        const course = await this.prisma.course.findFirst({
            where: {
                id,
                ...(includeDraft ? {} : { status: 'published' }),
            },
            include: this.courseInclude,
        });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        return course;
    }
    async create(dto) {
        const { chapters, sourceVideoUrl, sourcePlatform, externalUrl, courseType, ...courseData } = dto;
        const course = await this.prisma.course.create({
            data: {
                ...courseData,
                ...(sourceVideoUrl ? { sourceVideoUrl } : {}),
                ...(sourcePlatform ? { sourcePlatform } : {}),
                ...(externalUrl ? { externalUrl } : {}),
                ...(courseType ? { courseType } : {}),
                status: courseData.status ?? client_1.CourseStatus.draft,
                chapters: chapters
                    ? {
                        create: chapters.map((chapter) => ({
                            title: chapter.title,
                            description: chapter.description,
                            orderIndex: chapter.orderIndex,
                            lessons: chapter.lessons
                                ? {
                                    create: chapter.lessons.map((lesson) => ({
                                        title: lesson.title,
                                        description: lesson.description,
                                        videoUrl: lesson.videoUrl,
                                        videoDuration: lesson.videoDuration,
                                        orderIndex: lesson.orderIndex,
                                        isPreview: lesson.isPreview ?? false,
                                        resources: lesson.resources
                                            ? { create: lesson.resources }
                                            : undefined,
                                    })),
                                }
                                : undefined,
                        })),
                    }
                    : undefined,
            },
            include: this.courseInclude,
        });
        await this.auditLog.log({
            action: 'COURSE_CREATE',
            entity: 'course',
            entityId: course.id,
            details: { title: course.title },
        });
        return course;
    }
    async update(id, dto) {
        const { chapters, ...courseData } = dto;
        const course = await this.prisma.course.update({
            where: { id },
            data: courseData,
            include: this.courseInclude,
        });
        await this.auditLog.log({
            action: 'COURSE_UPDATE',
            entity: 'course',
            entityId: course.id,
            details: { title: course.title },
        });
        return course;
    }
    async delete(id) {
        await this.prisma.course.delete({ where: { id } });
        await this.auditLog.log({
            action: 'COURSE_DELETE',
            entity: 'course',
            entityId: id,
        });
        return { message: 'Course deleted' };
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map