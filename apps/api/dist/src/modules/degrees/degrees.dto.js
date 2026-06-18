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
exports.LinkCoursesDto = exports.UpdateDegreeDto = exports.CreateDegreeDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class DegreeCourseLinkDto {
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DegreeCourseLinkDto.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DegreeCourseLinkDto.prototype, "orderIndex", void 0);
class CreateDegreeDto {
}
exports.CreateDegreeDto = CreateDegreeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "learningPoints", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateDegreeDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "icon", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CostType),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "costType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "thumbnail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CourseStatus),
    __metadata("design:type", String)
], CreateDegreeDto.prototype, "status", void 0);
class UpdateDegreeDto extends CreateDegreeDto {
}
exports.UpdateDegreeDto = UpdateDegreeDto;
class LinkCoursesDto {
}
exports.LinkCoursesDto = LinkCoursesDto;
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DegreeCourseLinkDto),
    __metadata("design:type", Array)
], LinkCoursesDto.prototype, "courses", void 0);
//# sourceMappingURL=degrees.dto.js.map