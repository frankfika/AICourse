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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const ai_dto_1 = require("./ai.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
let AiController = class AiController {
    constructor(aiService) {
        this.aiService = aiService;
    }
    async generateCourse(dto) {
        const draft = await this.aiService.generateCourse(dto.topic, dto.hint);
        return { draft };
    }
    async generateDegree(dto) {
        const draft = await this.aiService.generateDegree(dto.topic, dto.hint);
        return { draft };
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('generate-course'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_dto_1.GenerateCourseDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateCourse", null);
__decorate([
    (0, common_1.Post)('generate-degree'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_dto_1.GenerateDegreeDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateDegree", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map