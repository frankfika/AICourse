import { describe, expect, it } from 'vitest';
import { buildInquiryPrefill } from './EnterprisePage';

describe('buildInquiryPrefill', () => {
  it('prefills signed-in contact and purchase context', () => {
    const params = new URLSearchParams({
      topic: '购买咨询：RAG 实战',
      description: '课程 ID：course-1',
    });

    expect(buildInquiryPrefill(params, { name: 'Alice', email: 'alice@example.com' })).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      company: '',
      teamSize: '1-10',
      phone: '',
      topic: '购买咨询：RAG 实战',
      description: '课程 ID：course-1',
    });
  });

  it('truncates URL-controlled fields to the API limits', () => {
    const params = new URLSearchParams({
      topic: 't'.repeat(300),
      description: 'd'.repeat(2500),
    });

    const result = buildInquiryPrefill(params, {
      name: 'n'.repeat(80),
      email: `${'e'.repeat(120)}@example.com`,
    });

    expect(result.name).toHaveLength(50);
    expect(result.email).toHaveLength(100);
    expect(result.topic).toHaveLength(200);
    expect(result.description).toHaveLength(2000);
  });
});
