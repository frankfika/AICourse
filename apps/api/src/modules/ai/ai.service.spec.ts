import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { CourseLevel, CostType } from '@prisma/client';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('generateCourse — fallback path (no API key)', () => {
    it('should return a valid course draft', async () => {
      const result = await service.generateCourse('RAG 系统实战');
      expect(result).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        learningPoints: expect.any(String),
        instructor: expect.any(String),
        level: expect.stringMatching(/Beginner|Intermediate|Advanced|Expert/),
        duration: expect.any(String),
        tags: expect.any(String),
        thumbnail: expect.stringContaining('coresg-normal'),
        costType: expect.stringMatching(/free|paid|charity/),
        price: expect.any(Number),
      });
    });

    it('should extract RAG tag from topic containing rag', async () => {
      const result = await service.generateCourse('RAG 系统实战：企业知识库');
      expect(result.tags).toContain('RAG');
    });

    it('should extract LLM tag from topic with llm', async () => {
      const result = await service.generateCourse('LLM 大模型微调实战');
      expect(result.tags).toContain('LLM');
    });

    it('should infer Beginner level for 入门 topic', async () => {
      const result = await service.generateCourse('LLM 入门基础课');
      expect(result.level).toBe(CourseLevel.Beginner);
    });

    it('should infer Expert level for 高级 topic', async () => {
      const result = await service.generateCourse('RAG 高级调优专家课');
      expect(result.level).toBe(CourseLevel.Expert);
    });

    it('should infer Expert level for 高阶 topic (legacy keyword)', async () => {
      const result = await service.generateCourse('RAG 高阶调优专家课');
      expect(result.level).toBe(CourseLevel.Expert);
    });

    it('should infer free costType when free in topic', async () => {
      const result = await service.generateCourse('RAG 入门免费课程');
      expect(result.costType).toBe(CostType.free);
    });

    it('should set price=0 for charity courses', async () => {
      const result = await service.generateCourse('AI 公益课为乡村教师');
      expect(result.costType).toBe(CostType.charity);
      expect(result.price).toBe(0);
    });

    it('should default to own courseType for non-external hint', async () => {
      const result = await service.generateCourse('RAG 系统');
      expect(result.courseType).toBe('own');
      expect(result.externalUrl).toBe('');
    });

    it('should infer external courseType when hint contains 外部 or URL', async () => {
      const result = await service.generateCourse('OpenAI 配套视频课', '参考 https://cookbook.openai.com');
      expect(result.courseType).toBe('external');
      expect(result.externalUrl).toBe('https://cookbook.openai.com');
    });

    it('should set external courseType price to 99', async () => {
      const result = await service.generateCourse('外部课', 'https://example.com');
      expect(result.courseType).toBe('external');
      expect(result.price).toBe(99);
    });

    it('should use advanced duration for Advanced level (实战 in topic)', async () => {
      const result = await service.generateCourse('RAG 系统实战');
      // "实战" in topic -> Advanced -> "4 小时"
      expect(result.level).toBe(CourseLevel.Advanced);
      expect(result.duration).toBe('4 小时');
    });

    it('should use intermediate duration for Intermediate level (default)', async () => {
      const result = await service.generateCourse('RAG 系统');
      // No level keyword -> default Intermediate -> "2 小时"
      expect(result.level).toBe(CourseLevel.Intermediate);
      expect(result.duration).toBe('2 小时');
    });
  });

  describe('generateDegree — fallback path', () => {
    it('should return a valid degree draft', async () => {
      const result = await service.generateDegree('AI 全栈工程师');
      expect(result).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        learningPoints: expect.any(String),
        icon: expect.any(String),
        costType: expect.stringMatching(/free|paid|charity/),
        price: expect.any(Number),
        thumbnail: expect.stringContaining('coresg-normal'),
        tags: expect.any(String),
      });
    });

    it('should extract Agent tag from topic with agent', async () => {
      const result = await service.generateDegree('Agent 智能体开发');
      expect(result.tags).toContain('Agent');
    });
  });
});
