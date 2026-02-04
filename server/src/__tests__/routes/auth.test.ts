import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createMockNext, createMockRequest, createMockResponse, mockUser } from '../setup.js';

// Create mocks before importing the router
const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();
const mockGenerateToken = jest.fn().mockReturnValue('test-jwt-token');
const mockVerifyToken = jest.fn();

jest.unstable_mockModule('../../db/index.js', () => ({
  query: mockQueryFn,
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  generateToken: mockGenerateToken,
  verifyToken: mockVerifyToken,
  requireAuth: jest.fn((req: any, _res: any, next: any) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    next();
  }),
  AuthenticatedRequest: {},
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

  // Default mock implementation for OAuth state validation and cleanup
  mockQueryFn.mockImplementation(async sql => {
    if (sql.includes('cleanup_expired_oauth_states')) {
      return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
});

afterEach(() => {
  process.env = originalEnv;
});

// Import after mocks are set up
const authModule = await import('../../routes/auth.js');
const authRouter = authModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  const layer = (authRouter as any).stack.find((l: any) => {
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

describe('Auth Routes', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('GET /me - Get current user', () => {
    it('should return current authenticated user', async () => {
      mockReq.user = mockUser;
      await executeHandler('get', '/me', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('GET /yandex - Initiate OAuth', () => {
    it('should be configured with correct handler', async () => {
      // Test that the route exists
      const layer = (authRouter as any).stack.find(
        (l: any) => l.route?.path === '/yandex' && l.route?.methods?.get
      );
      expect(layer).toBeDefined();
    });
  });

  describe('GET /yandex/callback - OAuth callback', () => {
    const yandexUser = {
      id: 'yandex-123',
      login: 'testuser',
      default_email: 'test@yandex.ru',
      real_name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      default_avatar_id: 'avatar-id',
      is_avatar_empty: false,
    };

    it('should redirect with error if OAuth denied', async () => {
      mockReq.query = { error: 'access_denied' };
      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=oauth_denied');
    });

    it('should redirect with error if no code provided', async () => {
      mockReq.query = {};
      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=no_code');
    });

    it('should handle token exchange error', async () => {
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };

      // Mock OAuth state validation to succeed
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Token error',
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=token_error');
    });

    it('should handle user info error', async () => {
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };

      // Mock OAuth state validation to succeed
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'User info error',
        });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=user_info_error');
    });

    it('should create new user on first login', async () => {
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => yandexUser,
        });

      // Mock OAuth state validation and subsequent queries
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM users WHERE yandex_id')) {
          // User doesn't exist
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM users')) {
          return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ ...mockUser, yandex_id: yandexUser.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([yandexUser.id])
      );
      expect(mockGenerateToken).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000?token=')
      );
    });

    it('should update existing user on login', async () => {
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => yandexUser,
        });

      // Mock OAuth state validation and subsequent queries
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM users WHERE yandex_id')) {
          // User exists
          return { rows: [mockUser], rowCount: 1 };
        }
        if (sql.includes('UPDATE users')) {
          return { rows: [mockUser], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([yandexUser.id])
      );
    });

    it('should use display_name if real_name not available', async () => {
      const userWithoutRealName = {
        ...yandexUser,
        real_name: undefined,
        display_name: 'Display Name',
      };
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => userWithoutRealName,
        });

      // Mock OAuth state validation and subsequent queries
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM users WHERE yandex_id')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM users')) {
          return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [mockUser], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['Display Name'])
      );
    });

    it('should handle empty avatar', async () => {
      const userWithEmptyAvatar = { ...yandexUser, is_avatar_empty: true };
      mockReq.query = { code: 'auth-code', state: 'valid-state-token' };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => userWithEmptyAvatar,
        });

      // Mock OAuth state validation and subsequent queries
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [{ redirect_to: null }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM users WHERE yandex_id')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM users')) {
          return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [mockUser], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      // Avatar should be null
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([null])
      );
    });
  });

  describe('OAuth state validation', () => {
    it('should reject callback with missing state parameter', async () => {
      // No state parameter provided, only code
      mockReq.query = { code: 'auth-code' };

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=invalid_state');
      // State validation query should NOT be called since state is missing
      expect(mockQueryFn).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_states'),
        expect.anything()
      );
    });

    it('should reject callback with invalid state (not found in DB)', async () => {
      mockReq.query = { code: 'auth-code', state: 'unknown-state-token' };

      // Mock DELETE query to return empty result (state not found)
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('DELETE FROM oauth_states') && sql.includes('RETURNING')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await executeHandler('get', '/yandex/callback', mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000?error=invalid_state');
    });
  });

  describe('POST /logout - Logout', () => {
    it('should return success', async () => {
      mockReq.user = mockUser;
      await executeHandler('post', '/logout', mockReq as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('POST /dev/create-user - Dev user creation', () => {
    it('should create a dev user in development mode', async () => {
      // Mock the SELECT COUNT and INSERT queries
      mockQueryFn.mockImplementation(async sql => {
        if (sql.includes('SELECT COUNT(*) as count FROM users')) {
          return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ ...mockUser, yandex_id: 'dev_123' }], rowCount: 1 };
        }
        if (sql.includes('cleanup_expired_oauth_states')) {
          return { rows: [{ cleanup_expired_oauth_states: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      mockReq.body = { name: 'Dev User', email: 'dev@example.com' };
      await executeHandler('post', '/dev/create-user', mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Object),
          token: expect.any(String),
        })
      );
    });

    it('should require name and email', async () => {
      mockReq.body = { name: 'Dev User' }; // Missing email
      await executeHandler('post', '/dev/create-user', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Name and email are required',
          statusCode: 400,
        })
      );
    });
  });
});
