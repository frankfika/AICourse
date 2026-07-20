import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CourseLevel, CostType } from '@prisma/client';

/**
 * AI 内容生成服务
 *
 * 当前使用 Google Gemini（GEMINI_API_KEY）。
 * 失败时回退到规则化生成，确保前端始终能拿到可用的草稿。
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY');
  }

  private get model(): string {
    return this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  }

  /**
   * 课程智能填充
   * @param topic 课程主题/题目（一句话）
   * @param hint  课程描述或额外要求（可选）
   */
  async generateCourse(topic: string, hint?: string): Promise<CourseDraft> {
    const fallback = this.fallbackCourse(topic, hint);
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY 未配置，使用规则化兜底');
      return fallback;
    }

    const prompt = this.buildCoursePrompt(topic, hint);
    const result = await this.callGemini(prompt, fallback);
    return result;
  }

  /**
   * 学位（Nano Degree）智能填充
   */
  async generateDegree(topic: string, hint?: string): Promise<DegreeDraft> {
    const fallback = this.fallbackDegree(topic, hint);
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY 未配置，使用规则化兜底');
      return fallback;
    }

    const prompt = this.buildDegreePrompt(topic, hint);
    const result = await this.callGemini(prompt, fallback);
    return result;
  }

  // ==================== Prompt 构造 ====================

  // Security: strip control chars and zero-width characters from user input
  // before splicing into a prompt. Limits the ability to smuggle in prompt
  // injection markers or confuse the LLM with weird unicode.
  private sanitize(input: string): string {
    return input
      .normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  private buildCoursePrompt(topic: string, hint?: string): string {
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
  "price": number, 0-9999,
  "courseType": "own | external 之一。如果题目或附加要求里出现'外部课'、'外链'、'参考课'、'配套视频'、含 http(s):// 链接,返回 external；否则 own",
  "externalUrl": "string, 如果 courseType=external, 从题目或附加要求里抽取 http(s):// 开头的 URL；否则返回空字符串"
}

用户题目：${safeTopic}
${safeHint ? `附加要求：${safeHint}` : ''}

请输出：`;
  }

  private buildDegreePrompt(topic: string, hint?: string): string {
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

  // ==================== Gemini 调用 ====================

  private async callGemini<T>(prompt: string, fallback: T): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
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
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Gemini 调用失败: ${res.status} ${text}`);
        return fallback;
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const json = this.extractJson(text);
      if (!json) {
        this.logger.warn('Gemini 返回无法解析为 JSON，使用兜底');
        return fallback;
      }
      // Security: validate LLM output against the strict schema before merging.
      // If the LLM produced something malicious or malformed, fall back instead
      // of trusting the partial result.
      const schema: z.ZodTypeAny =
        (fallback as any)?.courseType !== undefined || (fallback as any)?.instructor !== undefined
          ? CourseDraftSchema
          : DegreeDraftSchema;
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        this.logger.warn(`Gemini 输出未通过 schema 校验，使用兜底: ${parsed.error.message}`);
        return fallback;
      }
      return this.mergeWithFallback(parsed.data, fallback);
    } catch (err) {
      this.logger.error('Gemini 调用异常', err as Error);
      return fallback;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractJson(text: string): any | null {
    // 去掉 ```json ... ``` 包裹
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const raw = fence ? fence[1] : text;
    // 截取首个 { 到最后 }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private mergeWithFallback<T>(partial: any, fallback: T): T {
    // 浅合并：LLM 输出的字段优先，缺失时回退到规则化字段
    return { ...(fallback as any), ...partial } as T;
  }

  // ==================== 规则化兜底 ====================

  private fallbackCourse(topic: string, hint?: string): CourseDraft {
    const cleanTopic = topic.trim();
    const tags = this.inferTags(cleanTopic);
    const level: CourseLevel = this.inferLevel(cleanTopic);
    const costType: CostType = this.inferCostType(cleanTopic, hint);
    const duration = this.inferDuration(level);
    const courseType = this.inferCourseType(cleanTopic, hint);
    const externalUrl = this.inferExternalUrl(cleanTopic, hint);
    const placeholderThumb = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
      `${cleanTopic} AI course thumbnail minimalist brutalist design`,
    )}&image_size=landscape_16_9`;

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
      price: this.defaultPrice(costType, courseType),
      courseType,
      externalUrl,
    };
  }

  private fallbackDegree(topic: string, hint?: string): DegreeDraft {
    const cleanTopic = topic.trim();
    const tags = this.inferTags(cleanTopic);
    const costType: CostType = this.inferCostType(cleanTopic, hint);
    const placeholderThumb = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
      `${cleanTopic} Nano Degree program cover minimalist brutalist design`,
    )}&image_size=landscape_16_9`;

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

  private inferTags(topic: string): string {
    const lower = topic.toLowerCase();
    const tags: string[] = [];
    if (/(llm|大模型|gpt|claude|gemini|qwen|llama)/i.test(lower)) tags.push('LLM');
    if (/(rag|检索)/i.test(lower)) tags.push('RAG');
    if (/(agent|智能体|助手)/i.test(lower)) tags.push('Agent');
    if (/(transformer|注意力|attention)/i.test(lower)) tags.push('Transformer');
    if (/(训练|fine.?tuning|微调|pretrain)/i.test(lower)) tags.push('训练');
    if (/(推理|inference|部署|deployment)/i.test(lower)) tags.push('部署');
    if (/(代码|coding|编程|code)/i.test(lower)) tags.push('Code');
    if (/(视觉|cv|图像|vision)/i.test(lower)) tags.push('Vision');
    if (/(nlp|自然语言|文本)/i.test(lower)) tags.push('NLP');
    if (tags.length === 0) tags.push('AI', '大模型', '实战');
    return tags.slice(0, 6).join(',');
  }

  private inferLevel(topic: string): CourseLevel {
    const lower = topic.toLowerCase();
    if (/(入门|基础|零基础|beginner|intro|基础课)/i.test(lower)) return CourseLevel.Beginner;
    if (/(高阶|深入|expert|专家|高级)/i.test(lower)) return CourseLevel.Expert;
    if (/(进阶|intermediate|中级)/i.test(lower)) return CourseLevel.Intermediate;
    if (/(实战|项目|practice|project)/i.test(lower)) return CourseLevel.Advanced;
    return CourseLevel.Intermediate;
  }

  private inferCostType(topic: string, hint?: string): CostType {
    const lower = `${topic} ${hint ?? ''}`.toLowerCase();
    if (/(免费|free)/i.test(lower)) return CostType.free;
    if (/(公益|慈善|charity)/i.test(lower)) return CostType.charity;
    return CostType.paid;
  }

  private inferDuration(level: CourseLevel): string {
    switch (level) {
      case CourseLevel.Beginner:
        return '45 分钟';
      case CourseLevel.Intermediate:
        return '2 小时';
      case CourseLevel.Advanced:
        return '4 小时';
      case CourseLevel.Expert:
        return '8 小时';
      default:
        return '2 小时';
    }
  }

  private inferCourseType(topic: string, hint?: string): 'own' | 'external' {
    const lower = `${topic} ${hint ?? ''}`.toLowerCase();
    if (/(外部|外链|external|外链课|参考课|配套|视频课|录播)/i.test(lower)) return 'external';
    return 'own';
  }

  private inferExternalUrl(topic: string, hint?: string): string {
    const m = `${topic} ${hint ?? ''}`.match(/https?:\/\/[^\s)]+/i);
    return m ? m[0] : '';
  }

  private defaultPrice(costType: CostType, courseType: 'own' | 'external'): number {
    if (costType === CostType.free) return 0;
    if (costType === CostType.charity) return 0; // charity 课程是公益导向，price=0 让 admin 自行决定捐赠金额
    return courseType === 'external' ? 99 : 199;
  }
}

export interface CourseDraft {
  title: string;
  description: string;
  learningPoints: string;
  instructor: string;
  level: CourseLevel;
  duration: string;
  thumbnail: string;
  tags: string;
  costType: CostType;
  price: number;
  courseType: 'own' | 'external';
  externalUrl: string;
}

export interface DegreeDraft {
  title: string;
  description: string;
  learningPoints: string;
  icon: string;
  costType: CostType;
  price: number;
  thumbnail: string;
  tags: string;
}

// Security: validate every field coming out of the LLM. This blocks prompt
// injection from sneaking in javascript: URLs, absurd lengths, or wrong
// types. The fallback stays as a safety net.
const HttpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((u) => u.startsWith('https://') || u.startsWith('data:image/'), {
    message: 'thumbnail must be https:// or data:image/',
  });

const CourseDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  learningPoints: z.string().min(1).max(4000),
  instructor: z.string().min(1).max(100),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
  duration: z.string().min(1).max(50),
  thumbnail: HttpsUrl,
  tags: z.string().max(500),
  costType: z.enum(['free', 'paid', 'charity']),
  price: z.number().int().min(0).max(9999),
  courseType: z.enum(['own', 'external']).optional().default('own'),
  externalUrl: z.string().max(2000).optional().default(''),
});

const DegreeDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  learningPoints: z.string().min(1).max(4000),
  icon: z.string().min(1).max(50),
  costType: z.enum(['free', 'paid', 'charity']),
  price: z.number().int().min(0).max(9999),
  thumbnail: HttpsUrl,
  tags: z.string().max(500),
});
