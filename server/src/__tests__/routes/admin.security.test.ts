import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockRequest, createMockResponse, createMockNext, mockUser } from '../setup.js';

// Create mocks before importing the router
const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

const mockPoolQuery = jest.fn<() => Promise<{ rows: any[]; rowCount: number }>>();
mockPoolQuery.mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 });

const mockPool = {
  query: mockPoolQuery,
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
};

jest.unstable_mockModule('../../db/index.js', () => ({
  query: mockQueryFn,
  default: mockPool,
}));

// Mock auth middleware to allow all requests through for testing
const mockRequireAuth = jest.fn((req: any, _res: any, next: any) => {
  req.user = { ...mockUser, is_admin: true };
  req.userId = mockUser.id;
  next();
});

const mockRequireAdmin = jest.fn((_req: any, _res: any, next: any) => {
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  AuthenticatedRequest: {},
}));

jest.unstable_mockModule('../../middleware/roles.js', () => ({
  requireAdmin: mockRequireAdmin,
}));

// Mock security middleware
jest.unstable_mockModule('../../middleware/security.js', () => ({
  apiLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  authLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  createPostLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  httpsRedirect: jest.fn((_req: any, _res: any, next: any) => next()),
  sanitizeInput: jest.fn((_req: any, _res: any, next: any) => next()),
  securityHeaders: jest.fn((_req: any, _res: any, next: any) => next()),
  requestLogger: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Import after mocks are set up
const statsModule = await import('../../routes/admin/stats.js');
const statsRouter = statsModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  // Find the handler from the router's stack
  // Stats router paths are relative (e.g., '/users' not '/stats/users')
  const routePath = path.replace('/stats', '');
  const layer = (statsRouter as any).stack.find((l: any) => {
    const layerPath = l.route?.path;
    const routeMethod = l.route?.methods?.[method];
    return layerPath === routePath && routeMethod;
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

describe('Admin Stats SQL Injection Prevention', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = { ...mockUser, is_admin: true };
    mockReq.userId = mockUser.id;
    jest.clearAllMocks();
  });

  // SQL injection payloads that should be rejected or sanitized
  const SQL_INJECTION_PAYLOADS = [
    '1; DROP TABLE users; --',
    '30 OR 1=1',
    "30' OR '1'='1",
    '30; SELECT * FROM users; --',
    '30 UNION SELECT * FROM users',
    '-1 OR 1=1',
    "1' AND SLEEP(5)--",
    'abc', // non-numeric string
    '30; DELETE FROM posts;',
    "30' --",
  ];

  describe('GET /stats/users - SQL Injection Prevention', () => {
    SQL_INJECTION_PAYLOADS.forEach(payload => {
      it(`should reject or sanitize SQL injection payload: "${payload}"`, async () => {
        // Zod coerces the days parameter to a number
        // Invalid strings become NaN or the numeric part is extracted
        mockReq.query = { days: payload };

        // The request should either:
        // 1. Be rejected by validation (next called with error)
        // 2. Or the days parameter should be safely coerced to a number
        await executeHandler('get', '/stats/users', mockReq as any, mockRes, mockNext);

        // Check that if a query was made, it used parameterized queries
        const queryCalls = mockQueryFn.mock.calls;
        queryCalls.forEach(([sql, params]) => {
          // Ensure no raw SQL injection payload appears in the query string
          expect(sql).not.toContain(payload);
          // Ensure INTERVAL uses parameterized pattern
          if (sql.includes('INTERVAL')) {
            expect(sql).toContain("INTERVAL '1 day' * $");
          }
        });
      });
    });

    it('should use parameterized query for valid numeric days', async () => {
      // Mock all the query responses for the stats/users endpoint
      mockQueryFn
        .mockResolvedValueOnce({
          rows: [{ total_users: 100, banned_users: 5, comment_banned_users: 2 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // usersByDay
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // activeUsersByDay
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // topPosters
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // topCommenters

      mockReq.query = { days: '30' };
      await executeHandler('get', '/stats/users', mockReq as any, mockRes, mockNext);

      // Verify parameterized queries are used
      const queryCalls = mockQueryFn.mock.calls;
      const usersByDayCall = queryCalls.find(
        ([sql]) => sql.includes('usersByDay') || (sql.includes('users') && sql.includes('INTERVAL'))
      );

      // Check that INTERVAL uses parameterized pattern
      queryCalls.forEach(([sql, params]) => {
        if (sql.includes('INTERVAL')) {
          expect(sql).toContain("INTERVAL '1 day' * $");
          // The params array should contain the days value as a number
          if (params && params.length > 0) {
            expect(typeof params[0]).toBe('number');
          }
        }
      });
    });
  });

  describe('GET /stats/posts - SQL Injection Prevention', () => {
    SQL_INJECTION_PAYLOADS.forEach(payload => {
      it(`should reject or sanitize SQL injection payload: "${payload}"`, async () => {
        mockReq.query = { days: payload };
        await executeHandler('get', '/stats/posts', mockReq as any, mockRes, mockNext);

        const queryCalls = mockQueryFn.mock.calls;
        queryCalls.forEach(([sql]) => {
          expect(sql).not.toContain(payload);
          if (sql.includes('INTERVAL')) {
            expect(sql).toContain("INTERVAL '1 day' * $");
          }
        });
      });
    });
  });

  describe('GET /stats/comments - SQL Injection Prevention', () => {
    SQL_INJECTION_PAYLOADS.forEach(payload => {
      it(`should reject or sanitize SQL injection payload: "${payload}"`, async () => {
        mockReq.query = { days: payload };
        await executeHandler('get', '/stats/comments', mockReq as any, mockRes, mockNext);

        const queryCalls = mockQueryFn.mock.calls;
        queryCalls.forEach(([sql]) => {
          expect(sql).not.toContain(payload);
          if (sql.includes('INTERVAL')) {
            expect(sql).toContain("INTERVAL '1 day' * $");
          }
        });
      });
    });
  });

  describe('Parameterized Query Verification', () => {
    it('should verify stats.ts uses parameterized queries for all INTERVAL clauses', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const statsPath = path.join(__dirname, '..', '..', 'routes', 'admin', 'stats.ts');
      const statsContent = fs.readFileSync(statsPath, 'utf-8');

      // Check that no string interpolation is used with INTERVAL
      const unsafePattern = /INTERVAL '\$\{/g;
      const matches = statsContent.match(unsafePattern);

      expect(matches).toBeNull();
    });

    it('should verify stats.ts uses safe parameterized INTERVAL pattern', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const statsPath = path.join(__dirname, '..', '..', 'routes', 'admin', 'stats.ts');
      const statsContent = fs.readFileSync(statsPath, 'utf-8');

      // Check that safe parameterized pattern is used
      const safePattern = /INTERVAL '1 day' \* \$\d/g;
      const matches = statsContent.match(safePattern);

      // Should find 4 occurrences (usersByDay, activeUsersByDay, postsByDay, commentsByDay)
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('/internal/db-url Credential Protection', () => {
  it('should verify index.ts does not expose DATABASE_URL in response', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const indexPath = path.join(__dirname, '..', '..', 'index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Find the /internal/db-url endpoint section - capture until the next app. call or end
    const dbUrlEndpointMatch = indexContent.match(/app\.get\('\/internal\/db-url'[\s\S]*?^\}\);/m);

    expect(dbUrlEndpointMatch).not.toBeNull();

    if (dbUrlEndpointMatch) {
      const dbUrlEndpoint = dbUrlEndpointMatch[0];

      // Should NOT contain res.json({ database_url: ... })
      expect(dbUrlEndpoint).not.toContain('database_url:');
      // Should NOT reference DATABASE_URL in response
      expect(dbUrlEndpoint).not.toMatch(/res\.json\([^)]*DATABASE_URL/);

      // Should contain safe pool stats pattern
      expect(dbUrlEndpoint).toContain('pool.totalCount');
      expect(dbUrlEndpoint).toContain('pool.idleCount');
      expect(dbUrlEndpoint).toContain('pool.waitingCount');
      expect(dbUrlEndpoint).toContain('latency_ms');
    }
  });

  it('should verify response structure contains only safe information', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const indexPath = path.join(__dirname, '..', '..', 'index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Verify the response does not contain any credential patterns
    const credentialPatterns = [
      /res\.json\([^)]*database_url/i,
      /res\.json\([^)]*password/i,
      /res\.json\([^)]*secret/i,
      /res\.json\([^)]*credential/i,
      /res\.json\([^)]*process\.env\.DATABASE_URL/i,
    ];

    credentialPatterns.forEach(pattern => {
      expect(indexContent).not.toMatch(pattern);
    });
  });
});
