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
exports.UpdateInquiryStatusDto = exports.CreateEnterpriseInquiryDto = exports.TEAM_SIZES = void 0;
const class_validator_1 = require("class-validator");
exports.TEAM_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
class CreateEnterpriseInquiryDto {
}
exports.CreateEnterpriseInquiryDto = CreateEnterpriseInquiryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "company", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.TEAM_SIZES),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "teamSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "topic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateEnterpriseInquiryDto.prototype, "description", void 0);
class UpdateInquiryStatusDto {
}
exports.UpdateInquiryStatusDto = UpdateInquiryStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(['pending', 'contacted', 'qualified', 'closed', 'archived']),
    __metadata("design:type", String)
], UpdateInquiryStatusDto.prototype, "status", void 0);
//# sourceMappingURL=enterprise.dto.js.map