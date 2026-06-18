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
exports.PracticesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const practices_service_1 = require("./practices.service");
const practices_dto_1 = require("./practices.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let PracticesController = class PracticesController {
    constructor(practicesService) {
        this.practicesService = practicesService;
    }
    async getProjectsByCourse(courseId) {
        return this.practicesService.getProjectsByCourseId(courseId);
    }
    async getProject(id) {
        return this.practicesService.getProjectById(id);
    }
    async createProject(dto) {
        return this.practicesService.createProject(dto);
    }
    async updateProject(id, dto) {
        return this.practicesService.updateProject(id, dto);
    }
    async deleteProject(id) {
        return this.practicesService.deleteProject(id);
    }
    async getUserProgress(req, courseId) {
        return this.practicesService.getUserProgress(req.user.userId, courseId);
    }
    async startProject(req, id) {
        return this.practicesService.startProject(req.user.userId, id);
    }
    async completeProject(req, id, dto) {
        return this.practicesService.completeProject(req.user.userId, id, dto);
    }
    async skipProject(req, id) {
        return this.practicesService.skipProject(req.user.userId, id);
    }
};
exports.PracticesController = PracticesController;
__decorate([
    (0, common_1.Get)('courses/:courseId'),
    (0, swagger_1.ApiOperation)({ summary: '获取课程的实践项目列表' }),
    (0, swagger_1.ApiParam)({ name: 'courseId', description: '课程ID' }),
    __param(0, (0, common_1.Param)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "getProjectsByCourse", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '获取实践项目详情' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "getProject", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '创建实践项目（管理员）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [practices_dto_1.CreatePracticeProjectDto]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "createProject", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '更新实践项目（管理员）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, practices_dto_1.UpdatePracticeProjectDto]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '删除实践项目（管理员）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "deleteProject", null);
__decorate([
    (0, common_1.Get)('user/progress'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '获取用户的实践进度' }),
    (0, swagger_1.ApiQuery)({ name: 'courseId', required: false, description: '可选：按课程筛选' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "getUserProgress", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '开始实践项目' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "startProject", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '完成实践项目' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, practices_dto_1.CompletePracticeDto]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "completeProject", null);
__decorate([
    (0, common_1.Post)(':id/skip'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '跳过实践项目' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '项目ID' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PracticesController.prototype, "skipProject", null);
exports.PracticesController = PracticesController = __decorate([
    (0, swagger_1.ApiTags)('practices'),
    (0, common_1.Controller)({ path: 'practices', version: '1' }),
    __metadata("design:paramtypes", [practices_service_1.PracticesService])
], PracticesController);
//# sourceMappingURL=practices.controller.js.map