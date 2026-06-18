"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit/audit-log.service");
let UsersService = class UsersService {
    constructor(prisma, auditLog) {
        this.prisma = prisma;
        this.auditLog = auditLog;
        this.userSelect = {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
        };
    }
    async findAll(params) {
        const where = {};
        if (params.role)
            where.role = params.role;
        if (params.search) {
            where.OR = [
                { email: { contains: params.search } },
                { name: { contains: params.search } },
            ];
        }
        const skip = (params.page - 1) * params.limit;
        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: this.userSelect,
                skip,
                take: params.limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);
        return { data, total, page: params.page, limit: params.limit };
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                ...this.userSelect,
                enrollments: {
                    include: { course: true, degree: true },
                },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async create(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                name: dto.name,
                role: dto.role,
            },
            select: this.userSelect,
        });
        await this.auditLog.log({
            userId: user.id,
            action: 'USER_CREATE',
            entity: 'user',
            entityId: user.id,
        });
        return user;
    }
    async update(id, dto) {
        return this.prisma.user.update({
            where: { id },
            data: dto,
            select: this.userSelect,
        });
    }
    async delete(id) {
        await this.prisma.user.delete({ where: { id } });
        return { message: 'User deleted' };
    }
    async grantCourseAccess(userId, dto) {
        const enrollments = await this.prisma.$transaction(dto.courseIds.map((courseId) => this.prisma.enrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: {},
            create: { userId, courseId, source: 'direct' },
        })));
        await this.auditLog.log({
            userId,
            action: 'USER_GRANT_COURSE',
            entity: 'user',
            entityId: userId,
            details: { courseIds: dto.courseIds },
        });
        return { granted: enrollments.length };
    }
    async grantDegreeAccess(userId, dto) {
        const enrollments = await this.prisma.$transaction(dto.degreeIds.map((degreeId) => this.prisma.enrollment.upsert({
            where: { userId_degreeId: { userId, degreeId } },
            update: {},
            create: { userId, degreeId, source: 'direct' },
        })));
        await this.auditLog.log({
            userId,
            action: 'USER_GRANT_DEGREE',
            entity: 'user',
            entityId: userId,
            details: { degreeIds: dto.degreeIds },
        });
        return { granted: enrollments.length };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], UsersService);
//# sourceMappingURL=users.service.js.map