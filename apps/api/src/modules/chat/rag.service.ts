import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { tokenize } from './rag.util';

export type SourceType = 'course' | 'degree' | 'hackathon' | 'site';

export interface RagSource {
  type: SourceType;
  id: string;
  title: string;
  url: string;
}

export interface RagHit {
  type: SourceType;
  id: string;
  title: string;
  description: string;
  url: string;
  hitCount: number;
}

/**
 * RAG 检索: 跨 Course / NanoDegree / Hackathon / SiteSetting 做关键词匹配.
 * 不引入 vector DB, 纯 Prisma `contains` (MySQL 8 默认 collation 是 case-insensitive).
 *
 * 入参: 用户原始问题
 * 出参: 去重排序后的 top N 条命中, 供 chat.service 拼 context block.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly webBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.webBase = this.config.get<string>('WEB_BASE_URL') ?? '';
  }

  async retrieve(query: string, topN = 8): Promise<RagHit[]> {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    // 1) 对每个 token 在 4 个 source 里 OR contains 查.
    //    用 Promise.allSettled 并发, 任一 reject 不影响其他 (P1 verifier audit
    //    2026-07-24: 之前用 Promise.all, searchHackathons 抛错就让 courses/degrees/brand 全废).
    const results = await Promise.allSettled([
      this.searchCourses(tokens),
      this.searchDegrees(tokens),
      this.searchHackathons(tokens),
      this.searchBrand(tokens),
    ]);
    const courses = results[0].status === 'fulfilled' ? results[0].value : [];
    const degrees = results[1].status === 'fulfilled' ? results[1].value : [];
    const hackathons = results[2].status === 'fulfilled' ? results[2].value : [];
    const brandHits = results[3].status === 'fulfilled' ? results[3].value : [];

    // 任何 source 失败要 log, 排查时知道是哪个表挂了
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        this.logger.error(
          `RAG source[${i}] (${['courses', 'degrees', 'hackathons', 'brand'][i]}) failed`,
          (results[i] as PromiseRejectedResult).reason,
        );
      }
    }

    const merged: RagHit[] = [...courses, ...degrees, ...hackathons, ...brandHits];

    // 2) 按 hitCount 降序, 同分按 title 字典序稳定排
    merged.sort((a, b) => {
      if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
      return a.title.localeCompare(b.title);
    });

    // 3) 去重 (同 type+id)
    const seen = new Set<string>();
    const out: RagHit[] = [];
    for (const h of merged) {
      const key = `${h.type}:${h.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
      if (out.length >= topN) break;
    }
    return out;
  }

  /**
   * 单 token 命中计数: title > description > tags. 用于排序.
   */
  private countHit(hit: { title: string; description: string; tags?: string }, token: string): number {
    const t = token.toLowerCase();
    let n = 0;
    if (hit.title.toLowerCase().includes(t)) n += 3;
    if (hit.description.toLowerCase().includes(t)) n += 1;
    if (hit.tags && hit.tags.toLowerCase().includes(t)) n += 2;
    return n;
  }

  private async searchCourses(tokens: string[]): Promise<RagHit[]> {
    const where = this.buildOrWhere(['title', 'description', 'tags'], tokens);
    if (!where) return [];
    const rows = await this.prisma.course.findMany({
      where: { ...where, status: 'published' },
      select: { id: true, title: true, description: true, tags: true },
      take: 20,
    });
    return rows
      .map((r) => {
        const hitCount = tokens.reduce((acc, t) => acc + this.countHit(r, t), 0);
        return {
          type: 'course' as const,
          id: r.id,
          title: r.title,
          description: r.description,
          url: `${this.webBase}/courses/${r.id}`,
          hitCount,
        };
      })
      .filter((r) => r.hitCount > 0);
  }

  private async searchDegrees(tokens: string[]): Promise<RagHit[]> {
    const where = this.buildOrWhere(['title', 'description', 'learningPoints'], tokens);
    if (!where) return [];
    const rows = await this.prisma.nanoDegree.findMany({
      where: { ...where, status: 'published' },
      select: { id: true, title: true, description: true, learningPoints: true },
      take: 20,
    });
    return rows
      .map((r) => {
        const hitCount = tokens.reduce((acc, t) => acc + this.countHit({ ...r, tags: r.learningPoints }, t), 0);
        return {
          type: 'degree' as const,
          id: r.id,
          title: r.title,
          description: r.description,
          url: `${this.webBase}/degrees/${r.id}`,
          hitCount,
        };
      })
      .filter((r) => r.hitCount > 0);
  }

  private async searchHackathons(tokens: string[]): Promise<RagHit[]> {
    const where = this.buildOrWhere(['title', 'description', 'prizes'], tokens);
    if (!where) return [];
    const rows = await this.prisma.hackathon.findMany({
      // P0 (verifier audit 2026-07-24): HackathonStatus 是 upcoming/active/judging/finished/cancelled
      // 排除 cancelled (无意义) + finished (历史结束, 不再面向新用户)
      where: { ...where, status: { in: ['upcoming', 'active', 'judging'] } },
      select: { id: true, title: true, description: true, prizes: true },
      take: 20,
    });
    return rows
      .map((r) => {
        const hitCount = tokens.reduce((acc, t) => acc + this.countHit({ ...r, tags: r.prizes ?? '' }, t), 0);
        return {
          type: 'hackathon' as const,
          id: r.id,
          title: r.title,
          description: r.description,
          url: `${this.webBase}/hackathons/${r.id}`,
          hitCount,
        };
      })
      .filter((r) => r.hitCount > 0);
  }

  private async searchBrand(tokens: string[]): Promise<RagHit[]> {
    // SiteSetting + PageSetting 都是 key-value 配置, 拼成 brand/site context,
    // 只在 query 提到品牌 / 页面内容 (站点名 / 联系 / 关于 / 条款) 时才有效命中.
    //
    // P0 (verifier audit 2026-07-24): 之前只查 siteSetting, PageSetting 整张表漏;
    // 修复: 并发拉两表, 合并 hit, 跨 (type, key) 去重.
    const [siteSettings, pageSettings] = await Promise.all([
      this.prisma.siteSetting.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.pageSetting.findMany(),
    ]);

    const hits: RagHit[] = [];

    for (const k of siteSettings) {
      const valueStr = this.jsonToString(k.value);
      const text = `${k.key}: ${valueStr}`;
      const hitCount = tokens.reduce(
        (acc, t) => acc + (text.toLowerCase().includes(t.toLowerCase()) ? 1 : 0),
        0,
      );
      if (hitCount > 0) {
        hits.push({
          type: 'site' as const,
          id: k.key,
          title: k.key,
          description: valueStr.slice(0, 200),
          url: `${this.webBase}/`,
          hitCount,
        });
      }
    }

    for (const p of pageSettings) {
      const valueStr = this.jsonToString(p.value);
      const descStr = p.description ?? '';
      const text = `${p.page}.${p.key}: ${valueStr} ${descStr}`.trim();
      const hitCount = tokens.reduce(
        (acc, t) => acc + (text.toLowerCase().includes(t.toLowerCase()) ? 1 : 0),
        0,
      );
      if (hitCount > 0) {
        hits.push({
          type: 'site' as const,
          // 复合主键: page.key 唯一标识一条 PageSetting
          id: `${p.page}.${p.key}`,
          title: `${p.page} · ${p.key}`,
          description: valueStr.slice(0, 200),
          // PageSetting 按 page 归属, 落到首页 (跟 SiteSetting 一致)
          url: `${this.webBase}/`,
          hitCount,
        });
      }
    }

    return hits;
  }

  private jsonToString(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  private buildOrWhere(
    fields: string[],
    tokens: string[],
  ): Record<string, unknown> | null {
    const ors: Record<string, unknown>[] = [];
    for (const f of fields) {
      for (const t of tokens) {
        ors.push({ [f]: { contains: t } });
      }
    }
    return ors.length > 0 ? { OR: ors } : null;
  }
}
