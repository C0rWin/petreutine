import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock pg Pool with proper types
const mockQuery = jest.fn<(...args: any[]) => Promise<any>>();
const mockConnect = jest.fn<() => Promise<any>>();
const mockRelease = jest.fn<() => void>();
const mockEnd = jest.fn<() => Promise<void>>();
const mockOn = jest.fn<(...args: any[]) => void>();

const mockClient = {
  query: mockQuery,
  release: mockRelease,
};

const MockPool = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  connect: mockConnect.mockResolvedValue(mockClient),
  end: mockEnd,
  on: mockOn,
}));

jest.unstable_mockModule('pg', () => ({
  default: { Pool: MockPool },
  Pool: MockPool,
}));

// Mock fs and path for initializeDatabase
const mockReadFileSync = jest.fn().mockReturnValue('CREATE TABLE test ();');
jest.unstable_mockModule('fs', () => ({
  default: { readFileSync: mockReadFileSync },
  readFileSync: mockReadFileSync,
}));

// Import after mocks
const { query, getClient, transaction, initializeDatabase, closePool } = await import('../../db/index.js');

describe('Database Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('query', () => {
    it('should execute a query and return results', async () => {
      const expectedResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(expectedResult);

      const result = await query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(expectedResult);
    });

    it('should execute query without params', async () => {
      const expectedResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(expectedResult);

      const result = await query('SELECT * FROM users');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should throw on query error', async () => {
      const error = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(error);

      await expect(query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('getClient', () => {
    it('should return a pool client', async () => {
      const client = await getClient();

      expect(mockConnect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('transaction', () => {
    it('should execute callback within a transaction', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const callback = jest.fn<(client: any) => Promise<string>>().mockResolvedValue('result');

      const result = await transaction(callback);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should rollback on error', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const error = new Error('Transaction failed');
      const callback = jest.fn<(client: any) => Promise<never>>().mockRejectedValue(error);

      await expect(transaction(callback)).rejects.toThrow('Transaction failed');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should release client even on error', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const callback = jest.fn<(client: any) => Promise<never>>().mockRejectedValue(new Error('Error'));

      try {
        await transaction(callback);
      } catch {
        // Expected
      }

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('initializeDatabase', () => {
    it('should read and execute schema file', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await initializeDatabase();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schema.sql'),
        'utf-8'
      );
      expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE test ();');
    });

    it('should throw on schema execution error', async () => {
      const error = new Error('Schema error');
      mockQuery.mockRejectedValueOnce(error);

      await expect(initializeDatabase()).rejects.toThrow('Schema error');
    });
  });

  describe('closePool', () => {
    it('should close the connection pool', async () => {
      mockEnd.mockResolvedValueOnce(undefined);

      await closePool();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
