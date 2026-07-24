import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConfigService } from '../../modules/ai/ai-config.service';

/**
 * 共享 Gemini 调用 helper
 *
 * 提取自 ai.service.callGemini,剥离 JSON 解析 / schema 校验 / fallback merging,
 * 只保留"prompt -> text"的核心调用. ai.service (JSON 草稿) 和 chat.service
 * (RAG 文本问答) 都通过本 service 调 Gemini, 避免重复 fetch 逻辑.
 *
 * P0 修复(2026-07-24): API key 优先级
 *   1) DB ai_configs 表 (admin 后台配)
 *   2) env GEMINI_API_KEY (本地 dev fallback)
 * Model 同步: DB > env > 默认 gemini-2.0-flash.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aiConfig: AiConfigService,
  ) {}

  private async getCreds(): Promise<{ apiKey: string; model: string }> {
    const fromDb = await this.aiConfig.getActive('gemini');
    if (fromDb) return fromDb;
    const envKey = this.config.get<string>('GEMINI_API_KEY');
    if (envKey) {
      return {
        apiKey: envKey,
        model: this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash',
      };
    }
    throw new ServiceUnavailableException('AI 服务未配置(后台 AI 配置 + env GEMINI_API_KEY 都为空)');
  }

  /**
   * 调 Gemini 生成文本. 失败抛 ServiceUnavailableException, 让调用方决定
   * 是回退 (ai.service 用规则化草稿) 还是直接返错 (chat.service 不允许假数据).
   */
  async generateText(
    prompt: string,
    opts?: { maxOutputTokens?: number; temperature?: number },
  ): Promise<string> {
    const { apiKey, model } = await this.getCreds();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts?.temperature ?? 0.7,
            topP: 0.9,
            maxOutputTokens: opts?.maxOutputTokens ?? 800,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Gemini 调用失败: ${res.status} ${text.slice(0, 500)}`);
        throw new ServiceUnavailableException('AI 服务暂时不可用');
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return text;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error('Gemini 调用异常', err as Error);
      throw new InternalServerErrorException('AI 服务调用失败');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
