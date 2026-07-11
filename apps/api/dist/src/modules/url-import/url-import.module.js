"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlImportModule = void 0;
const common_1 = require("@nestjs/common");
const url_import_controller_1 = require("./url-import.controller");
const url_import_service_1 = require("./url-import.service");
const ai_module_1 = require("../ai/ai.module");
const courses_module_1 = require("../courses/courses.module");
let UrlImportModule = class UrlImportModule {
};
exports.UrlImportModule = UrlImportModule;
exports.UrlImportModule = UrlImportModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, courses_module_1.CoursesModule],
        controllers: [url_import_controller_1.UrlImportController],
        providers: [url_import_service_1.UrlImportService],
        exports: [url_import_service_1.UrlImportService],
    })
], UrlImportModule);
//# sourceMappingURL=url-import.module.js.map