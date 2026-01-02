import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Router, Response, NextFunction, Request } from 'express';
import { createMockRequest, createMockResponse, createMockNext, mockUser, mockPost } from '../setup.js';
import { PostType, AnimalType, PostStatus, PetPostWithUser } from '../../types/index.js';

// Create mocks before importing the router
const mockQueryFn = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

jest.unstable_mockModule('../../db/index.js', () => ({
  query: mockQueryFn,
}));

// Mock auth middleware
const mockRequireAuth = jest.fn((req: any, _res: any, next: any) => {
  req.user = mockUser;
  req.userId = mockUser.id;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  AuthenticatedRequest: {},
}));

// Mock rate limiter
jest.unstable_mockModule('../../middleware/security.js', () => ({
  createPostLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Import after mocks are set up
const postsModule = await import('../../routes/posts.js');
const postsRouter = postsModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  // Find the handler from the router's stack
  const layer = (postsRouter as any).stack.find((l: any) => {
    const routePath = l.route?.path;
    const routeMethod = l.route?.methods?.[method];
    return routePath === path && routeMethod;
  });

  if (!layer) {
    throw new Error(`Handler not found for ${method.toUpperCase()} ${path}`);
  }

  // Execute all handlers in the route
  const handlers = layer.route.stack.map((s: any) => s.handle);
  for (const handler of handlers) {
    await handler(req, res, next);
  }
};

describe('Posts Routes', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET / - Get all posts', () => {
    it('should return all posts', async () => {
      const posts = [mockPost];
      mockQueryFn.mockResolvedValueOnce({ rows: posts, rowCount: 1 });

      mockReq.query = { limit: '50', offset: '0' };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts,
        total: 1,
      });
    });

    it('should filter by type', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = { type: PostType.LOST };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('AND p.type = $1'),
        expect.arrayContaining([PostType.LOST])
      );
    });

    it('should filter by animal_type', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = { animal_type: AnimalType.DOG };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('AND p.animal_type = $1'),
        expect.arrayContaining([AnimalType.DOG])
      );
    });

    it('should filter by status', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = { status: PostStatus.OPEN };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('AND p.status = $1'),
        expect.arrayContaining([PostStatus.OPEN])
      );
    });

    it('should apply multiple filters', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = { type: PostType.FOUND, animal_type: AnimalType.CAT };
      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('AND p.type = $1'),
        expect.arrayContaining([PostType.FOUND, AnimalType.CAT])
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      mockQueryFn.mockRejectedValueOnce(error);

      await executeHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /my - Get current user posts', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
    });

    it('should return user posts', async () => {
      const posts = [mockPost];
      mockQueryFn.mockResolvedValueOnce({ rows: posts, rowCount: 1 });

      await executeHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_id = $1'),
        [mockUser.id]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        posts,
        total: 1,
      });
    });

    it('should return empty array if no posts', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await executeHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts: [],
        total: 0,
      });
    });
  });

  describe('GET /:id - Get single post', () => {
    it('should return post by id', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [mockPost], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      await executeHandler('get', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(mockPost);
    });

    it('should return 404 if post not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { id: 'nonexistent-id' };
      await executeHandler('get', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Объявление не найдено',
        })
      );
    });
  });

  describe('POST / - Create post', () => {
    const validPostData = {
      type: PostType.LOST,
      animal_type: AnimalType.DOG,
      title: 'Lost Golden Retriever',
      description: 'A friendly golden retriever went missing near the park',
      location: 'Moscow, Central Park',
      contact_info: '+7 999 123 4567',
    };

    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
    });

    it('should create a new post', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [mockPost], rowCount: 1 });

      mockReq.body = validPostData;
      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockPost);
    });

    it('should create post with optional fields', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [mockPost], rowCount: 1 });

      mockReq.body = {
        ...validPostData,
        latitude: 55.7558,
        longitude: 37.6173,
        reward: '10000 руб.',
        image_url: 'https://example.com/dog.jpg',
      };
      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([55.7558, 37.6173, '10000 руб.', 'https://example.com/dog.jpg'])
      );
    });

    it('should validate required fields', async () => {
      mockReq.body = { type: PostType.LOST }; // Missing required fields
      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('PUT /:id - Update post', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
    });

    it('should update post if owner', async () => {
      // First query: ownership check
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      // Second query: update
      mockQueryFn.mockResolvedValueOnce({ rows: [mockPost], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      mockReq.body = { title: 'Updated Title Here' };
      await executeHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(mockPost);
    });

    it('should return 404 if post not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { id: 'nonexistent-id' };
      mockReq.body = { title: 'Updated Title' };
      await executeHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Объявление не найдено',
        })
      );
    });

    it('should return 403 if not owner', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: 'different-user-id' }], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      mockReq.body = { title: 'Updated Title' };
      await executeHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Нет прав на редактирование этого объявления',
        })
      );
    });

    it('should return 400 if no fields to update', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      mockReq.body = {};
      await executeHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Нет полей для обновления',
        })
      );
    });

    it('should update status to RESOLVED', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      mockQueryFn.mockResolvedValueOnce({ rows: [{ ...mockPost, status: PostStatus.RESOLVED }], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      mockReq.body = { status: PostStatus.RESOLVED };
      await executeHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('status = $1'),
        expect.arrayContaining([PostStatus.RESOLVED])
      );
    });
  });

  describe('DELETE /:id - Delete post', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
    });

    it('should delete post if owner', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      await executeHandler('delete', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(204);
    });

    it('should return 404 if post not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { id: 'nonexistent-id' };
      await executeHandler('delete', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Объявление не найдено',
        })
      );
    });

    it('should return 403 if not owner', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: 'different-user-id' }], rowCount: 1 });

      mockReq.params = { id: mockPost.id };
      await executeHandler('delete', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Нет прав на удаление этого объявления',
        })
      );
    });
  });
});
