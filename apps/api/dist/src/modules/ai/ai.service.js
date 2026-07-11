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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
let AiService = AiService_1 = class AiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiService_1.name);
    }
    get apiKey() {
        return this.config.get('GEMINI_API_KEY');
    }
    get model() {
        return this.config.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    }
    async generateCourse(topic, hint) {
        const fallback = this.fallbackCourse(topic, hint);
        if (!this.apiKey) {
            this.logger.warn('GEMINI_API_KEY 未配置，使用规则化兜底');
            return fallback;
        }
        const prompt = this.buildCoursePrompt(topic, hint);
        const result = await this.callGemini(prompt, fallback);
        return result;
    }
    async generateDegree(topic, hint) {
        const fallback = this.fallbackDegree(topic, hint);
        if (!this.apiKey) {
            this.logger.warn('GEMINI_API_KEY 未配置，使用规则化兜底');
            return fallback;
        }
        const prompt = this.buildDegreePrompt(topic, hint);
        const result = await this.callGemini(prompt, fallback);
        return result;
    }
    sanitize(input) {
        return input
            .normalize('NFKC')
            .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
            .trim();
    }
    buildCoursePrompt(topic, hint) {
        const safeTopic = this.sanitize(topic).slice(0, 200);
        const safeHint = hint ? this.sanitize(hint).slice(0, 1000) : '';
        return `你是一位资深课程内容策划，擅长为 AI / 大模型 / 工程类课程撰写专业的元数据。
请根据用户的题目生成一门课程的完整元数据，严格按照下面的 JSON Schema 输出（不要解释、不要 markdown 代码块，只输出 JSON）：

{
  "title": "string, 精炼专业的课程标题（中文 12-25 字）",
  "description": "string, 2-3 句话的课程简介，30-80 字",
  "learningPoints": "string, 学习要点，3-5 条，每条一行，\\n 分隔；用动词开头",
  "instructor": "string, 建议讲师姓名（中文 2-4 字）或 'OpenCSG 教研团队'",
  "level": "Beginner | Intermediate | Advanced | Expert 之一",
  "duration": "string, 如 '45 分钟'、'2 小时'、'4 周'",
  "tags": "string, 4-6 个英文或中文标签，逗号分隔",
  "thumbnail": "string, 一个 https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=AI%20course%20thumbnail&image_size=landscape_16_9 的占位图 URL",
  "costType": "free | paid | charity 之一",
  "price": number, 0-9999
}

用户题目：${safeTopic}
${safeHint ? `附加要求：${safeHint}` : ''}

请输出：`;
    }
    buildDegreePrompt(topic, hint) {
        const safeTopic = this.sanitize(topic).slice(0, 200);
        const safeHint = hint ? this.sanitize(hint).slice(0, 1000) : '';
        return `你是一位学位项目策划师，擅长设计体系化学习路径。
请根据用户的题目生成一个 Nano Degree 的完整元数据，严格按照下面的 JSON Schema 输出（不要解释、不要 markdown 代码块，只输出 JSON）：

{
  "title": "string, 学位标题（中文 8-20 字）",
  "description": "string, 2-3 句话描述这个学位覆盖的能力和目标人群，50-120 字",
  "learningPoints": "string, 学完后获得的能力点，4-6 条，每条一行，\\n 分隔；用动词开头",
  "icon": "string, lucide-react 图标名（建议: brain / rocket / sparkles / zap / code / graduation-cap）",
  "costType": "free | paid | charity 之一",
  "price": number, 0-9999,
  "thumbnail": "string, 占位图 URL，https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Nano%20Degree%20program%20cover&image_size=landscape_16_9"
}

用户题目：${safeTopic}
${safeHint ? `附加要求：${safeHint}` : ''}

请输出：`;
    }
    async callGemini(prompt, fallback) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxOutputTokens: 1024,
                    },
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                this.logger.error(`Gemini 调用失败: ${res.status} ${text}`);
                return fallback;
            }
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            const json = this.extractJson(text);
            if (!json) {
                this.logger.warn('Gemini 返回无法解析为 JSON，使用兜底');
                return fallback;
            }
            const schema = fallback?.costType !== undefined && fallback?.level !== undefined
                ? CourseDraftSchema
                : DegreeDraftSchema;
            const parsed = schema.safeParse(json);
            if (!parsed.success) {
                this.logger.warn(`Gemini 输出未通过 schema 校验，使用兜底: ${parsed.error.message}`);
                return fallback;
            }
            return this.mergeWithFallback(parsed.data, fallback);
        }
        catch (err) {
            this.logger.error('Gemini 调用异常', err);
            return fallback;
        }
    }
    extractJson(text) {
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        const raw = fence ? fence[1] : text;
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start === -1 || end === -1)
            return null;
        try {
            return JSON.parse(raw.slice(start, end + 1));
        }
        catch {
            return null;
        }
    }
    mergeWithFallback(partial, fallback) {
        return { ...fallback, ...partial };
    }
    fallbackCourse(topic, hint) {
        const cleanTopic = topic.trim();
        const tags = this.inferTags(cleanTopic);
        const level = this.inferLevel(cleanTopic);
        const costType = this.inferCostType(cleanTopic, hint);
        const duration = this.inferDuration(level);
        const placeholderThumb = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`${cleanTopic} AI course thumbnail minimalist brutalist design`)}&image_size=landscape_16_9`;
        return {
            title: cleanTopic.slice(0, 25),
            description: `系统讲解「${cleanTopic}」的核心概念、技术原理与典型应用场景，帮助你快速建立从入门到实战的完整能力。`,
            learningPoints: [
                `理解 ${cleanTopic} 的核心概念与发展脉络`,
                `掌握关键技术与工具链的使用方法`,
                `通过实战案例完成端到端项目交付`,
                `建立可复用的最佳实践与避坑指南`,
            ].join('\n'),
            instructor: 'OpenCSG 教研团队',
            level,
            duration,
            tags,
            thumbnail: placeholderThumb,
            costType,
            price: costType === 'free' ? 0 : 199,
        };
    }
    fallbackDegree(topic, hint) {
        const cleanTopic = topic.trim();
        const tags = this.inferTags(cleanTopic);
        const costType = this.inferCostType(cleanTopic, hint);
        const placeholderThumb = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`${cleanTopic} Nano Degree program cover minimalist brutalist design`)}&image_size=landscape_16_9`;
        return {
            title: cleanTopic.slice(0, 20),
            description: `围绕「${cleanTopic}」设计体系化学习路径，覆盖从基础概念到高级实战的完整能力图谱，配套 4-6 门课程、可量化考核与企业级实战项目。`,
            learningPoints: [
                `建立 ${cleanTopic} 领域的完整知识体系`,
                `完成 4-6 门核心课程的系统化学习`,
                `在导师陪跑下完成 1 个企业级实战项目`,
                `获得 OpenCSG 官方认证学位证书`,
            ].join('\n'),
            icon: 'sparkles',
            costType,
            price: costType === 'free' ? 0 : 1999,
            thumbnail: placeholderThumb,
            tags,
        };
    }
    inferTags(topic) {
        const lower = topic.toLowerCase();
        const tags = [];
        if (/(llm|大模型|gpt|claude|gemini|qwen|llama)/i.test(lower))
            tags.push('LLM');
        if (/(rag|检索)/i.test(lower))
            tags.push('RAG');
        if (/(agent|智能体|助手)/i.test(lower))
            tags.push('Agent');
        if (/(transformer|注意力|attention)/i.test(lower))
            tags.push('Transformer');
        if (/(训练|fine.?tuning|微调|pretrain)/i.test(lower))
            tags.push('训练');
        if (/(推理|inference|部署|deployment)/i.test(lower))
            tags.push('部署');
        if (/(代码|coding|编程|code)/i.test(lower))
            tags.push('Code');
        if (/(视觉|cv|图像|vision)/i.test(lower))
            tags.push('Vision');
        if (/(nlp|自然语言|文本)/i.test(lower))
            tags.push('NLP');
        if (tags.length === 0)
            tags.push('AI', '大模型', '实战');
        return tags.slice(0, 6).join(',');
    }
    inferLevel(topic) {
        const lower = topic.toLowerCase();
        if (/(入门|基础|零基础|beginner|intro|基础课)/i.test(lower))
            return client_1.CourseLevel.Beginner;
        if (/(高阶|深入|expert|专家|高级)/i.test(lower))
            return client_1.CourseLevel.Expert;
        if (/(进阶|intermediate|中级)/i.test(lower))
            return client_1.CourseLevel.Intermediate;
        if (/(实战|项目|practice|project)/i.test(lower))
            return client_1.CourseLevel.Advanced;
        return client_1.CourseLevel.Intermediate;
    }
    inferCostType(topic, hint) {
        const lower = `${topic} ${hint ?? ''}`.toLowerCase();
        if (/(免费|free)/i.test(lower))
            return client_1.CostType.free;
        if (/(公益|慈善|charity)/i.test(lower))
            return client_1.CostType.charity;
        return client_1.CostType.paid;
    }
    inferDuration(level) {
        switch (level) {
            case client_1.CourseLevel.Beginner:
                return '45 分钟';
            case client_1.CourseLevel.Intermediate:
                return '2 小时';
            case client_1.CourseLevel.Advanced:
                return '4 小时';
            case client_1.CourseLevel.Expert:
                return '8 小时';
            default:
                return '2 小时';
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
const HttpsUrl = zod_1.z
    .string()
    .url()
    .max(2000)
    .refine((u) => u.startsWith('https://') || u.startsWith('data:image/'), {
    message: 'thumbnail must be https:// or data:image/',
});
const CourseDraftSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(1000),
    learningPoints: zod_1.z.string().min(1).max(4000),
    instructor: zod_1.z.string().min(1).max(100),
    level: zod_1.z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
    duration: zod_1.z.string().min(1).max(50),
    thumbnail: HttpsUrl,
    tags: zod_1.z.string().max(500),
    costType: zod_1.z.enum(['free', 'paid', 'charity']),
    price: zod_1.z.number().int().min(0).max(9999),
});
const DegreeDraftSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(2000),
    learningPoints: zod_1.z.string().min(1).max(4000),
    icon: zod_1.z.string().min(1).max(50),
    costType: zod_1.z.enum(['free', 'paid', 'charity']),
    price: zod_1.z.number().int().min(0).max(9999),
    thumbnail: HttpsUrl,
    tags: zod_1.z.string().max(500),
});
//# sourceMappingURL=ai.service.js.map