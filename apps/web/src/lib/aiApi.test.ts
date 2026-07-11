import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { aiApi } from './aiApi';

vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('aiApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCourse', () => {
    it('should POST to /ai/generate-course and return draft', async () => {
      const mockDraft = {
        title: 'RAG 系统实战',
        description: '企业级 RAG',
        learningPoints: '理解 RAG',
        instructor: 'OpenCSG',
        level: 'Intermediate' as const,
        duration: '2 小时',
        tags: 'RAG,LLM',
        thumbnail: 'https://example.com',
        costType: 'paid' as const,
        price: 199,
      };
      (api.post as any).mockResolvedValue({ data: { draft: mockDraft } });

      const result = await aiApi.generateCourse('RAG 系统实战');

      expect(api.post).toHaveBeenCalledWith('/api/v1/ai/generate-course', {
        topic: 'RAG 系统实战',
        hint: undefined,
      });
      expect(result).toEqual(mockDraft);
    });

    it('should pass hint when provided', async () => {
      (api.post as any).mockResolvedValue({ data: { draft: {} } });

      await aiApi.generateCourse('topic', 'extra hint');

      expect(api.post).toHaveBeenCalledWith('/api/v1/ai/generate-course', {
        topic: 'topic',
        hint: 'extra hint',
      });
    });
  });

  describe('generateDegree', () => {
    it('should POST to /ai/generate-degree and return draft', async () => {
      const mockDraft = {
        title: 'AI 全栈工程师',
        description: '从零到精通',
        learningPoints: '完整知识',
        icon: 'sparkles',
        costType: 'paid' as const,
        price: 1999,
        thumbnail: 'https://example.com',
        tags: 'AI',
      };
      (api.post as any).mockResolvedValue({ data: { draft: mockDraft } });

      const result = await aiApi.generateDegree('AI 全栈工程师');

      expect(api.post).toHaveBeenCalledWith('/api/v1/ai/generate-degree', {
        topic: 'AI 全栈工程师',
        hint: undefined,
      });
      expect(result).toEqual(mockDraft);
    });
  });
});