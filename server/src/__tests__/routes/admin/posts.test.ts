import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockRequest, createMockResponse, createMockNext, mockUser } from '../../setup.js';

// SQL injection payloads that should be rejected or sanitized
const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE posts; --",
  "' OR '1'='1",
  "admin'--",
  '1 UNION SELECT * FROM posts',
  '-1 OR 1=1',
  "test'; DELETE FROM posts WHERE '1'='1",
  '1; SELECT * FROM pg_tables;--',
  "' AND SLEEP(5)--",
];

// Create mocks before importing the router
const mockQueryFn =
  jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>>();

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
const postsModule = await import('../../../routes/admin/posts.js');
const postsRouter = postsModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  // Posts router paths are relative (e.g., '/' not '/posts')
  const routePath = path.replace('/posts', '') || '/';
  const layer = (postsRouter as any).stack.find((l: any) => {
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

describe('Admin Posts Query Building', () => {
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

  describe('GET / - Post list with filters', () => {
    beforeEach(() => {
      // Default mock responses for count and posts queries
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    });

    describe('Search filter', () => {
      it('should use parameterized ILIKE for search filter', async () => {
        mockReq.query = { search: 'lost dog' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        // Check the count query uses parameterized ILIKE
        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('ILIKE $1');
        expect(countCall[1]).toEqual(['%lost dog%']);

        // Check the main query also uses parameterized ILIKE
        const mainCall = mockQueryFn.mock.calls[1];
        expect(mainCall[0]).toContain('ILIKE $1');
        expect(mainCall[1]).toContain('%lost dog%');
      });

      it('should not include raw search term in SQL', async () => {
        const searchTerm = 'golden retriever';
        mockReq.query = { search: searchTerm };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        mockQueryFn.mock.calls.forEach(([sql]) => {
          // The raw search term should NOT appear in SQL
          expect(sql).not.toContain(searchTerm);
          // Should use parameter placeholder instead
          expect(sql).toContain('ILIKE $');
        });
      });
    });

    describe('Type filter', () => {
      it('should filter by LOST type with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { type: 'LOST' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.type = $1');
        expect(countCall[1]).toEqual(['LOST']);
      });

      it('should filter by FOUND type with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { type: 'FOUND' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.type = $');
        expect(countCall[1]).toEqual(['FOUND']);
      });

      it('should not filter when type is "all"', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { type: 'all' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).not.toContain('p.type = $');
      });
    });

    describe('Status filter', () => {
      it('should filter by OPEN status with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '8' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { status: 'OPEN' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.status = $');
        expect(countCall[1]).toEqual(['OPEN']);
      });

      it('should filter by RESOLVED status with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { status: 'RESOLVED' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.status = $');
        expect(countCall[1]).toEqual(['RESOLVED']);
      });
    });

    describe('Comments enabled filter', () => {
      it('should filter by enabled comments with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { comments_enabled: 'enabled' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.comments_enabled = $');
        expect(countCall[1]).toEqual([true]);
      });

      it('should filter by disabled comments with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { comments_enabled: 'disabled' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.comments_enabled = $');
        expect(countCall[1]).toEqual([false]);
      });
    });

    describe('User ID filter', () => {
      it('should filter by user_id with parameterized query', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const userId = '550e8400-e29b-41d4-a716-446655440000';
        mockReq.query = { user_id: userId };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.user_id = $');
        expect(countCall[1]).toEqual([userId]);
      });
    });

    describe('Sort column whitelist', () => {
      const validSortColumns = [
        { sort_by: 'created_at', expected: 'p.created_at' },
        { sort_by: 'updated_at', expected: 'p.updated_at' },
        { sort_by: 'title', expected: 'p.title' },
      ];

      validSortColumns.forEach(({ sort_by, expected }) => {
        it(`should use whitelisted column for sort_by: ${sort_by}`, async () => {
          mockQueryFn.mockReset();
          mockQueryFn
            .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });

          mockReq.query = { sort_by };
          await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

          const mainCall = mockQueryFn.mock.calls[1];
          expect(mainCall[0]).toContain(`ORDER BY ${expected}`);
        });
      });

      it('should use sort_order parameter correctly', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { sort_order: 'asc' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const mainCall = mockQueryFn.mock.calls[1];
        expect(mainCall[0]).toContain('ORDER BY');
        expect(mainCall[0]).toContain('ASC');
      });
    });

    describe('Combined filters', () => {
      it('should combine type and status filters', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { type: 'LOST', status: 'OPEN' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('p.type = $1');
        expect(countCall[0]).toContain('p.status = $2');
        expect(countCall[1]).toEqual(['LOST', 'OPEN']);
      });

      it('should combine search with type filter', async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { search: 'cat', type: 'FOUND' };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

        const countCall = mockQueryFn.mock.calls[0];
        expect(countCall[0]).toContain('ILIKE $1');
        expect(countCall[0]).toContain('p.type = $2');
        expect(countCall[1]).toEqual(['%cat%', 'FOUND']);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    SQL_INJECTION_PAYLOADS.forEach(payload => {
      it(`should reject SQL injection in search: "${payload.substring(0, 25)}..."`, async () => {
        mockQueryFn.mockReset();
        mockQueryFn
          .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        mockReq.query = { search: payload };
        await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

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
            const searchParam = params.find(p => typeof p === 'string' && p.includes('%'));
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

      const maliciousSearch = "'; DROP TABLE posts; --";
      mockReq.query = { search: maliciousSearch };
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

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

      const maliciousSearch = '1 UNION SELECT * FROM posts';
      mockReq.query = { search: maliciousSearch };
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

      mockQueryFn.mock.calls.forEach(([sql]) => {
        expect(sql).not.toContain('UNION SELECT');
      });
    });

    it('should reject invalid type values via Zod validation', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Invalid type should be rejected by Zod and default used
      mockReq.query = { type: "'; DROP TABLE posts; --" };
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

      // Query should not contain the malicious payload
      mockQueryFn.mock.calls.forEach(([sql]) => {
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain("';");
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
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

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
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

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

    it('should use default limit when not specified', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = {};
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

      const mainCall = mockQueryFn.mock.calls[1];
      // Default limit is 20 per Zod schema
      expect(mainCall[1]).toContain(20);
    });

    it('should use default offset (0) when not specified', async () => {
      mockQueryFn.mockReset();
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockReq.query = {};
      await executeHandler('get', '/posts', mockReq as any, mockRes, mockNext);

      const mainCall = mockQueryFn.mock.calls[1];
      // Default offset is 0 per Zod schema
      expect(mainCall[1]).toContain(0);
    });
  });

  describe('Parameterized Query Verification', () => {
    it('should verify posts.ts uses parameterized queries for all filters', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const postsPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'posts.ts');
      const postsContent = fs.readFileSync(postsPath, 'utf-8');

      // Check that no string interpolation is used in WHERE clauses
      const unsafePatterns = [
        /WHERE.*\$\{(?!paramIndex)/g, // Template literal interpolation (except paramIndex)
      ];

      unsafePatterns.forEach(pattern => {
        const matches = postsContent.match(pattern);
        expect(matches).toBeNull();
      });
    });

    it('should verify posts.ts uses safe parameterized ILIKE pattern', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const postsPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'posts.ts');
      const postsContent = fs.readFileSync(postsPath, 'utf-8');

      // Check that ILIKE uses parameterized pattern (template literal with paramIndex)
      const safePattern = /ILIKE \$\$\{paramIndex\}/g;
      const matches = postsContent.match(safePattern);

      // Should find at least one ILIKE with parameter
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(1);
    });

    it('should verify posts.ts uses parameterized WHERE conditions', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const postsPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'posts.ts');
      const postsContent = fs.readFileSync(postsPath, 'utf-8');

      // Check for parameterized WHERE conditions
      const parameterizedPatterns = [
        /p\.type = \$\$\{paramIndex\}/,
        /p\.status = \$\$\{paramIndex\}/,
        /p\.comments_enabled = \$\$\{paramIndex\}/,
        /p\.user_id = \$\$\{paramIndex\}/,
      ];

      parameterizedPatterns.forEach(pattern => {
        expect(postsContent).toMatch(pattern);
      });
    });

    it('should verify sort_by uses whitelisted column mapping', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const postsPath = path.join(__dirname, '..', '..', '..', 'routes', 'admin', 'posts.ts');
      const postsContent = fs.readFileSync(postsPath, 'utf-8');

      // Should have a column mapping (ternary or switch)
      expect(postsContent).toMatch(/params\.sort_by\s*===\s*['"]title['"]/);
      expect(postsContent).toMatch(/params\.sort_by\s*===\s*['"]updated_at['"]/);

      // Should NOT use raw params.sort_by in ORDER BY
      expect(postsContent).not.toMatch(/ORDER BY.*\$\{.*params\.sort_by/);
    });
  });
});
