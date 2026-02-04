import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { z, ZodError } from 'zod';

import { AppError, errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import { createMockResponse } from '../setup.js';

describe('Error Handler Middleware', () => {
  describe('AppError', () => {
    it('should create an error with statusCode and message', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test error', 500);
      expect(error).toBeInstanceOf(Error);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 400);
      expect(error.stack).toBeDefined();
    });
  });

  describe('errorHandler', () => {
    let mockRes: ReturnType<typeof createMockResponse>;
    const mockReq = {} as any;
    const mockNext = jest.fn();

    beforeEach(() => {
      mockRes = createMockResponse();
      mockNext.mockClear();
    });

    it('should handle ZodError with validation details', () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().min(0),
      });

      let zodError: ZodError | undefined;
      try {
        schema.parse({ name: 'AB', age: -1 });
      } catch (e) {
        zodError = e as ZodError;
      }

      expect(zodError).toBeDefined();
      errorHandler(zodError!, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      });
    });

    it('should handle AppError with custom status code', () => {
      const error = new AppError('Forbidden access', 403);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden access' });
    });

    it('should handle AppError with 401 status', () => {
      const error = new AppError('Unauthorized', 401);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle AppError with 404 status', () => {
      const error = new AppError('Resource not found', 404);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    });

    it('should handle generic Error in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Something went wrong');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Something went wrong' });

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error message in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive error details');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with "Not found" message', () => {
      const mockRes = createMockResponse();
      notFoundHandler({} as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
    });
  });
});
