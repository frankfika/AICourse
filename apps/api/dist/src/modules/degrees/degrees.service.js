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
exports.DegreesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit/audit-log.service");
const client_1 = require("@prisma/client");
let DegreesService = class DegreesService {
    constructor(prisma, auditLog) {
        this.prisma = prisma;
        this.auditLog = auditLog;
        this.degreeInclude = {
            courses: {
                include: {
                    course: {
                        include: {
                            chapters: {
                                select: { id: true },
                                orderBy: { orderIndex: 'asc' },
                            },
                            enrollments: {
                                select: { id: true, userId: true },
                            },
                        },
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
        if (params.search) {
            where.OR = [
                { title: { contains: params.search } },
                { description: { contains: params.search } },
            ];
        }
        const degrees = await this.prisma.nanoDegree.findMany({
            where,
            include: this.degreeInclude,
            orderBy: { createdAt: 'desc' },
        });
        return degrees.map((d) => this.shapeDegree(d));
    }
    async findOne(id, includeDraft = false) {
        const degree = await this.prisma.nanoDegree.findFirst({
            where: {
                id,
                ...(includeDraft ? {} : { status: 'published' }),
            },
            include: this.degreeInclude,
        });
        if (!degree)
            throw new common_1.NotFoundException('Degree not found');
        return this.shapeDegree(degree);
    }
    shapeDegree(degree) {
        const courses = (degree.courses ?? []).map((link, idx) => {
            const c = link.course;
            return {
                id: c.id,
                title: c.title,
                description: c.description,
                thumbnail: c.thumbnail,
                level: c.level,
                duration: c.duration,
                instructor: c.instructor,
                tags: c.tags,
                costType: c.costType,
                price: c.price,
                orderIndex: link.orderIndex,
                stepNumber: idx + 1,
                chapterCount: c.chapters?.length ?? 0,
                learnerCount: c.enrollments?.length ?? 0,
            };
        });
        const totalChapters = courses.reduce((sum, c) => sum + c.chapterCount, 0);
        const totalLearners = courses.reduce((sum, c) => sum + c.learnerCount, 0);
        return {
            ...degree,
            courses,
            stats: {
                courseCount: courses.length,
                totalChapters,
                totalLearners,
                estimatedHours: Math.max(courses.length * 4, 1),
            },
        };
    }
    async create(dto) {
        const degree = await this.prisma.nanoDegree.create({
            data: {
                ...dto,
                status: dto.status ?? client_1.CourseStatus.draft,
            },
            include: this.degreeInclude,
        });
        await this.auditLog.log({
            action: 'DEGREE_CREATE',
            entity: 'degree',
            entityId: degree.id,
            details: { title: degree.title },
        });
        return degree;
    }
    async update(id, dto) {
        const degree = await this.prisma.nanoDegree.update({
            where: { id },
            data: dto,
            include: this.degreeInclude,
        });
        await this.auditLog.log({
            action: 'DEGREE_UPDATE',
            entity: 'degree',
            entityId: degree.id,
            details: { title: degree.title },
        });
        return degree;
    }
    async delete(id) {
        await this.prisma.nanoDegree.delete({ where: { id } });
        await this.auditLog.log({
            action: 'DEGREE_DELETE',
            entity: 'degree',
            entityId: id,
        });
        return { message: 'Degree deleted' };
    }
    async linkCourses(id, dto) {
        await this.prisma.degreeCourse.deleteMany({ where: { degreeId: id } });
        await this.prisma.degreeCourse.createMany({
            data: dto.courses.map((c) => ({
                degreeId: id,
                courseId: c.courseId,
                orderIndex: c.orderIndex,
            })),
        });
        return this.prisma.nanoDegree.findUnique({
            where: { id },
            include: this.degreeInclude,
        });
    }
};
exports.DegreesService = DegreesService;
exports.DegreesService = DegreesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], DegreesService);
//# sourceMappingURL=degrees.service.js.map