import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createMockRequest, createMockResponse, createMockNext, mockUser } from '../setup.js';

// Mock S3 client
const mockS3Send = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
}));

// Mock sharp
const mockToBuffer = jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from('processed-image'));
const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: mockToBuffer,
};
const mockSharp = jest.fn().mockReturnValue(mockSharpInstance);
jest.unstable_mockModule('sharp', () => ({
  default: mockSharp,
}));

// Mock uuid
jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

// Mock auth middleware
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: jest.fn((req: any, _res: any, next: any) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock multer
const mockSingle = jest.fn().mockReturnValue((req: any, _res: any, next: any) => next());
const mockMulter = Object.assign(
  jest.fn().mockReturnValue({
    single: mockSingle,
  }),
  {
    memoryStorage: jest.fn().mockReturnValue({}),
  }
);
jest.unstable_mockModule('multer', () => ({
  default: mockMulter,
}));

// Set environment variables for tests
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    DO_SPACES_KEY: 'test-key',
    DO_SPACES_SECRET: 'test-secret',
    DO_SPACES_BUCKET: 'test-bucket',
    DO_SPACES_REGION: 'fra1',
    DO_SPACES_ENDPOINT: 'https://fra1.digitaloceanspaces.com',
    DO_SPACES_CDN_URL: 'https://test-bucket.fra1.cdn.digitaloceanspaces.com',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// Import after mocks are set up
const uploadModule = await import('../../routes/upload.js');
const uploadRouter = uploadModule.default;

// Helper to execute route handler directly
const executeHandler = async (
  method: 'get' | 'post' | 'delete',
  path: string,
  req: any,
  res: any,
  next: any
) => {
  const layer = (uploadRouter as any).stack.find((l: any) => {
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

describe('Upload Routes', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = mockUser;
    mockReq.userId = mockUser.id;
    jest.clearAllMocks();
  });

  describe('POST / - Upload image', () => {
    it('should return 400 if no file uploaded', async () => {
      mockReq.file = undefined;
      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Файл не загружен',
          statusCode: 400,
        })
      );
    });

    it('should upload image to Spaces', async () => {
      mockReq.file = {
        buffer: Buffer.from('test-image'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as any;
      mockS3Send.mockResolvedValue({});

      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockS3Send).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        url: expect.stringMatching(/https:\/\/.*\.cdn\.digitaloceanspaces\.com\/uploads\//),
        thumbnail: expect.stringMatching(/https:\/\/.*\.cdn\.digitaloceanspaces\.com\/thumbs\//),
        key: expect.stringContaining('uploads/'),
        isBase64: false,
      });
    });

    it('should process PNG images', async () => {
      mockReq.file = {
        buffer: Buffer.from('test-image'),
        originalname: 'test.png',
        mimetype: 'image/png',
      } as any;
      mockS3Send.mockResolvedValue({});

      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockSharpInstance.png).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 85 })
      );
    });

    it('should process JPEG images', async () => {
      mockReq.file = {
        buffer: Buffer.from('test-image'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as any;
      mockS3Send.mockResolvedValue({});

      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 85 })
      );
    });

    it('should fallback to base64 if Spaces not configured', async () => {
      process.env.DO_SPACES_KEY = '';
      process.env.DO_SPACES_SECRET = '';

      // Need to re-import to pick up new env
      jest.resetModules();
      const freshModule = await import('../../routes/upload.js');
      const freshRouter = freshModule.default;

      const layer = (freshRouter as any).stack.find(
        (l: any) => l.route?.path === '/' && l.route?.methods?.post
      );

      mockReq.file = {
        buffer: Buffer.from('test-image'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as any;

      if (layer) {
        const handlers = layer.route.stack.map((s: any) => s.handle);
        for (const handler of handlers) {
          await handler(mockReq as any, mockRes, mockNext);
        }
      }

      expect(mockRes.json).toHaveBeenCalledWith({
        url: expect.stringContaining('data:image/jpeg;base64,'),
        thumbnail: expect.stringContaining('data:image/jpeg;base64,'),
        isBase64: true,
      });
    });

    it('should call next on upload error', async () => {
      mockReq.file = {
        buffer: Buffer.from('test-image'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as any;
      mockS3Send.mockRejectedValueOnce(new Error('Upload failed'));

      await executeHandler('post', '/', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('DELETE /:key - Delete image', () => {
    it('should delete image from Spaces', async () => {
      mockReq.params = { key: `uploads/${mockUser.id}/test-uuid.jpg` };
      mockS3Send.mockResolvedValue({});

      await executeHandler('delete', '/:key(*)', mockReq as any, mockRes, mockNext);

      expect(mockS3Send).toHaveBeenCalledTimes(2); // Main image + thumbnail
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 403 if trying to delete other user files', async () => {
      mockReq.params = { key: 'uploads/other-user-id/test.jpg' };

      await executeHandler('delete', '/:key(*)', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Нет прав на удаление этого файла',
          statusCode: 403,
        })
      );
    });

    it('should call next on delete error', async () => {
      mockReq.params = { key: `uploads/${mockUser.id}/test.jpg` };
      mockS3Send.mockRejectedValueOnce(new Error('Delete failed'));

      await executeHandler('delete', '/:key(*)', mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
