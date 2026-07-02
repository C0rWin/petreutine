import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AnimalType, PostStatus, PostType } from '../../types/index.js';
import { createMockNext, createMockRequest, createMockResponse, mockPost } from '../setup.js';

// Create mocks before importing the router
const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

jest.unstable_mockModule('../../db/index.js', () => ({
  query: mockQueryFn,
}));

// Import after mocks are set up
const searchModule = await import('../../routes/search.js');
const searchRouter = searchModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  const layer = (searchRouter as any).stack.find((l: any) => {
    const routePath = l.route?.path;
    const routeMethod = l.route?.methods?.[method];
    return routePath === path && routeMethod;
  });

  if (!layer) {
    throw new Error(`Handler not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((s: any) => s.handle);
  for (const handler of handlers) {
    await handler(req, res, next);
  }
};

describe('Search Routes', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET / - Full-text search', () => {
    it('should return posts without query (list all)', async () => {
      const posts = [mockPost];
      mockQueryFn
        .mockResolvedValueOnce({ rows: posts, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      mockReq.query = {};
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts,
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should search with query string', async () => {
      const posts = [mockPost];
      mockQueryFn
        .mockResolvedValueOnce({ rows: posts, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      mockReq.query = { q: 'golden retriever' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('plainto_tsquery'),
        expect.arrayContaining(['golden retriever'])
      );
    });

    it('should filter by type', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { type: PostType.LOST };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.type ='),
        expect.arrayContaining([PostType.LOST])
      );
    });

    it('should filter by animal_type', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { animal_type: AnimalType.CAT };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.animal_type ='),
        expect.arrayContaining([AnimalType.CAT])
      );
    });

    it('should filter by location', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { location: 'Moscow' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining("p.location ILIKE '%'"),
        expect.arrayContaining(['Moscow'])
      );
    });

    it('should filter by status', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { status: PostStatus.OPEN };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.status ='),
        expect.arrayContaining([PostStatus.OPEN])
      );
    });

    it('should filter by date range (created_at)', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      const from = '2026-06-01T00:00:00.000Z';
      const to = '2026-07-01T00:00:00.000Z';
      mockReq.query = { date_from: from, date_to: to };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      const [sql, params] = mockQueryFn.mock.calls[0];
      expect(sql).toContain('p.created_at >=');
      expect(sql).toContain('p.created_at <=');
      // Zod coerces the ISO strings to Date objects.
      expect((params as unknown[]).some(p => p instanceof Date)).toBe(true);
    });

    it('should filter by geo radius when lat/lon/radius are provided', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { lat: '55.75', lon: '37.61', radius_km: '10' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      const [sql, params] = mockQueryFn.mock.calls[0];
      expect(sql).toContain('acos');
      expect(sql).toContain('p.latitude IS NOT NULL');
      expect(params as unknown[]).toEqual(expect.arrayContaining([55.75, 37.61, 10]));
    });

    it('should ignore geo radius and use text location when radius is missing', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { lat: '55.75', lon: '37.61', location: 'Moscow' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      const [sql] = mockQueryFn.mock.calls[0];
      expect(sql).not.toContain('acos');
      expect(sql).toContain("p.location ILIKE '%'");
    });

    it('should apply pagination', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 });

      mockReq.query = { limit: '10', offset: '20' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts: [],
        total: 100,
        limit: 10,
        offset: 20,
      });
    });

    it('should combine multiple filters', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = {
        q: 'cat',
        type: PostType.FOUND,
        animal_type: AnimalType.CAT,
        status: PostStatus.OPEN,
      };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.type ='),
        expect.arrayContaining(['cat', PostType.FOUND, AnimalType.CAT, PostStatus.OPEN])
      );
    });

    it('should order by relevance when searching', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { q: 'dog' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY relevance DESC'),
        expect.any(Array)
      );
    });

    it('should order by date when not searching', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = { type: PostType.LOST };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringMatching(/ORDER BY p\.created_at DESC\s+LIMIT/),
        expect.any(Array)
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      mockQueryFn.mockRejectedValueOnce(error);

      mockReq.query = {};
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should return default limit and offset', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      mockReq.query = {};
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 0,
        })
      );
    });
  });

  describe('GET /matches/:postId - Find potential matches', () => {
    const sourcePost = {
      type: 'LOST',
      animal_type: AnimalType.DOG,
      description: 'Golden retriever went missing',
      location: 'Moscow, Park',
    };

    it('should find matches for a lost post', async () => {
      const matchingPost = {
        ...mockPost,
        type: 'FOUND',
        match_score: 0.8,
        location: 'Moscow, Park',
        animal_type: AnimalType.DOG,
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingPost], rowCount: 1 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('p.type = $4'),
        expect.arrayContaining(['FOUND'])
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        matches: expect.arrayContaining([
          expect.objectContaining({
            confidence: expect.any(Number),
            reason: expect.any(String),
          }),
        ]),
      });
    });

    it('should find matches for a found post', async () => {
      const foundPost = { ...sourcePost, type: 'FOUND' };
      mockQueryFn
        .mockResolvedValueOnce({ rows: [foundPost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('p.type = $4'),
        expect.arrayContaining(['LOST'])
      );
    });

    it('should return 404 if post not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'nonexistent-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Post not found' });
    });

    it('should respect limit parameter', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'source-post-id' };
      mockReq.query = { limit: '5' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.arrayContaining([5])
      );
    });

    it('should cap limit at 50', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'source-post-id' };
      mockReq.query = { limit: '100' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.arrayContaining([50])
      );
    });

    it('should generate match reason for same animal type', async () => {
      const matchingPost = {
        ...mockPost,
        type: 'FOUND',
        match_score: 0.3,
        location: 'Other location',
        animal_type: AnimalType.DOG,
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingPost], rowCount: 1 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0] as {
        matches: { reason: string; confidence: number }[];
      };
      expect(response.matches[0].reason).toContain('Тот же тип животного');
    });

    it('should cap confidence at 1', async () => {
      const matchingPost = {
        ...mockPost,
        type: 'FOUND',
        match_score: 1.5,
        location: 'Moscow',
        animal_type: AnimalType.DOG,
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingPost], rowCount: 1 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0] as {
        matches: { reason: string; confidence: number }[];
      };
      expect(response.matches[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      mockQueryFn.mockRejectedValueOnce(error);

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
