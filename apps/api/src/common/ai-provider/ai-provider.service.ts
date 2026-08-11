import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiConfigService, assertSafeAiBaseUrl } from '../../modules/ai/ai-config.service';

export interface GenerateTextOptions {
  maxOutputTokens?: number;
  temperature?: number;
}

interface ProviderCredentials {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
}

/**
 * 平台级 OpenAI-compatible 文本生成客户端。
 *
 * 管理员只需配置 provider 标识、Base URL、Model 和 API Key。所有平台 AI
 * 功能统一调用 `/chat/completions`，因此可接 OpenAI、DeepSeek、通义千问、
 * OpenRouter、硅基流动、Gemini OpenAI compatibility 以及自建兼容网关。
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(private readonly aiConfig: AiConfigService) {}

  async generateText(prompt: string, opts?: GenerateTextOptions): Promise<string> {
    const config = await this.aiConfig.getActiveGlobal();
    if (!config) {
      throw new ServiceUnavailableException(
        'AI 服务未配置，请由管理员在“管理后台 → AI 配置”中保存并验证 OpenAI-compatible 服务',
      );
    }

    return this.callOpenAiCompatible(config, prompt, opts);
  }

  /** Verify 可以测试刚保存但尚未验证/启用的指定配置。 */
  async verify(provider: string): Promise<string> {
    const config = await this.aiConfig.getForVerification(provider);
    if (!config) throw new ServiceUnavailableException('找不到可验证的 AI 配置');
    return this.callOpenAiCompatible(config, 'Reply with the single word: ok', {
      maxOutputTokens: 16,
      temperature: 0,
    });
  }

  private async callOpenAiCompatible(
    config: ProviderCredentials,
    prompt: string,
    opts?: GenerateTextOptions,
  ): Promise<string> {
    if (!config.baseUrl) {
      throw new ServiceUnavailableException('AI Base URL 未配置');
    }
    const baseUrl = await assertSafeAiBaseUrl(config.provider, config.baseUrl);
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts?.temperature ?? 0.7,
          max_tokens: opts?.maxOutputTokens ?? 800,
        }),
        signal: controller.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.error(
          `OpenAI-compatible 调用失败: provider=${config.provider} status=${response.status} ${detail.slice(0, 300)}`,
        );
        throw new ServiceUnavailableException('AI 服务暂时不可用，请检查 Key、模型或 Base URL');
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((part: any) => part?.text ?? '').join('')
          : '';
      if (!text.trim()) {
        throw new ServiceUnavailableException('AI 服务返回了空内容');
      }
      return text;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('OpenAI-compatible 调用异常', error as Error);
      throw new InternalServerErrorException('AI 服务调用失败');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
