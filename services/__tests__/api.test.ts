import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';
import { PostType, AnimalType } from '../../types';

describe('ApiService', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    api.setToken(null);
    api.setUserId(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token management', () => {
    it('should set and get token', () => {
      expect(api.getToken()).toBeNull();
      api.setToken('test-token');
      expect(api.getToken()).toBe('test-token');
    });

    it('should set and get userId', () => {
      expect(api.getUserId()).toBeNull();
      api.setUserId('user-123');
      expect(api.getUserId()).toBe('user-123');
    });
  });

  describe('getPosts', () => {
    it('should fetch posts without filters', async () => {
      const mockPosts = { posts: [], total: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPosts),
      });

      const result = await api.getPosts();

      expect(mockFetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }));
      expect(result.data).toEqual(mockPosts);
    });

    it('should fetch posts with type filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ posts: [], total: 0 }),
      });

      await api.getPosts({ type: PostType.LOST });

      expect(mockFetch).toHaveBeenCalledWith('/api/posts?type=LOST', expect.any(Object));
    });

    it('should fetch posts with all filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ posts: [], total: 0 }),
      });

      await api.getPosts({
        type: PostType.FOUND,
        animal_type: AnimalType.DOG,
        status: 'OPEN',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=FOUND'),
        expect.any(Object)
      );
    });
  });

  describe('getPost', () => {
    it('should fetch a single post by id', async () => {
      const mockPost = { id: 'post-1', title: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPost),
      });

      const result = await api.getPost('post-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/posts/post-1', expect.any(Object));
      expect(result.data).toEqual(mockPost);
    });
  });

  describe('getMyPosts', () => {
    it('should fetch current user posts', async () => {
      const mockPosts = { posts: [], total: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPosts),
      });

      const result = await api.getMyPosts();

      expect(mockFetch).toHaveBeenCalledWith('/api/posts/my', expect.any(Object));
      expect(result.data).toEqual(mockPosts);
    });
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      const mockPost = { id: 'new-post', title: 'New Pet' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPost),
      });

      const result = await api.createPost({
        type: PostType.LOST,
        title: 'Lost Dog',
        description: 'A friendly dog',
        location: 'Moscow',
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }));
      expect(result.data).toEqual(mockPost);
    });
  });

  describe('updatePost', () => {
    it('should update a post', async () => {
      const mockPost = { id: 'post-1', title: 'Updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPost),
      });

      const result = await api.updatePost('post-1', { title: 'Updated Title' });

      expect(mockFetch).toHaveBeenCalledWith('/api/posts/post-1', expect.objectContaining({
        method: 'PUT',
      }));
      expect(result.data).toEqual(mockPost);
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      await api.deletePost('post-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/posts/post-1', expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });

  describe('search', () => {
    it('should search posts with query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ posts: [], total: 0, limit: 20, offset: 0 }),
      });

      await api.search('golden retriever');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=golden+retriever'),
        expect.any(Object)
      );
    });

    it('should search with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ posts: [], total: 0, limit: 10, offset: 0 }),
      });

      await api.search('dog', {
        type: PostType.LOST,
        limit: 10,
        offset: 0,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=LOST'),
        expect.any(Object)
      );
    });
  });

  describe('findMatches', () => {
    it('should find matches for a post', async () => {
      const mockMatches = { matches: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMatches),
      });

      const result = await api.findMatches('post-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/search/matches/post-1', expect.any(Object));
      expect(result.data).toEqual(mockMatches);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user', async () => {
      const mockUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      const result = await api.getCurrentUser();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await api.logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST',
      }));
      expect(result.data).toEqual({ success: true });
    });
  });

  describe('Authorization header', () => {
    it('should include Authorization header when token is set', async () => {
      api.setToken('test-jwt-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.getPosts();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
          }),
        })
      );
    });

    it('should not include Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.getPosts();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should return error on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const result = await api.getPost('nonexistent');

      expect(result.error).toBe('Not found');
      expect(result.data).toBeUndefined();
    });

    it('should return generic error on HTTP error without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('JSON parse error')),
      });

      const result = await api.getPost('post-1');

      expect(result.error).toBe('HTTP error 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.getPosts();

      expect(result.error).toBe('Network error');
    });
  });

  describe('uploadImage', () => {
    it('should upload an image', async () => {
      const mockResponse = { url: 'https://example.com/image.jpg', thumbnail: 'https://example.com/thumb.jpg', isBase64: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await api.uploadImage(file);

      expect(mockFetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }));
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle upload error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid file' }),
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await api.uploadImage(file);

      expect(result.error).toBe('Invalid file');
    });
  });
});
