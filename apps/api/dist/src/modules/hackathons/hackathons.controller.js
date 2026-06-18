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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HackathonsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const hackathons_service_1 = require("./hackathons.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const optional_jwt_auth_guard_1 = require("../../common/guards/optional-jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const hackathons_dto_1 = require("./hackathons.dto");
let HackathonsController = class HackathonsController {
    constructor(hackathonsService) {
        this.hackathonsService = hackathonsService;
    }
    getUserId(req) {
        return req?.user?.userId;
    }
    async findAll(status, search, req) {
        return this.hackathonsService.findAll({
            status,
            search,
            userId: req ? this.getUserId(req) : undefined,
        });
    }
    async findOne(id, req) {
        return this.hackathonsService.findOne(id, this.getUserId(req));
    }
    async create(dto, req) {
        return this.hackathonsService.create(dto, this.getUserId(req));
    }
    async update(id, dto) {
        return this.hackathonsService.update(id, dto);
    }
    async delete(id) {
        return this.hackathonsService.delete(id);
    }
    async register(id, req) {
        return this.hackathonsService.register(this.getUserId(req), id);
    }
    async cancelRegistration(id, req) {
        return this.hackathonsService.cancelRegistration(this.getUserId(req), id);
    }
    async getMyRegistration(id, req) {
        return this.hackathonsService.getMyRegistration(this.getUserId(req), id);
    }
    async getAnnouncements(id) {
        return this.hackathonsService.getAnnouncements(id);
    }
    async createAnnouncement(id, dto, req) {
        return this.hackathonsService.createAnnouncement(id, dto, this.getUserId(req));
    }
    async getTeams(id) {
        return this.hackathonsService.getTeams(id);
    }
    async createTeam(id, dto, req) {
        return this.hackathonsService.createTeam(this.getUserId(req), id, dto);
    }
    async joinTeam(id, teamId, req) {
        return this.hackathonsService.joinTeam(this.getUserId(req), id, teamId);
    }
    async leaveTeam(id, teamId, req) {
        return this.hackathonsService.leaveTeam(this.getUserId(req), id, teamId);
    }
    async getMySubmissions(id, req) {
        return this.hackathonsService.getMySubmissions(this.getUserId(req), id);
    }
    async getAllSubmissions(id) {
        return this.hackathonsService.getAllSubmissions(id);
    }
    async createSubmission(id, dto, req) {
        return this.hackathonsService.createSubmission(this.getUserId(req), id, dto);
    }
    async updateSubmission(id, submissionId, dto, req) {
        return this.hackathonsService.updateSubmission(this.getUserId(req), id, submissionId, dto);
    }
    async judgeSubmission(id, submissionId, dto) {
        return this.hackathonsService.judgeSubmission(id, submissionId, dto);
    }
};
exports.HackathonsController = HackathonsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_1.OptionalJwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: '获取黑客松列表' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: client_1.HackathonStatus }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_1.OptionalJwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: '获取黑客松详情' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '创建黑客松（管理员）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hackathons_dto_1.CreateHackathonDto, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '更新黑客松（管理员）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hackathons_dto_1.UpdateHackathonDto]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '删除黑客松（管理员）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/register'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '报名黑客松' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "register", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '取消报名' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "cancelRegistration", null);
__decorate([
    (0, common_1.Get)(':id/my-registration'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '获取当前用户报名状态' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "getMyRegistration", null);
__decorate([
    (0, common_1.Get)(':id/announcements'),
    (0, swagger_1.ApiOperation)({ summary: '获取黑客松公告' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "getAnnouncements", null);
__decorate([
    (0, common_1.Post)(':id/announcements'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '发布公告（管理员）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hackathons_dto_1.CreateAnnouncementDto, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "createAnnouncement", null);
__decorate([
    (0, common_1.Get)(':id/teams'),
    (0, swagger_1.ApiOperation)({ summary: '获取队伍列表' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "getTeams", null);
__decorate([
    (0, common_1.Post)(':id/teams'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '创建队伍' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hackathons_dto_1.CreateTeamDto, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "createTeam", null);
__decorate([
    (0, common_1.Post)(':id/teams/:teamId/join'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '加入队伍' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    (0, swagger_1.ApiParam)({ name: 'teamId', description: '队伍ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('teamId')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "joinTeam", null);
__decorate([
    (0, common_1.Post)(':id/teams/:teamId/leave'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '退出队伍' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    (0, swagger_1.ApiParam)({ name: 'teamId', description: '队伍ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('teamId')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "leaveTeam", null);
__decorate([
    (0, common_1.Get)(':id/submissions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '获取我的作品' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "getMySubmissions", null);
__decorate([
    (0, common_1.Get)(':id/submissions/all'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '获取所有作品（管理员/评委）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "getAllSubmissions", null);
__decorate([
    (0, common_1.Post)(':id/submissions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '创建作品' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hackathons_dto_1.CreateSubmissionDto, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "createSubmission", null);
__decorate([
    (0, common_1.Patch)(':id/submissions/:submissionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '更新作品' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    (0, swagger_1.ApiParam)({ name: 'submissionId', description: '作品ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('submissionId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, hackathons_dto_1.UpdateSubmissionDto, Object]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "updateSubmission", null);
__decorate([
    (0, common_1.Post)(':id/submissions/:submissionId/judge'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '作品评分（管理员/评委）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '黑客松ID' }),
    (0, swagger_1.ApiParam)({ name: 'submissionId', description: '作品ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('submissionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, hackathons_dto_1.JudgeSubmissionDto]),
    __metadata("design:returntype", Promise)
], HackathonsController.prototype, "judgeSubmission", null);
exports.HackathonsController = HackathonsController = __decorate([
    (0, swagger_1.ApiTags)('hackathons'),
    (0, common_1.Controller)({ path: 'hackathons', version: '1' }),
    __metadata("design:paramtypes", [hackathons_service_1.HackathonsService])
], HackathonsController);
//# sourceMappingURL=hackathons.controller.js.map