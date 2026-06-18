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
exports.HackathonsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit/audit-log.service");
const client_1 = require("@prisma/client");
let HackathonsService = class HackathonsService {
    constructor(prisma, auditLog) {
        this.prisma = prisma;
        this.auditLog = auditLog;
        this.baseSelect = {
            id: true,
            title: true,
            description: true,
            bannerUrl: true,
            status: true,
            startDate: true,
            endDate: true,
            registerDeadline: true,
            minTeamSize: true,
            maxTeamSize: true,
            location: true,
            rules: true,
            prizes: true,
            organizerId: true,
            createdAt: true,
            updatedAt: true,
        };
        this.organizerSelect = {
            id: true,
            name: true,
            avatarUrl: true,
        };
        this.userSelect = {
            id: true,
            name: true,
            avatarUrl: true,
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
                { location: { contains: params.search } },
            ];
        }
        const hackathons = await this.prisma.hackathon.findMany({
            where,
            select: {
                ...this.baseSelect,
                organizer: { select: this.organizerSelect },
                _count: {
                    select: {
                        registrations: { where: { status: 'registered' } },
                        teams: true,
                    },
                },
                registrations: params.userId
                    ? {
                        where: { userId: params.userId },
                        take: 1,
                    }
                    : undefined,
            },
            orderBy: { startDate: 'desc' },
        });
        return hackathons.map((h) => ({
            ...h,
            myRegistration: h.registrations?.[0] ?? null,
            registrations: undefined,
        }));
    }
    async findOne(id, userId) {
        const hackathon = await this.prisma.hackathon.findUnique({
            where: { id },
            select: {
                ...this.baseSelect,
                organizer: { select: this.organizerSelect },
                judges: true,
                _count: {
                    select: {
                        registrations: { where: { status: 'registered' } },
                        teams: true,
                        submissions: true,
                    },
                },
            },
        });
        if (!hackathon)
            throw new common_1.NotFoundException('Hackathon not found');
        let myRegistration = null;
        if (userId) {
            myRegistration = await this.prisma.hackathonRegistration.findUnique({
                where: { hackathonId_userId: { hackathonId: id, userId } },
            });
        }
        return { ...hackathon, myRegistration };
    }
    async create(dto, organizerId) {
        const hackathon = await this.prisma.hackathon.create({
            data: {
                ...dto,
                organizerId,
                minTeamSize: dto.minTeamSize ?? 1,
                maxTeamSize: dto.maxTeamSize ?? 5,
                status: dto.status ?? client_1.HackathonStatus.upcoming,
            },
            select: {
                ...this.baseSelect,
                organizer: { select: this.organizerSelect },
            },
        });
        await this.auditLog.log({
            userId: organizerId,
            action: 'HACKATHON_CREATE',
            entity: 'hackathon',
            entityId: hackathon.id,
            details: { title: hackathon.title },
        });
        return hackathon;
    }
    async update(id, dto) {
        await this.ensureExists(id);
        const hackathon = await this.prisma.hackathon.update({
            where: { id },
            data: dto,
            select: {
                ...this.baseSelect,
                organizer: { select: this.organizerSelect },
            },
        });
        await this.auditLog.log({
            action: 'HACKATHON_UPDATE',
            entity: 'hackathon',
            entityId: hackathon.id,
            details: { title: hackathon.title },
        });
        return hackathon;
    }
    async delete(id) {
        await this.ensureExists(id);
        await this.prisma.hackathon.delete({ where: { id } });
        await this.auditLog.log({
            action: 'HACKATHON_DELETE',
            entity: 'hackathon',
            entityId: id,
        });
        return { message: 'Hackathon deleted' };
    }
    async register(userId, hackathonId) {
        const hackathon = await this.ensureExists(hackathonId);
        if (hackathon.status === client_1.HackathonStatus.cancelled) {
            throw new common_1.ForbiddenException('该黑客松已取消');
        }
        if (hackathon.registerDeadline &&
            new Date(hackathon.registerDeadline) < new Date()) {
            throw new common_1.ForbiddenException('报名已截止');
        }
        const existing = await this.prisma.hackathonRegistration.findUnique({
            where: { hackathonId_userId: { hackathonId, userId } },
        });
        if (existing?.status === 'registered') {
            return existing;
        }
        if (existing?.status === 'cancelled') {
            return this.prisma.hackathonRegistration.update({
                where: { hackathonId_userId: { hackathonId, userId } },
                data: { status: 'registered' },
            });
        }
        return this.prisma.hackathonRegistration.create({
            data: { hackathonId, userId, status: 'registered' },
        });
    }
    async cancelRegistration(userId, hackathonId) {
        await this.ensureExists(hackathonId);
        const existing = await this.prisma.hackathonRegistration.findUnique({
            where: { hackathonId_userId: { hackathonId, userId } },
        });
        if (!existing || existing.status !== 'registered') {
            throw new common_1.BadRequestException('尚未报名该黑客松');
        }
        return this.prisma.hackathonRegistration.update({
            where: { hackathonId_userId: { hackathonId, userId } },
            data: { status: 'cancelled' },
        });
    }
    async getMyRegistration(userId, hackathonId) {
        await this.ensureExists(hackathonId);
        return this.prisma.hackathonRegistration.findUnique({
            where: { hackathonId_userId: { hackathonId, userId } },
        });
    }
    async getAnnouncements(hackathonId) {
        await this.ensureExists(hackathonId);
        return this.prisma.announcement.findMany({
            where: { hackathonId },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async createAnnouncement(hackathonId, dto, userId) {
        await this.ensureExists(hackathonId);
        const announcement = await this.prisma.announcement.create({
            data: {
                hackathonId,
                title: dto.title,
                content: dto.content,
                isPinned: dto.isPinned ?? false,
            },
        });
        await this.auditLog.log({
            userId,
            action: 'HACKATHON_ANNOUNCEMENT_CREATE',
            entity: 'announcement',
            entityId: announcement.id,
            details: { hackathonId, title: announcement.title },
        });
        return announcement;
    }
    async getTeams(hackathonId) {
        await this.ensureExists(hackathonId);
        return this.prisma.team.findMany({
            where: { hackathonId },
            include: {
                members: {
                    include: { user: { select: this.userSelect } },
                },
                _count: { select: { submissions: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createTeam(userId, hackathonId, dto) {
        const hackathon = await this.ensureExists(hackathonId);
        await this.ensureRegistered(userId, hackathonId);
        const existingTeam = await this.prisma.team.findFirst({
            where: { hackathonId, name: dto.name },
        });
        if (existingTeam) {
            throw new common_1.BadRequestException('该黑客松下已存在同名队伍');
        }
        const existingMembership = await this.prisma.teamMember.findFirst({
            where: { userId, team: { hackathonId } },
        });
        if (existingMembership) {
            throw new common_1.BadRequestException('你已经加入了一个队伍');
        }
        return this.prisma.$transaction(async (tx) => {
            const team = await tx.team.create({
                data: {
                    hackathonId,
                    name: dto.name,
                    slogan: dto.slogan,
                    captainId: userId,
                },
            });
            await tx.teamMember.create({
                data: { teamId: team.id, userId, role: 'captain' },
            });
            return tx.team.findUnique({
                where: { id: team.id },
                include: {
                    members: { include: { user: { select: this.userSelect } } },
                },
            });
        });
    }
    async joinTeam(userId, hackathonId, teamId) {
        const hackathon = await this.ensureExists(hackathonId);
        await this.ensureRegistered(userId, hackathonId);
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            include: { members: true, hackathon: { select: { maxTeamSize: true } } },
        });
        if (!team || team.hackathonId !== hackathonId) {
            throw new common_1.NotFoundException('Team not found');
        }
        const existingMembership = await this.prisma.teamMember.findFirst({
            where: { userId, team: { hackathonId } },
        });
        if (existingMembership) {
            throw new common_1.BadRequestException('你已经加入了一个队伍');
        }
        if (team.members.length >= (team.hackathon?.maxTeamSize ?? hackathon.maxTeamSize)) {
            throw new common_1.ForbiddenException('队伍已满');
        }
        return this.prisma.teamMember.create({
            data: { teamId, userId, role: 'member' },
            include: { user: { select: this.userSelect }, team: true },
        });
    }
    async leaveTeam(userId, hackathonId, teamId) {
        await this.ensureExists(hackathonId);
        const membership = await this.prisma.teamMember.findFirst({
            where: { userId, teamId, team: { hackathonId } },
            include: { team: true },
        });
        if (!membership) {
            throw new common_1.BadRequestException('你不是该队伍成员');
        }
        if (membership.role === 'captain') {
            await this.prisma.team.delete({ where: { id: teamId } });
            return { message: 'Team disbanded' };
        }
        await this.prisma.teamMember.delete({ where: { id: membership.id } });
        return { message: 'Left team' };
    }
    async getMySubmissions(userId, hackathonId) {
        await this.ensureExists(hackathonId);
        return this.prisma.submission.findMany({
            where: {
                hackathonId,
                OR: [{ userId }, { team: { members: { some: { userId } } } }],
            },
            include: {
                team: { select: { id: true, name: true } },
                user: { select: this.userSelect },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createSubmission(userId, hackathonId, dto) {
        const hackathon = await this.ensureExists(hackathonId);
        await this.ensureRegistered(userId, hackathonId);
        let teamId = dto.teamId;
        if (teamId) {
            const membership = await this.prisma.teamMember.findFirst({
                where: { userId, teamId, team: { hackathonId } },
            });
            if (!membership) {
                throw new common_1.ForbiddenException('你不是该队伍成员');
            }
        }
        const isSubmitted = dto.status === client_1.SubmissionStatus.submitted;
        return this.prisma.submission.create({
            data: {
                hackathonId,
                userId: teamId ? undefined : userId,
                teamId,
                title: dto.title,
                description: dto.description,
                demoUrl: dto.demoUrl,
                repoUrl: dto.repoUrl,
                videoUrl: dto.videoUrl,
                status: dto.status ?? client_1.SubmissionStatus.draft,
                submittedAt: isSubmitted ? new Date() : undefined,
            },
            include: {
                team: { select: { id: true, name: true } },
                user: { select: this.userSelect },
            },
        });
    }
    async updateSubmission(userId, hackathonId, submissionId, dto) {
        await this.ensureExists(hackathonId);
        const submission = await this.prisma.submission.findFirst({
            where: {
                id: submissionId,
                hackathonId,
                OR: [{ userId }, { team: { members: { some: { userId } } } }],
            },
        });
        if (!submission) {
            throw new common_1.NotFoundException('Submission not found');
        }
        const isNowSubmitted = dto.status === client_1.SubmissionStatus.submitted;
        const wasSubmitted = submission.status === client_1.SubmissionStatus.submitted;
        return this.prisma.submission.update({
            where: { id: submissionId },
            data: {
                ...dto,
                submittedAt: isNowSubmitted && !wasSubmitted ? new Date() : submission.submittedAt,
            },
            include: {
                team: { select: { id: true, name: true } },
                user: { select: this.userSelect },
            },
        });
    }
    async getAllSubmissions(hackathonId) {
        await this.ensureExists(hackathonId);
        return this.prisma.submission.findMany({
            where: { hackathonId },
            include: {
                team: { select: { id: true, name: true } },
                user: { select: this.userSelect },
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });
    }
    async judgeSubmission(hackathonId, submissionId, dto) {
        await this.ensureExists(hackathonId);
        const submission = await this.prisma.submission.findFirst({
            where: { id: submissionId, hackathonId },
        });
        if (!submission)
            throw new common_1.NotFoundException('Submission not found');
        return this.prisma.submission.update({
            where: { id: submissionId },
            data: {
                score: dto.score,
                feedback: dto.feedback,
                status: dto.status ?? client_1.SubmissionStatus.under_review,
            },
            include: {
                team: { select: { id: true, name: true } },
                user: { select: this.userSelect },
            },
        });
    }
    async ensureExists(id) {
        const hackathon = await this.prisma.hackathon.findUnique({ where: { id } });
        if (!hackathon)
            throw new common_1.NotFoundException('Hackathon not found');
        return hackathon;
    }
    async ensureRegistered(userId, hackathonId) {
        const registration = await this.prisma.hackathonRegistration.findUnique({
            where: { hackathonId_userId: { hackathonId, userId } },
        });
        if (!registration || registration.status !== 'registered') {
            throw new common_1.ForbiddenException('请先报名该黑客松');
        }
    }
};
exports.HackathonsService = HackathonsService;
exports.HackathonsService = HackathonsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], HackathonsService);
//# sourceMappingURL=hackathons.service.js.map