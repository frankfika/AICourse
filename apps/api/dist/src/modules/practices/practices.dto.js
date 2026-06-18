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
exports.CompletePracticeDto = exports.UpdatePracticeProjectDto = exports.CreatePracticeProjectDto = exports.CompletionStatus = exports.ProjectType = exports.ProjectDifficulty = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var ProjectDifficulty;
(function (ProjectDifficulty) {
    ProjectDifficulty["BEGINNER"] = "beginner";
    ProjectDifficulty["INTERMEDIATE"] = "intermediate";
    ProjectDifficulty["ADVANCED"] = "advanced";
    ProjectDifficulty["EXPERT"] = "expert";
})(ProjectDifficulty || (exports.ProjectDifficulty = ProjectDifficulty = {}));
var ProjectType;
(function (ProjectType) {
    ProjectType["MODEL_DEPLOYMENT"] = "model_deployment";
    ProjectType["MODEL_TRAINING"] = "model_training";
    ProjectType["MODEL_INFERENCE"] = "model_inference";
    ProjectType["API_INTEGRATION"] = "api_integration";
    ProjectType["NOTEBOOK"] = "notebook";
    ProjectType["SANDBOX"] = "sandbox";
    ProjectType["REPOSITORY"] = "repository";
    ProjectType["CSGHUB_SPACE"] = "csghub_space";
})(ProjectType || (exports.ProjectType = ProjectType = {}));
var CompletionStatus;
(function (CompletionStatus) {
    CompletionStatus["IN_PROGRESS"] = "in_progress";
    CompletionStatus["COMPLETED"] = "completed";
    CompletionStatus["SKIPPED"] = "skipped";
})(CompletionStatus || (exports.CompletionStatus = CompletionStatus = {}));
class CreatePracticeProjectDto {
}
exports.CreatePracticeProjectDto = CreatePracticeProjectDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "courseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "projectUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ProjectDifficulty }),
    (0, class_validator_1.IsEnum)(ProjectDifficulty),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePracticeProjectDto.prototype, "estimatedTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "tags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ProjectType }),
    (0, class_validator_1.IsEnum)(ProjectType),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "projectType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreatePracticeProjectDto.prototype, "orderIndex", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "requirements", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePracticeProjectDto.prototype, "objectives", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreatePracticeProjectDto.prototype, "isActive", void 0);
class UpdatePracticeProjectDto {
}
exports.UpdatePracticeProjectDto = UpdatePracticeProjectDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "projectUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ProjectDifficulty }),
    (0, class_validator_1.IsEnum)(ProjectDifficulty),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdatePracticeProjectDto.prototype, "estimatedTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "tags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ProjectType }),
    (0, class_validator_1.IsEnum)(ProjectType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "projectType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdatePracticeProjectDto.prototype, "orderIndex", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "requirements", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePracticeProjectDto.prototype, "objectives", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdatePracticeProjectDto.prototype, "isActive", void 0);
class CompletePracticeDto {
}
exports.CompletePracticeDto = CompletePracticeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CompletePracticeDto.prototype, "submissionUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CompletePracticeDto.prototype, "notes", void 0);
//# sourceMappingURL=practices.dto.js.map