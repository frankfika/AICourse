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
var UrlImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlImportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const url_parser_1 = require("./url-parser");
const ai_service_1 = require("../ai/ai.service");
const FETCH_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 1;
let UrlImportService = UrlImportService_1 = class UrlImportService {
    constructor(aiService, prisma) {
        this.aiService = aiService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(UrlImportService_1.name);
    }
    async importFromUrl(rawUrl) {
        const parsed = (0, url_parser_1.parseVideoUrl)(rawUrl);
        const meta = parsed.platform === 'youtube'
            ? await this.fetchYouTube(parsed)
            : await this.fetchBilibili(parsed);
        if (parsed.platform === 'youtube') {
            meta.thumbnailUrl = `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg`;
        }
        else if (parsed.platform === 'bilibili') {
            meta.thumbnailUrl = this.cleanBilibiliThumbnail(meta.thumbnailUrl);
        }
        return meta;
    }
    cleanBilibiliThumbnail(raw) {
        if (!raw)
            return raw;
        try {
            const u = new URL(raw);
            u.searchParams.delete('x-oss-process');
            return u.toString();
        }
        catch {
            return raw;
        }
    }
    async buildCourseDraftFromMeta(meta) {
        const topic = `${meta.title} — ${meta.authorName}`.slice(0, 200);
        return this.aiService.generateCourse(topic, meta.description.slice(0, 500));
    }
    async findExistingCourseByVideoUrl(canonicalUrl) {
        return this.prisma.course.findUnique({
            where: { sourceVideoUrl: canonicalUrl },
        });
    }
    async importMany(rawUrls) {
        const results = [];
        for (const rawUrl of rawUrls) {
            try {
                const r = await this.importFromUrl(rawUrl);
                results.push({ url: rawUrl, status: 'created' });
            }
            catch (err) {
                results.push({
                    url: rawUrl,
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return results;
    }
    async fetchYouTube(parsed) {
        const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;
        const data = await this.safeFetchJson(url, 'YouTube oEmbed');
        return {
            title: String(data?.title ?? '').slice(0, 200),
            authorName: String(data?.author_name ?? '').slice(0, 100),
            description: '',
            thumbnailUrl: String(data?.thumbnail_url ?? ''),
            videoUrl: parsed.canonicalUrl,
            embedUrl: parsed.embedUrl,
            platform: 'youtube',
            videoId: parsed.videoId,
        };
    }
    async fetchBilibili(parsed) {
        const url = `https://api.bilibili.com/x/web-interface/view?bvid=${parsed.videoId}`;
        const data = await this.safeFetchJson(url, 'Bilibili API');
        const info = (data?.data ?? {});
        return {
            title: String(info.title ?? '').slice(0, 200),
            authorName: String(info.owner?.name ?? '').slice(0, 100),
            description: String(info.desc ?? '').slice(0, 4000),
            thumbnailUrl: String(info.pic ?? ''),
            videoUrl: parsed.canonicalUrl,
            embedUrl: parsed.embedUrl,
            platform: 'bilibili',
            videoId: parsed.videoId,
        };
    }
    async safeFetchJson(url, label) {
        const allowedHosts = new Set([
            'www.youtube.com',
            'i.ytimg.com',
            'api.bilibili.com',
        ]);
        const target = new URL(url);
        if (!allowedHosts.has(target.hostname)) {
            throw new common_1.BadRequestException(`Refusing to call non-allowlisted host: ${target.hostname}`);
        }
        let lastErr = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'OpenCSG-Academy-Importer/1.0',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    },
                });
                if (!res.ok) {
                    if (res.status >= 500 && attempt < MAX_RETRIES) {
                        lastErr = new Error(`${label} responded ${res.status}`);
                        await this.sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    throw new common_1.BadRequestException(`${label} responded ${res.status}`);
                }
                return (await res.json());
            }
            catch (err) {
                if (err.name === 'AbortError') {
                    lastErr = new Error(`${label} timed out after ${FETCH_TIMEOUT_MS}ms`);
                }
                else if (err instanceof common_1.BadRequestException) {
                    throw err;
                }
                else {
                    lastErr = err;
                }
                if (attempt < MAX_RETRIES) {
                    await this.sleep(RETRY_DELAY_MS);
                    continue;
                }
            }
            finally {
                clearTimeout(timer);
            }
        }
        this.logger.error(`${label} fetch failed`, lastErr);
        throw new common_1.BadRequestException(`${label} unreachable after ${MAX_RETRIES + 1} attempts`);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.UrlImportService = UrlImportService;
exports.UrlImportService = UrlImportService = UrlImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        prisma_service_1.PrismaService])
], UrlImportService);
//# sourceMappingURL=url-import.service.js.map