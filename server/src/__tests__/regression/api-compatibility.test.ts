/**
 * API Compatibility Regression Tests
 *
 * These tests validate that API response shapes match expected Zod schemas.
 * If any response field changes, these tests will catch the breaking change.
 *
 * Purpose: Frontend relies on specific response shapes. Breaking changes
 * silently break the UI. These tests ensure API contracts are maintained.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AuthMeSchema,
  ErrorSchema,
  MatchResultSchema,
  PostSchema,
  PostsListSchema,
  SearchResultSchema,
} from '../helpers/schemas.js';
import { createMockNext, createMockRequest, createMockResponse, mockUser } from '../setup.js';

// ============================================
// MOCK DATA MATCHING REAL API RESPONSES
// ============================================

/**
 * Mock post data that matches the actual database schema.
 * Important: animal_type uses proper case ('Dog', not 'DOG')
 * as defined in the database enum.
 */
const apiMockPost = {
  id: 'test-post-id',
  user_id: 'test-user-id',
  type: 'LOST' as const,
  animal_type: 'Dog' as const, // Matches database enum: 'Dog', 'Cat', 'Bird', 'Other'
  title: 'Lost Dog',
  description: 'A friendly golden retriever went missing',
  location: 'Moscow, Russia',
  latitude: 55.7558,
  longitude: 37.6173,
  contact_info: '+7 999 123 4567',
  reward: '1000',
  image_url: 'https://example.com/dog.jpg',
  status: 'OPEN' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://example.com/avatar.jpg',
  },
};

// ============================================
// MOCK SETUP
// ============================================

const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

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
  generateToken: jest.fn().mockReturnValue('test-jwt-token'),
  verifyToken: jest.fn(),
}));

// Mock rate limiter
jest.unstable_mockModule('../../middleware/security.js', () => ({
  createPostLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock global fetch for Yandex OAuth
const mockFetch = jest.fn<(...args: any[]) => Promise<any>>();
global.fetch = mockFetch as any;

// Set environment variables for tests
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    YANDEX_CLIENT_ID: 'test-client-id',
    YANDEX_CLIENT_SECRET: 'test-client-secret',
    YANDEX_REDIRECT_URI: 'http://localhost:3001/api/auth/yandex/callback',
    FRONTEND_URL: 'http://localhost:3000',
    NODE_ENV: 'development',
  };
  jest.clearAllMocks();

  // Default mock for OAuth cleanup
  mockQueryFn.mockImplementation(async sql => {
    if (sql.includes('cleanup_expired_oauth_states')) {
      return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
});

// Import after mocks are set up
const postsModule = await import('../../routes/posts.js');
const postsRouter = postsModule.default;

const searchModule = await import('../../routes/search.js');
const searchRouter = searchModule.default;

const authModule = await import('../../routes/auth.js');
const authRouter = authModule.default;

// ============================================
// HELPER: Execute route handler directly
// ============================================

const executeHandler = async (
  router: any,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  const layer = router.stack.find((l: any) => {
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

// ============================================
// HELPER: Log schema errors for debugging
// ============================================

function expectSchemaValid<T>(
  result: { success: boolean; error?: { errors: any[] }; data?: T },
  context: string
) {
  if (!result.success && result.error) {
    const errorDetails = result.error.errors
      .map(e => `  - ${e.path.join('.')}: ${e.message} (received: ${JSON.stringify(e.received)})`)
      .join('\n');
    // Use console.log for debugging during test development
    process.stdout.write(`Schema validation failed for ${context}:\n${errorDetails}\n`);
  }
  expect(result.success).toBe(true);
}

// ============================================
// API COMPATIBILITY TESTS
// ============================================

describe('API Compatibility Tests', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;
  let capturedJson: any;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();

    // Capture the JSON response for schema validation
    mockRes.json = jest.fn((data: any) => {
      capturedJson = data;
      return mockRes;
    }) as any;

    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/posts
  // ============================================

  describe('GET /api/posts', () => {
    it('returns response matching PostsListSchema', async () => {
      const posts = [apiMockPost];
      mockQueryFn.mockResolvedValueOnce({ rows: posts, rowCount: 1 });

      mockReq.query = { limit: '50', offset: '0' };
      await executeHandler(postsRouter, 'get', '/', mockReq as any, mockRes, mockNext);

      const result = PostsListSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/posts');
    });

    it('returns empty posts array matching PostsListSchema', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = {};
      await executeHandler(postsRouter, 'get', '/', mockReq as any, mockRes, mockNext);

      const result = PostsListSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/posts (empty)');
      expect(capturedJson.posts).toHaveLength(0);
    });
  });

  // ============================================
  // GET /api/posts/:id
  // ============================================

  describe('GET /api/posts/:id', () => {
    it('returns response matching PostSchema', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [apiMockPost], rowCount: 1 });

      mockReq.params = { id: apiMockPost.id };
      await executeHandler(postsRouter, 'get', '/:id', mockReq as any, mockRes, mockNext);

      const result = PostSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/posts/:id');
    });

    it('returns ErrorSchema for 404', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { id: 'nonexistent-id' };
      await executeHandler(postsRouter, 'get', '/:id', mockReq as any, mockRes, mockNext);

      // 404 is passed to error handler via next()
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
        })
      );
    });
  });

  // ============================================
  // GET /api/search
  // ============================================

  describe('GET /api/search', () => {
    it('returns response matching SearchResultSchema', async () => {
      const posts = [apiMockPost];
      mockQueryFn
        .mockResolvedValueOnce({ rows: posts, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      mockReq.query = {};
      await executeHandler(searchRouter, 'get', '/', mockReq as any, mockRes, mockNext);

      const result = SearchResultSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search');
    });

    it('returns response with pagination matching SearchResultSchema', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 });

      mockReq.query = { limit: '10', offset: '20' };
      await executeHandler(searchRouter, 'get', '/', mockReq as any, mockRes, mockNext);

      const result = SearchResultSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search (pagination)');
      expect(capturedJson.limit).toBe(10);
      expect(capturedJson.offset).toBe(20);
      expect(capturedJson.total).toBe(100);
    });

    it('returns response with search query matching SearchResultSchema', async () => {
      const posts = [apiMockPost];
      mockQueryFn
        .mockResolvedValueOnce({ rows: posts, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });

      mockReq.query = { q: 'golden retriever' };
      await executeHandler(searchRouter, 'get', '/', mockReq as any, mockRes, mockNext);

      const result = SearchResultSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search (with query)');
    });
  });

  // ============================================
  // GET /api/search/matches/:postId
  // ============================================

  describe('GET /api/search/matches/:postId', () => {
    const sourcePost = {
      type: 'LOST',
      animal_type: 'Dog',
      description: 'Golden retriever went missing',
      location: 'Moscow, Park',
    };

    it('returns response matching MatchResultSchema', async () => {
      const matchingPost = {
        ...apiMockPost,
        type: 'FOUND',
        match_score: 0.8,
        location: 'Moscow, Park',
        animal_type: 'Dog',
      };

      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [matchingPost], rowCount: 1 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler(
        searchRouter,
        'get',
        '/matches/:postId',
        mockReq as any,
        mockRes,
        mockNext
      );

      const result = MatchResultSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search/matches/:postId');
    });

    it('returns ErrorSchema for 404', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'nonexistent-id' };
      await executeHandler(
        searchRouter,
        'get',
        '/matches/:postId',
        mockReq as any,
        mockRes,
        mockNext
      );

      // 404 returns inline JSON error
      expect(mockRes.status).toHaveBeenCalledWith(404);
      const result = ErrorSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search/matches/:postId (404)');
    });

    it('returns empty matches matching MatchResultSchema', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ rows: [sourcePost], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.params = { postId: 'source-post-id' };
      await executeHandler(
        searchRouter,
        'get',
        '/matches/:postId',
        mockReq as any,
        mockRes,
        mockNext
      );

      const result = MatchResultSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/search/matches/:postId (empty)');
      expect(capturedJson.matches).toHaveLength(0);
    });
  });

  // ============================================
  // GET /api/auth/me
  // ============================================

  describe('GET /api/auth/me', () => {
    it('returns response matching AuthMeSchema when authenticated', async () => {
      mockReq.user = mockUser;
      await executeHandler(authRouter, 'get', '/me', mockReq as any, mockRes, mockNext);

      const result = AuthMeSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'GET /api/auth/me');
    });
  });

  // ============================================
  // POST /api/posts
  // ============================================

  describe('POST /api/posts', () => {
    const validPostData = {
      type: 'LOST',
      animal_type: 'Dog',
      title: 'Lost Golden Retriever',
      description: 'A friendly golden retriever went missing near the park',
      location: 'Moscow, Central Park',
      contact_info: '+7 999 123 4567',
    };

    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.userId = mockUser.id;
    });

    it('returns response matching PostSchema on create', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [apiMockPost], rowCount: 1 });

      mockReq.body = validPostData;
      await executeHandler(postsRouter, 'post', '/', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const result = PostSchema.safeParse(capturedJson);
      expectSchemaValid(result, 'POST /api/posts');
    });

    it('calls next with error for 400 on validation failure', async () => {
      mockReq.body = { type: 'LOST' }; // Missing required fields
      await executeHandler(postsRouter, 'post', '/', mockReq as any, mockRes, mockNext);

      // Validation errors are passed to error handler
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ============================================
  // POST /api/auth/logout
  // ============================================

  describe('POST /api/auth/logout', () => {
    it('returns success response', async () => {
      mockReq.user = mockUser;
      await executeHandler(authRouter, 'post', '/logout', mockReq as any, mockRes, mockNext);

      expect(capturedJson).toEqual({ success: true });
    });
  });
});
