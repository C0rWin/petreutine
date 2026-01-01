// Test setup and global mocks
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Mock console.error to reduce noise during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Clear all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Export common test utilities
export const mockUser = {
  id: 'test-user-id',
  yandex_id: 'yandex-123',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: new Date().toISOString(),
};

export const mockPost = {
  id: 'test-post-id',
  user_id: 'test-user-id',
  type: 'LOST' as const,
  animal_type: 'DOG' as const,
  title: 'Lost Dog',
  description: 'A friendly golden retriever went missing',
  location: 'Moscow, Russia',
  latitude: 55.7558,
  longitude: 37.6173,
  contact_info: '+7 999 123 4567',
  reward: 1000,
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

export const createMockRequest = (overrides: Record<string, any> = {}): Record<string, any> => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  userId: undefined,
  path: '/',
  url: '/',
  method: 'GET',
  ip: '127.0.0.1',
  ...overrides,
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = () => jest.fn();
