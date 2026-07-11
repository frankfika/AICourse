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
exports.EnterpriseController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const enterprise_service_1 = require("./enterprise.service");
const enterprise_dto_1 = require("./enterprise.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
let EnterpriseController = class EnterpriseController {
    constructor(enterpriseService) {
        this.enterpriseService = enterpriseService;
    }
    async create(dto) {
        return this.enterpriseService.create(dto);
    }
    async findAll() {
        return this.enterpriseService.findAll();
    }
    async updateStatus(id, dto) {
        return this.enterpriseService.updateStatus(id, dto);
    }
    async delete(id) {
        return this.enterpriseService.delete(id);
    }
};
exports.EnterpriseController = EnterpriseController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    (0, common_1.Post)('inquiries'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [enterprise_dto_1.CreateEnterpriseInquiryDto]),
    __metadata("design:returntype", Promise)
], EnterpriseController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('inquiries'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EnterpriseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)('inquiries/:id/status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, enterprise_dto_1.UpdateInquiryStatusDto]),
    __metadata("design:returntype", Promise)
], EnterpriseController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)('inquiries/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EnterpriseController.prototype, "delete", null);
exports.EnterpriseController = EnterpriseController = __decorate([
    (0, common_1.Controller)('enterprise'),
    __metadata("design:paramtypes", [enterprise_service_1.EnterpriseService])
], EnterpriseController);
//# sourceMappingURL=enterprise.controller.js.map