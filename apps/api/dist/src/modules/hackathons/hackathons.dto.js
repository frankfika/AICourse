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
exports.JudgeSubmissionDto = exports.CreateAnnouncementDto = exports.UpdateSubmissionDto = exports.CreateSubmissionDto = exports.CreateTeamDto = exports.UpdateHackathonDto = exports.CreateHackathonDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class CreateHackathonDto {
}
exports.CreateHackathonDto = CreateHackathonDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '黑客松标题' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '黑客松描述' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Banner 图片 URL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "bannerUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.HackathonStatus, description: '状态' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HackathonStatus),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '开始时间 ISO 字符串' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '结束时间 ISO 字符串' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '报名截止时间 ISO 字符串' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "registerDeadline", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '最小团队人数', default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateHackathonDto.prototype, "minTeamSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '最大团队人数', default: 5 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CreateHackathonDto.prototype, "maxTeamSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '地点' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '比赛规则' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "rules", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '奖项设置' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHackathonDto.prototype, "prizes", void 0);
class UpdateHackathonDto extends CreateHackathonDto {
}
exports.UpdateHackathonDto = UpdateHackathonDto;
class CreateTeamDto {
}
exports.CreateTeamDto = CreateTeamDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '队伍名称' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTeamDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '队伍口号' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTeamDto.prototype, "slogan", void 0);
class CreateSubmissionDto {
}
exports.CreateSubmissionDto = CreateSubmissionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '作品标题' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '作品描述' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Demo 链接' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "demoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '代码仓库链接' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "repoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '视频链接' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "videoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '所属队伍 ID，为空则个人参赛' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "teamId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.SubmissionStatus, description: '作品状态' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SubmissionStatus),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "status", void 0);
class UpdateSubmissionDto {
}
exports.UpdateSubmissionDto = UpdateSubmissionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "demoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "repoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "videoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.SubmissionStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SubmissionStatus),
    __metadata("design:type", String)
], UpdateSubmissionDto.prototype, "status", void 0);
class CreateAnnouncementDto {
}
exports.CreateAnnouncementDto = CreateAnnouncementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '公告标题' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAnnouncementDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '公告内容' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAnnouncementDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否置顶', default: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateAnnouncementDto.prototype, "isPinned", void 0);
class JudgeSubmissionDto {
}
exports.JudgeSubmissionDto = JudgeSubmissionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '评分 0-100' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], JudgeSubmissionDto.prototype, "score", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '评语' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JudgeSubmissionDto.prototype, "feedback", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.SubmissionStatus, description: '评审后状态' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SubmissionStatus),
    __metadata("design:type", String)
], JudgeSubmissionDto.prototype, "status", void 0);
//# sourceMappingURL=hackathons.dto.js.map