import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export const mockTestUser: TestUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

export function generateTestToken(user: Partial<TestUser> = {}): string {
  const payload = {
    userId: user.id || mockTestUser.id,
    email: user.email || mockTestUser.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
