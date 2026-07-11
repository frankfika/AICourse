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
exports.UrlImportController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const url_import_service_1 = require("./url-import.service");
const url_import_dto_1 = require("./url-import.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const courses_service_1 = require("../courses/courses.service");
const url_parser_1 = require("./url-parser");
let UrlImportController = class UrlImportController {
    constructor(urlImport, coursesService) {
        this.urlImport = urlImport;
        this.coursesService = coursesService;
    }
    async importFromUrl(dto) {
        const parsed = (0, url_parser_1.parseVideoUrl)(dto.url);
        const existing = await this.urlImport.findExistingCourseByVideoUrl(parsed.canonicalUrl);
        if (existing) {
            return {
                status: 'duplicate',
                meta: null,
                draft: null,
                course: existing,
            };
        }
        const meta = await this.urlImport.importFromUrl(dto.url);
        const draft = await this.urlImport.buildCourseDraftFromMeta(meta);
        const created = await this.coursesService.create({
            title: draft.title,
            description: draft.description,
            learningPoints: draft.learningPoints,
            instructor: draft.instructor,
            level: draft.level,
            duration: draft.duration,
            thumbnail: meta.thumbnailUrl || draft.thumbnail,
            tags: draft.tags,
            costType: draft.costType,
            price: draft.price,
            sourceVideoUrl: meta.videoUrl,
            sourcePlatform: meta.platform,
        });
        return {
            status: 'created',
            meta,
            draft,
            course: created,
        };
    }
    async importBatch(dto) {
        const results = [];
        for (const rawUrl of dto.urls) {
            try {
                const parsed = (0, url_parser_1.parseVideoUrl)(rawUrl);
                const existing = await this.urlImport.findExistingCourseByVideoUrl(parsed.canonicalUrl);
                if (existing) {
                    results.push({
                        url: rawUrl,
                        status: 'duplicate',
                        courseId: existing.id,
                    });
                    continue;
                }
                const meta = await this.urlImport.importFromUrl(rawUrl);
                const draft = await this.urlImport.buildCourseDraftFromMeta(meta);
                const created = await this.coursesService.create({
                    title: draft.title,
                    description: draft.description,
                    learningPoints: draft.learningPoints,
                    instructor: draft.instructor,
                    level: draft.level,
                    duration: draft.duration,
                    thumbnail: meta.thumbnailUrl || draft.thumbnail,
                    tags: draft.tags,
                    costType: draft.costType,
                    price: draft.price,
                    sourceVideoUrl: meta.videoUrl,
                    sourcePlatform: meta.platform,
                });
                results.push({
                    url: rawUrl,
                    status: 'created',
                    courseId: created.id,
                    draftTitle: draft.title,
                });
            }
            catch (err) {
                results.push({
                    url: rawUrl,
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return {
            total: results.length,
            created: results.filter((r) => r.status === 'created').length,
            duplicate: results.filter((r) => r.status === 'duplicate').length,
            failed: results.filter((r) => r.status === 'failed').length,
            results,
        };
    }
};
exports.UrlImportController = UrlImportController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('import-from-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [url_import_dto_1.ImportFromUrlDto]),
    __metadata("design:returntype", Promise)
], UrlImportController.prototype, "importFromUrl", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('import-batch-from-urls'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [url_import_dto_1.BatchImportFromUrlDto]),
    __metadata("design:returntype", Promise)
], UrlImportController.prototype, "importBatch", null);
exports.UrlImportController = UrlImportController = __decorate([
    (0, common_1.Controller)('courses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.admin),
    __metadata("design:paramtypes", [url_import_service_1.UrlImportService,
        courses_service_1.CoursesService])
], UrlImportController);
//# sourceMappingURL=url-import.controller.js.map