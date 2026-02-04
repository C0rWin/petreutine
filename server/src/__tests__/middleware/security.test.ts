import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  httpsRedirect,
  sanitizeInput,
  securityHeaders,
  requestLogger,
} from '../../middleware/security.js';
import { createMockRequest, createMockResponse, createMockNext } from '../setup.js';

describe('Security Middleware', () => {
  describe('httpsRedirect', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;
    let originalEnv: string | undefined;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = createMockNext();
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip redirect for health check path', () => {
      mockReq.path = '/health';
      httpsRedirect(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should skip redirect if no x-forwarded-proto header', () => {
      mockReq.path = '/api/posts';
      mockReq.headers = {};
      httpsRedirect(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to HTTPS in production when proto is http', () => {
      process.env.NODE_ENV = 'production';
      mockReq.path = '/api/posts';
      mockReq.url = '/api/posts?query=test';
      mockReq.headers = {
        'x-forwarded-proto': 'http',
        host: 'example.com',
      };

      httpsRedirect(mockReq as any, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        301,
        'https://example.com/api/posts?query=test'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not redirect in production when proto is https', () => {
      process.env.NODE_ENV = 'production';
      mockReq.path = '/api/posts';
      mockReq.headers = { 'x-forwarded-proto': 'https' };

      httpsRedirect(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should not redirect in development mode', () => {
      process.env.NODE_ENV = 'development';
      mockReq.path = '/api/posts';
      mockReq.headers = { 'x-forwarded-proto': 'http' };

      httpsRedirect(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = createMockNext();
    });

    it('should sanitize XSS in body strings', () => {
      mockReq.body = {
        title: '<script>alert("xss")</script>',
        description: 'Normal text',
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.title).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
      expect(mockReq.body.description).toBe('Normal text');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      mockReq.body = {
        user: {
          name: '<b>Bold</b>',
          email: 'test@example.com',
        },
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.user.name).toBe('&lt;b&gt;Bold&lt;&#x2F;b&gt;');
      expect(mockReq.body.user.email).toBe('test@example.com');
    });

    it('should sanitize arrays of strings', () => {
      mockReq.body = {
        tags: ['<tag1>', 'normal', '<tag2>'],
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.tags).toEqual(['&lt;tag1&gt;', 'normal', '&lt;tag2&gt;']);
    });

    it('should preserve non-string values in arrays', () => {
      mockReq.body = {
        numbers: [1, 2, 3],
        mixed: ['<script>', 42, true],
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.numbers).toEqual([1, 2, 3]);
      expect(mockReq.body.mixed).toEqual(['&lt;script&gt;', 42, true]);
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        q: '<script>alert(1)</script>',
        page: '1',
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.query.q).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
      expect(mockReq.query.page).toBe('1');
    });

    it('should sanitize ampersands, quotes, and slashes', () => {
      mockReq.body = {
        text: `Tom & Jerry's "adventure" / story`,
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.text).toBe('Tom &amp; Jerry&#x27;s &quot;adventure&quot; &#x2F; story');
    });

    it('should handle null body gracefully', () => {
      mockReq.body = null;

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle undefined body gracefully', () => {
      mockReq.body = undefined;

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve numbers and booleans in body', () => {
      mockReq.body = {
        count: 42,
        active: true,
        price: 19.99,
      };

      sanitizeInput(mockReq as any, mockRes, mockNext);

      expect(mockReq.body.count).toBe(42);
      expect(mockReq.body.active).toBe(true);
      expect(mockReq.body.price).toBe(19.99);
    });
  });

  describe('securityHeaders', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockRes.setHeader = jest.fn().mockReturnValue(mockRes);
      mockNext = createMockNext();
    });

    it('should set X-Content-Type-Options header', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should set X-Frame-Options header', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-XSS-Protection header', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should set Referrer-Policy header', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should set Permissions-Policy header', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(self)'
      );
    });

    it('should call next after setting headers', () => {
      securityHeaders(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestLogger', () => {
    let mockReq: ReturnType<typeof createMockRequest>;
    let mockRes: ReturnType<typeof createMockResponse>;
    let mockNext: ReturnType<typeof createMockNext>;
    let originalEnv: string | undefined;
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = createMockNext();
      originalEnv = process.env.NODE_ENV;
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should log request in production mode', () => {
      process.env.NODE_ENV = 'production';
      mockReq.method = 'GET';
      mockReq.path = '/api/posts';
      mockReq.ip = '192.168.1.1';
      mockReq.headers = { 'user-agent': 'Mozilla/5.0' };

      requestLogger(mockReq as any, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(loggedData.method).toBe('GET');
      expect(loggedData.path).toBe('/api/posts');
      expect(loggedData.ip).toBe('192.168.1.1');
      expect(loggedData.userAgent).toBe('Mozilla/5.0');
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should not log in development mode', () => {
      process.env.NODE_ENV = 'development';
      mockReq.method = 'POST';
      mockReq.path = '/api/posts';

      requestLogger(mockReq as any, mockRes, mockNext);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should use x-forwarded-for header if ip not available', () => {
      process.env.NODE_ENV = 'production';
      mockReq.method = 'GET';
      mockReq.path = '/api/posts';
      mockReq.ip = undefined;
      mockReq.headers = { 'x-forwarded-for': '10.0.0.1' };

      requestLogger(mockReq as any, mockRes, mockNext);

      const loggedData = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(loggedData.ip).toBe('10.0.0.1');
    });

    it('should use "unknown" if no IP available', () => {
      process.env.NODE_ENV = 'production';
      mockReq.method = 'GET';
      mockReq.path = '/api/posts';
      mockReq.ip = undefined;
      mockReq.headers = {};

      requestLogger(mockReq as any, mockRes, mockNext);

      const loggedData = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(loggedData.ip).toBe('unknown');
    });

    it('should always call next', () => {
      process.env.NODE_ENV = 'production';
      requestLogger(mockReq as any, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      mockNext.mockClear();
      process.env.NODE_ENV = 'development';
      requestLogger(mockReq as any, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
