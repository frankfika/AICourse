import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instructorsApi } from './instructorsApi';

vi.mock('./api', () => ({
  default: { get: vi.fn() },
}));

import api from './api';

describe('instructorsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用公开列表、slug 详情和 id 统计端点', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [], total: 0 } })
      .mockResolvedValueOnce({ data: { id: 'inst-1', slug: 'alice' } })
      .mockResolvedValueOnce({ data: { instructorId: 'inst-1' } });

    await instructorsApi.list({ search: 'Alice', limit: 20 });
    await instructorsApi.getBySlug('alice');
    await instructorsApi.getStats('inst-1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/api/v1/instructors', {
      params: { search: 'Alice', limit: 20 },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/v1/instructors/alice');
    expect(api.get).toHaveBeenNthCalledWith(3, '/api/v1/instructors/inst-1/stats');
  });
});
