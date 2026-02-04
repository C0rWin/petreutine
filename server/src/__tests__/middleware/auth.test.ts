import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse, createMockNext, mockUser } from '../setup.js';

// Create a mock for the query function with proper typing
const mockQueryFn = jest.fn<() => Promise<{ rows: any[]; rowCount: number }>>();

// Mock the database module before importing auth
jest.unstable_mockModule('../../db/index.js', () => ({
  query: mockQueryFn,
}));

// Import auth after mocking
const { generateToken, verifyToken, requireAuth, optionalAuth } =
  await import('../../middleware/auth.js');
import type { JwtPayload } from '../../middleware/auth.js';

describe('Auth Middleware', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload: JwtPayload = { userId: 'user-123', email: 'test@example.com' };
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload in token', () => {
      const payload: JwtPayload = { userId: 'user-456', email: 'test2@example.com' };
      const token = generateToken(payload);
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { iat: number; exp: number };

      expect(decoded.userId).toBe('user-456');
      expect(decoded.email).toBe('test2@example.com');
    });

    it('should set expiration time', () => {
      const payload: JwtPayload = { userId: 'user-789', email: 'test3@example.com' };
      const token = generateToken(payload);
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { iat: number; exp: number };

      expect(decoded.exp).toBeDefined();
      // Token should expire in 7 days
      const expectedExpiry = decoded.iat + 7 * 24 * 60 * 60;
      expect(decoded.exp).toBe(expectedExpiry);
    });
  });

  describe('verifyToken', () => {
    it('should return payload for valid token', () => {
      const payload: JwtPayload = { userId: 'user-123', email: 'test@example.com' };
      const token = generateToken(payload);
      const result = verifyToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create a token that's already expired
      const payload: JwtPayload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const payload: JwtPayload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '7d' });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      const result = verifyToken('not-a-jwt');
      expect(result).toBeNull();
    });
  });

  describe('requireAuth', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = createMockNext();
    });

    it('should return 401 if no authorization header', async () => {
      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      mockReq.headers = { authorization: 'Basic abc123' };
      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Недействительный токен' });
    });

    it('should return 401 if user not found in database', async () => {
      const token = generateToken({ userId: 'nonexistent-user', email: 'test@example.com' });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Пользователь не найден' });
    });

    it('should attach user and call next on success', async () => {
      const token = generateToken({ userId: mockUser.id, email: mockUser.email });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.userId).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      const token = generateToken({ userId: mockUser.id, email: mockUser.email });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockRejectedValueOnce(new Error('Database error'));

      await requireAuth(mockReq as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ошибка авторизации' });
    });
  });

  describe('optionalAuth', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = createMockNext();
    });

    it('should call next without user if no authorization header', async () => {
      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without user if token is invalid', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user if valid token and user found', async () => {
      const token = generateToken({ userId: mockUser.id, email: mockUser.email });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.userId).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without user if user not found in database', async () => {
      const token = generateToken({ userId: 'nonexistent', email: 'test@example.com' });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next on database error without failing', async () => {
      const token = generateToken({ userId: mockUser.id, email: mockUser.email });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockQueryFn.mockRejectedValueOnce(new Error('Database error'));

      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if authorization header does not start with Bearer', async () => {
      mockReq.headers = { authorization: 'Basic abc123' };
      await optionalAuth(mockReq as any, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
