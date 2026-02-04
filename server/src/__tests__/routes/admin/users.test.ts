import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockRequest, createMockResponse, createMockNext, mockUser } from '../../setup.js';

// SQL injection payloads that should be rejected or sanitized
const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "admin'--",
  "1 UNION SELECT * FROM users",
  "-1 OR 1=1",
  "test'; DELETE FROM users WHERE '1'='1",
  "1; SELECT * FROM pg_tables;--",
  "' AND SLEEP(5)--",
];

// Create mocks before importing the router
const mockQueryFn = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

jest.unstable_mockModule('../../../db/index.js', () => ({
  query: mockQueryFn,
}));

// Mock auth middleware to allow all requests through for testing
const mockRequireAuth = jest.fn((req: any, _res: any, next: any) => {
  req.user = { ...mockUser, is_admin: true };
  req.userId = mockUser.id;
  next();
});

jest.unstable_mockModule('../../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  AuthenticatedRequest: {},
}));

jest.unstable_mockModule('../../../middleware/roles.js', () => ({
  requireAdmin: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock utils
jest.unstable_mockModule('../../../routes/admin/utils.js', () => ({
  logAdminAction: jest.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
const usersModule = await import('../../../routes/admin/users.js');
const usersRouter = usersModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  // Users router paths are relative (e.g., '/' not '/users')
  const routePath = path.replace('/users', '') || '/';
  const layer = (usersRouter as any).stack.find((l: any) => {
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

describe('Admin Users Query Building', () => {
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

  describe('GET / - User list with filters', () => {
    beforeEach(() => {
      // Default mock responses for count and users queries
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    });

    describe('Search filter', () => {
      it('should use parameterized ILIKE for search filter', async () => {
        mockReq.query = { search: 'john' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        // Check the count query uses parameterized ILIKE
        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('ILIKE $1');
        expect(countCall[1]).toEqual(['%john%']);

        // Check the main query also uses parameterized ILIKE
        const mainCall = mockQueryFn.mock.calls[1];
        expect(mainCall[0]).toContain('ILIKE $1');
        expect(mainCall[1]).toContain('%john%');
      });

      it('should not include raw search term in SQL', async () => {
        const searchTerm = 'test@example.com';
        mockReq.query = { search: searchTerm };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        mockQueryFn.mock.calls.forEach(([sql]) => {
          // The raw search term should NOT appear in SQL
          expect(sql).not.toContain(searchTerm);
          // Should use parameter placeholder instead
          expect(sql).toContain('ILIKE $');
        });
      });
    });

    describe('Ban status filter', () => {
      it('should filter by banned status', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { ban_status: 'banned' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('u.ban_type IS NOT NULL');
      });

      it('should filter by not_banned status', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { ban_status: 'not_banned' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('u.ban_type IS NULL');
      });

      it('should filter by comment_banned status', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { ban_status: 'comment_banned' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain("u.ban_type = 'comment'");
      });

      it('should filter by full_banned status', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { ban_status: 'full_banned' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain("u.ban_type = 'full'");
      });
    });

    describe('Sort column whitelist', () => {
      const validSortColumns = [
        { sort_by: 'created_at', expected: 'u.created_at' },
        { sort_by: 'last_login_at', expected: 'u.last_login_at' },
        { sort_by: 'name', expected: 'u.name' },
        { sort_by: 'email', expected: 'u.email' },
      ];

      validSortColumns.forEach(({ sort_by, expected }) => {
        it(`should use whitelisted column for sort_by: ${sort_by}`, async () => {
          mockQueryFn.mockReset();
          mockQueryFn
            .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });

          mockReq.query = { sort_by };
          await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

          const mainCall = mockQueryFn.mock.calls[1];
          expect(mainCall[0]).toContain(`ORDER BY ${expected}`);
        });
      });

      it('should use default sort column for invalid sort_by (Zod rejects)', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // Zod schema will reject invalid sort_by and use default
        mockReq.query = { sort_by: 'password' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        // Zod will throw validation error for invalid enum value
        // which means next() is called with error or default is used
        const calls = mockQueryFn.mock.calls;
        if (calls.length > 0) {
          // If query was made, it should NOT contain 'password'
          calls.forEach(([sql]) => {
            expect(sql).not.toContain('password');
          });
        }
      });

      it('should use sort_order parameter correctly', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { sort_order: 'asc' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const mainCall = mockQueryFn.mock.calls[1];
        expect(mainCall[0]).toContain('ORDER BY');
        expect(mainCall[0]).toContain('ASC');
      });
    });

    describe('Combined filters', () => {
      it('should combine search and ban_status filters', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { search: 'john', ban_status: 'banned' };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('ILIKE $1');
        expect(countCall[0]).toContain('u.ban_type IS NOT NULL');
        expect(countCall[1]).toEqual(['%john%']);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    SQL_INJECTION_PAYLOADS.forEach((payload) => {
      it(`should reject SQL injection in search: "${payload.substring(0, 25)}..."`, async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { search: payload };
        await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

        // Verify parameterized query is used
        const queryCalls = mockQueryFn.mock.calls;
        queryCalls.forEach(([sql, params]) => {
          // The raw payload should NEVER appear in the SQL string
          expect(sql).not.toContain(payload);

          // Should use parameterized ILIKE pattern
          if (sql.includes('ILIKE')) {
            expect(sql).toMatch(/ILIKE \$\d/);
          }

          // If params exist, verify the payload is properly parameterized
          if (params && params.length > 0) {
            const searchParam = params.find(
              (p) => typeof p === 'string' && p.includes('%')
            );
            if (searchParam) {
              // Payload should be wrapped in % for LIKE
              expect(searchParam).toBe(`%${payload}%`);
            }
          }
        });
      });
    });

    it('should not allow DROP TABLE through search parameter', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const maliciousSearch = "'; DROP TABLE users; --";
      mockReq.query = { search: maliciousSearch };
      await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

      mockQueryFn.mock.calls.forEach(([sql]) => {
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain("';");
        expect(sql).not.toContain('--');
      });
    });

    it('should not allow UNION SELECT through search parameter', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const maliciousSearch = '1 UNION SELECT * FROM users';
      mockReq.query = { search: maliciousSearch };
      await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

      mockQueryFn.mock.calls.forEach(([sql]) => {
        expect(sql).not.toContain('UNION SELECT');
      });
    });
  });

  describe('Pagination parameters', () => {
    it('should use parameterized LIMIT and OFFSET', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = { limit: '25', offset: '50' };
      await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

      const mainCall = mockQueryFn.mock.calls[1];
      expect(mainCall[0]).toContain('LIMIT $');
      expect(mainCall[0]).toContain('OFFSET $');
      // Verify limit and offset are in params
      expect(mainCall[1]).toContain(25);
      expect(mainCall[1]).toContain(50);
    });

    it('should cap limit at maximum (100)', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '200' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Zod schema has max(100) on limit
      mockReq.query = { limit: '200' };
      await executeHandler('get', '/users', mockReq as any, mockRes, mockNext);

      // Zod validation should cap or reject the value
      const calls = mockQueryFn.mock.calls;
      if (calls.length > 1) {
        const mainCall = calls[1];
        // If params include limit, it should be <= 100
        const limitParam = mainCall[1]?.find(
          (p: any) => typeof p === 'number' && p > 0 && p <= 200
        );
        if (typeof limitParam === 'number') {
          expect(limitParam).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Parameterized Query Verification', () => {
    it('should verify users.ts uses parameterized queries for all filters', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const usersPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'users.ts');
      const usersContent = fs.readFileSync(usersPath, 'utf-8');

      // Check that no string interpolation is used in WHERE clauses
      const unsafePatterns = [
        /WHERE.*\$\{/g,        // Template literal interpolation
        /`.*WHERE.*\+/g,       // String concatenation in template
        /'.*WHERE.*'\s*\+/g,   // String concatenation
      ];

      unsafePatterns.forEach((pattern) => {
        const matches = usersContent.match(pattern);
        expect(matches).toBeNull();
      });
    });

    it('should verify users.ts uses safe parameterized ILIKE pattern', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const usersPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'users.ts');
      const usersContent = fs.readFileSync(usersPath, 'utf-8');

      // Check that ILIKE uses parameterized pattern (template literal with paramIndex)
      // The source code uses $${paramIndex} which compiles to ILIKE $1, $2, etc.
      const safePattern = /ILIKE \$\$\{paramIndex\}/g;
      const matches = usersContent.match(safePattern);

      // Should find at least one ILIKE with parameter
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(1);
    });

    it('should verify sort_by uses whitelisted column mapping', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const usersPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'users.ts');
      const usersContent = fs.readFileSync(usersPath, 'utf-8');

      // Should have a column mapping (ternary or switch)
      expect(usersContent).toMatch(/params\.sort_by\s*===\s*['"]name['"]/);
      expect(usersContent).toMatch(/params\.sort_by\s*===\s*['"]email['"]/);

      // Should NOT use raw params.sort_by in ORDER BY
      expect(usersContent).not.toMatch(/ORDER BY.*\$\{.*params\.sort_by/);
    });
  });
});
