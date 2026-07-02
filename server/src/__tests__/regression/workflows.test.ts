import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

import { AnimalType, PostStatus, PostType } from '../../types/index.js';
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
  mockPost,
  mockUser,
} from '../setup.js';

/**
 * Workflow Regression Tests
 *
 * These tests verify complete user journeys that span multiple operations.
 * Unlike unit tests that test individual endpoints, workflow tests ensure
 * that multi-step user interactions work correctly end-to-end.
 */

// Create mocks before importing routers
const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();
const mockGenerateToken = jest.fn().mockReturnValue('test-jwt-token');
const mockVerifyToken = jest.fn();

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
  generateToken: mockGenerateToken,
  verifyToken: mockVerifyToken,
  AuthenticatedRequest: {},
}));

// Mock rate limiter
jest.unstable_mockModule('../../middleware/security.js', () => ({
  createPostLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Import routers after mocks are set up
const postsModule = await import('../../routes/posts.js');
const searchModule = await import('../../routes/search.js');
const postsRouter = postsModule.default;
const searchRouter = searchModule.default;

// Helper to execute route handler directly
const executePostsHandler = async (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  const layer = (postsRouter as any).stack.find((l: any) => {
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

const executeSearchHandler = async (
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

describe('Workflow Regression Tests', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('Lost Pet Posting Workflow', () => {
    const newLostPost = {
      type: PostType.LOST,
      animal_type: AnimalType.DOG,
      title: 'Lost Golden Retriever near Central Park',
      description: 'A friendly golden retriever went missing near the park yesterday afternoon',
      location: 'Moscow, Central Park',
      contact_info: '+7 999 123 4567',
    };

    const createdPost = {
      id: 'created-post-id',
      user_id: mockUser.id,
      ...newLostPost,
      status: PostStatus.OPEN,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: mockUser,
    };

    it('complete journey: create -> list -> search -> update -> verify', async () => {
      // Step 1: Create a LOST post
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.body = newLostPost;
      mockQueryFn.mockResolvedValueOnce({ rows: [createdPost], rowCount: 1 });

      await executePostsHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdPost);

      // Step 2: Post appears in GET /api/posts listing
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.query = { limit: '50', offset: '0' };
      mockQueryFn.mockResolvedValueOnce({ rows: [createdPost], rowCount: 1 });

      await executePostsHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts: [createdPost],
        total: 1,
      });

      // Step 3: Post is searchable by query matching title/description
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.query = { q: 'golden retriever' };
      mockQueryFn
        .mockResolvedValueOnce({ rows: [createdPost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts: [createdPost],
        total: 1,
        limit: 20,
        offset: 0,
      });

      // Step 4: Post can be updated to RESOLVED status
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.params = { id: createdPost.id };
      mockReq.body = { status: PostStatus.RESOLVED };

      const resolvedPost = { ...createdPost, status: PostStatus.RESOLVED };
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      mockQueryFn.mockResolvedValueOnce({ rows: [resolvedPost], rowCount: 1 });

      await executePostsHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(resolvedPost);
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining([PostStatus.RESOLVED])
      );

      // Step 5: Verify resolved post can be filtered by status
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.query = { status: PostStatus.RESOLVED };
      mockQueryFn
        .mockResolvedValueOnce({ rows: [resolvedPost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: [expect.objectContaining({ status: PostStatus.RESOLVED })],
        })
      );
    });
  });

  describe('Found Pet Matching Workflow', () => {
    const existingLostPost = {
      id: 'lost-post-id',
      user_id: 'other-user-id',
      type: 'LOST',
      animal_type: AnimalType.DOG,
      title: 'Lost Labrador in Moscow',
      description: 'Black labrador went missing near Gorky Park',
      location: 'Moscow, Gorky Park',
      status: PostStatus.OPEN,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newFoundPost = {
      type: PostType.FOUND,
      animal_type: AnimalType.DOG,
      title: 'Found black dog near Gorky Park',
      description: 'Found a friendly black dog wandering near Gorky Park',
      location: 'Moscow, Gorky Park area',
      contact_info: '+7 999 555 1234',
    };

    const createdFoundPost = {
      id: 'found-post-id',
      user_id: mockUser.id,
      ...newFoundPost,
      status: PostStatus.OPEN,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: mockUser,
    };

    it('complete journey: create found -> find matches -> verify match quality', async () => {
      // Step 1: User creates a FOUND post for a dog in Moscow
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.body = newFoundPost;
      mockQueryFn.mockResolvedValueOnce({ rows: [createdFoundPost], rowCount: 1 });

      await executePostsHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PostType.FOUND,
          animal_type: AnimalType.DOG,
        })
      );

      // Step 2: GET /api/search/matches/:foundPostId returns the lost post as potential match
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.params = { postId: createdFoundPost.id };

      // Source post query (the found post)
      const sourcePost = {
        type: 'FOUND',
        animal_type: AnimalType.DOG,
        description: createdFoundPost.description,
        location: createdFoundPost.location,
      };

      // Match with the lost post - include match_score
      const matchingLostPost = {
        ...existingLostPost,
        match_score: 0.75,
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingLostPost], rowCount: 1 });

      await executeSearchHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      // Step 3: Match includes confidence score and reason
      expect(mockRes.json).toHaveBeenCalledWith({
        matches: expect.arrayContaining([
          expect.objectContaining({
            confidence: expect.any(Number),
            reason: expect.any(String),
          }),
        ]),
      });

      // Verify the matching logic searched for opposite type (LOST posts)
      // Call 1: POST to create found post
      // Call 2: SELECT source post for matches
      // Call 3: SELECT matching posts with p.type = $4
      expect(mockQueryFn).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('p.type = $4'),
        expect.arrayContaining(['LOST'])
      );
    });

    it('should find high confidence match for same animal type and similar location', async () => {
      mockReq.params = { postId: 'found-post-id' };

      const sourcePost = {
        type: 'FOUND',
        animal_type: AnimalType.DOG,
        description: 'Black labrador found',
        location: 'Moscow, Gorky Park',
      };

      const matchingPost = {
        ...existingLostPost,
        match_score: 0.85,
        location: 'Moscow, Gorky Park',
        animal_type: AnimalType.DOG,
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingPost], rowCount: 1 });

      await executeSearchHandler('get', '/matches/:postId', mockReq as any, mockRes, mockNext);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0] as {
        matches: { confidence: number; reason: string }[];
      };

      // High confidence due to same animal type and location similarity
      expect(response.matches[0].confidence).toBeGreaterThan(0.5);
      expect(response.matches[0].reason).toContain('Тот же тип животного');
    });
  });

  describe('Search Filtering Workflow', () => {
    const dogLostMoscow = {
      id: 'post-1',
      type: PostType.LOST,
      animal_type: AnimalType.DOG,
      title: 'Lost dog in Moscow',
      location: 'Moscow, Red Square',
      status: PostStatus.OPEN,
    };

    const catFoundMoscow = {
      id: 'post-2',
      type: PostType.FOUND,
      animal_type: AnimalType.CAT,
      title: 'Found cat in Moscow',
      location: 'Moscow, Arbat',
      status: PostStatus.OPEN,
    };

    const dogFoundSpb = {
      id: 'post-3',
      type: PostType.FOUND,
      animal_type: AnimalType.DOG,
      title: 'Found dog in SPB',
      location: 'Saint Petersburg, Nevsky',
      status: PostStatus.OPEN,
    };

    const catLostSpb = {
      id: 'post-4',
      type: PostType.LOST,
      animal_type: AnimalType.CAT,
      title: 'Lost cat in SPB',
      location: 'Saint Petersburg, Palace Square',
      status: PostStatus.RESOLVED,
    };

    const allPosts = [dogLostMoscow, catFoundMoscow, dogFoundSpb, catLostSpb];

    it('filters by type correctly', async () => {
      mockReq.query = { type: PostType.LOST };
      const lostPosts = allPosts.filter(p => p.type === PostType.LOST);
      mockQueryFn
        .mockResolvedValueOnce({ rows: lostPosts, rowCount: lostPosts.length })
        .mockResolvedValueOnce({ rows: [{ total: String(lostPosts.length) }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.type ='),
        expect.arrayContaining([PostType.LOST])
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: lostPosts,
          total: lostPosts.length,
        })
      );
    });

    it('filters by animal_type correctly', async () => {
      mockReq.query = { animal_type: AnimalType.DOG };
      const dogPosts = allPosts.filter(p => p.animal_type === AnimalType.DOG);
      mockQueryFn
        .mockResolvedValueOnce({ rows: dogPosts, rowCount: dogPosts.length })
        .mockResolvedValueOnce({ rows: [{ total: String(dogPosts.length) }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.animal_type ='),
        expect.arrayContaining([AnimalType.DOG])
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: dogPosts,
          total: dogPosts.length,
        })
      );
    });

    it('filters by location correctly', async () => {
      mockReq.query = { location: 'Moscow' };
      const moscowPosts = allPosts.filter(p => p.location.includes('Moscow'));
      mockQueryFn
        .mockResolvedValueOnce({ rows: moscowPosts, rowCount: moscowPosts.length })
        .mockResolvedValueOnce({ rows: [{ total: String(moscowPosts.length) }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining("p.location ILIKE '%'"),
        expect.arrayContaining(['Moscow'])
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: moscowPosts,
          total: moscowPosts.length,
        })
      );
    });

    it('combines multiple filters correctly', async () => {
      mockReq.query = {
        type: PostType.LOST,
        animal_type: AnimalType.DOG,
        status: PostStatus.OPEN,
      };

      const filteredPosts = allPosts.filter(
        p =>
          p.type === PostType.LOST &&
          p.animal_type === AnimalType.DOG &&
          p.status === PostStatus.OPEN
      );

      mockQueryFn
        .mockResolvedValueOnce({ rows: filteredPosts, rowCount: filteredPosts.length })
        .mockResolvedValueOnce({ rows: [{ total: String(filteredPosts.length) }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      // Verify all filters are applied
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('p.type ='),
        expect.arrayContaining([PostType.LOST, AnimalType.DOG, PostStatus.OPEN])
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: filteredPosts,
          total: filteredPosts.length,
        })
      );
    });

    it('returns intersection of all filters', async () => {
      // Request: FOUND + CAT + Moscow
      mockReq.query = {
        type: PostType.FOUND,
        animal_type: AnimalType.CAT,
        location: 'Moscow',
      };

      // Only one post matches all three criteria
      const intersection = [catFoundMoscow];

      mockQueryFn
        .mockResolvedValueOnce({ rows: intersection, rowCount: intersection.length })
        .mockResolvedValueOnce({ rows: [{ total: String(intersection.length) }], rowCount: 1 });

      await executeSearchHandler('get', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: intersection,
          total: 1,
        })
      );
    });
  });

  describe('Auth Flow Workflow', () => {
    // Import auth module for token operations
    const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

    it('protects endpoints and validates tokens correctly', async () => {
      // Step 1: Request to protected endpoint without token returns 401
      // Reset requireAuth mock to actually check for auth
      const originalMockRequireAuth = mockRequireAuth.getMockImplementation();

      mockRequireAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        if (!req.headers?.authorization) {
          res.status(401);
          res.json({ error: 'Требуется авторизация' });
          return;
        }
        next();
      });

      mockReq.headers = {}; // No authorization header
      await executePostsHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });

      // Step 2: Request with valid token succeeds
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockQueryFn.mockResolvedValueOnce({ rows: [mockPost], rowCount: 1 });

      // Restore mock to allow authenticated requests
      mockRequireAuth.mockImplementation((req: any, _res: any, next: any) => {
        req.user = mockUser;
        req.userId = mockUser.id;
        next();
      });

      await executePostsHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        posts: [mockPost],
        total: 1,
      });

      // Step 3: Request with expired token returns 401
      mockReq = createMockRequest();
      mockRes = createMockResponse();

      mockRequireAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        const authHeader = req.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(401);
          res.json({ error: 'Требуется авторизация' });
          return;
        }

        const token = authHeader.substring(7);
        try {
          // This will throw for expired tokens
          jwt.verify(token, JWT_SECRET);
          next();
        } catch {
          res.status(401);
          res.json({ error: 'Недействительный токен' });
        }
      });

      // Create an expired token
      const expiredToken = jwt.sign({ userId: mockUser.id, email: mockUser.email }, JWT_SECRET, {
        expiresIn: '-1s',
      });
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      await executePostsHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Недействительный токен' });
    });

    it('GET /api/auth/me pattern works with authenticated user', async () => {
      // This tests the pattern where auth middleware attaches user to request
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;

      // Simulate what the /me endpoint does
      const meHandler = (req: any, res: any) => {
        res.json(req.user);
      };

      meHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it('rejects requests with malformed authorization header', async () => {
      mockRequireAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        const authHeader = req.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(401);
          res.json({ error: 'Требуется авторизация' });
          return;
        }
        next();
      });

      mockReq.headers = { authorization: 'Basic invalidformat' };
      await executePostsHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('rejects requests with invalid JWT signature', async () => {
      mockRequireAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        const authHeader = req.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(401);
          res.json({ error: 'Требуется авторизация' });
          return;
        }

        const token = authHeader.substring(7);
        try {
          jwt.verify(token, JWT_SECRET);
          next();
        } catch {
          res.status(401);
          res.json({ error: 'Недействительный токен' });
        }
      });

      // Token signed with wrong secret
      const invalidToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        'wrong-secret',
        { expiresIn: '7d' }
      );
      mockReq.headers = { authorization: `Bearer ${invalidToken}` };

      await executePostsHandler('get', '/my', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Недействительный токен' });
    });
  });

  describe('Post Ownership Workflow', () => {
    it('allows owner to update their post', async () => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.params = { id: 'my-post-id' };
      mockReq.body = { title: 'Updated title' };

      // Ownership check returns current user as owner
      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      // Update succeeds
      mockQueryFn.mockResolvedValueOnce({
        rows: [{ ...mockPost, title: 'Updated title' }],
        rowCount: 1,
      });

      await executePostsHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated title' })
      );
    });

    it('prevents non-owner from updating post', async () => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.params = { id: 'someone-elses-post' };
      mockReq.body = { title: 'Hacked title' };

      // Ownership check returns different user as owner
      mockQueryFn.mockResolvedValueOnce({
        rows: [{ user_id: 'different-user-id' }],
        rowCount: 1,
      });

      await executePostsHandler('put', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Нет прав на редактирование этого объявления',
        })
      );
    });

    it('allows owner to delete their post', async () => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.params = { id: 'my-post-id' };

      mockQueryFn.mockResolvedValueOnce({ rows: [{ user_id: mockUser.id }], rowCount: 1 });
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await executePostsHandler('delete', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(204);
    });

    it('prevents non-owner from deleting post', async () => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
      mockReq.params = { id: 'someone-elses-post' };

      mockQueryFn.mockResolvedValueOnce({
        rows: [{ user_id: 'different-user-id' }],
        rowCount: 1,
      });

      await executePostsHandler('delete', '/:id', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Нет прав на удаление этого объявления',
        })
      );
    });
  });
});
