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
exports.BatchImportFromUrlDto = exports.ImportFromUrlDto = void 0;
const class_validator_1 = require("class-validator");
class ImportFromUrlDto {
}
exports.ImportFromUrlDto = ImportFromUrlDto;
__decorate([
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'] }),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", String)
], ImportFromUrlDto.prototype, "url", void 0);
class BatchImportFromUrlDto {
}
exports.BatchImportFromUrlDto = BatchImportFromUrlDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(20),
    __metadata("design:type", Array)
], BatchImportFromUrlDto.prototype, "urls", void 0);
//# sourceMappingURL=url-import.dto.js.map