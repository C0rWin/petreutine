import { describe, it, expect } from 'vitest';
import { PostType, AnimalType, normalizePost, normalizeUser, PetPost, User } from '../../types';

describe('Types and Enums', () => {
  describe('PostType enum', () => {
    it('should have LOST value', () => {
      expect(PostType.LOST).toBe('LOST');
    });

    it('should have FOUND value', () => {
      expect(PostType.FOUND).toBe('FOUND');
    });
  });

  describe('AnimalType enum', () => {
    it('should have DOG value', () => {
      expect(AnimalType.DOG).toBe('Dog');
    });

    it('should have CAT value', () => {
      expect(AnimalType.CAT).toBe('Cat');
    });

    it('should have BIRD value', () => {
      expect(AnimalType.BIRD).toBe('Bird');
    });

    it('should have OTHER value', () => {
      expect(AnimalType.OTHER).toBe('Other');
    });
  });

  describe('normalizePost', () => {
    const mockUser: User = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    };

    it('should normalize snake_case fields to camelCase', () => {
      const post: PetPost = {
        id: 'post-1',
        user: mockUser,
        user_id: 'user-1',
        type: PostType.LOST,
        status: 'OPEN',
        title: 'Test',
        description: 'Test description',
        location: 'Moscow',
        animal_type: AnimalType.DOG,
        contact_info: '+7 999 123 4567',
        image_url: 'https://example.com/image.jpg',
        created_at: '2024-01-15T10:00:00Z',
      };

      const normalized = normalizePost(post);

      expect(normalized.userId).toBe('user-1');
      expect(normalized.animalType).toBe(AnimalType.DOG);
      expect(normalized.contactInfo).toBe('+7 999 123 4567');
      expect(normalized.imageUrl).toBe('https://example.com/image.jpg');
      expect(normalized.createdAt).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    it('should preserve existing camelCase fields', () => {
      const post: PetPost = {
        id: 'post-1',
        user: mockUser,
        userId: 'user-1',
        type: PostType.FOUND,
        status: 'OPEN',
        title: 'Test',
        description: 'Test description',
        location: 'Moscow',
        animalType: AnimalType.CAT,
        contactInfo: 'email@example.com',
        imageUrl: 'https://example.com/cat.jpg',
        createdAt: 1705312800000,
      };

      const normalized = normalizePost(post);

      expect(normalized.userId).toBe('user-1');
      expect(normalized.animalType).toBe(AnimalType.CAT);
      expect(normalized.contactInfo).toBe('email@example.com');
      expect(normalized.imageUrl).toBe('https://example.com/cat.jpg');
      expect(normalized.createdAt).toBe(1705312800000);
    });

    it('should normalize user avatar_url', () => {
      const postWithAvatarUrl: PetPost = {
        id: 'post-1',
        user: {
          ...mockUser,
          avatar_url: 'https://example.com/avatar.jpg',
        },
        type: PostType.LOST,
        status: 'OPEN',
        title: 'Test',
        description: 'Test',
        location: 'Test',
      };

      const normalized = normalizePost(postWithAvatarUrl);

      expect(normalized.user.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(normalized.user.verified).toBe(true);
    });

    it('should set verified to true for all users', () => {
      const post: PetPost = {
        id: 'post-1',
        user: { ...mockUser, verified: false },
        type: PostType.LOST,
        status: 'OPEN',
        title: 'Test',
        description: 'Test',
        location: 'Test',
      };

      const normalized = normalizePost(post);

      expect(normalized.user.verified).toBe(true);
    });
  });

  describe('normalizeUser', () => {
    it('should normalize avatar_url to avatarUrl', () => {
      const user: User = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const normalized = normalizeUser(user);

      expect(normalized.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should preserve existing avatarUrl', () => {
      const user: User = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/existing.jpg',
      };

      const normalized = normalizeUser(user);

      expect(normalized.avatarUrl).toBe('https://example.com/existing.jpg');
    });

    it('should set verified to true', () => {
      const user: User = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        verified: false,
      };

      const normalized = normalizeUser(user);

      expect(normalized.verified).toBe(true);
    });

    it('should preserve all original fields', () => {
      const user: User = {
        id: 'user-1',
        yandex_id: 'yandex-123',
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      const normalized = normalizeUser(user);

      expect(normalized.id).toBe('user-1');
      expect(normalized.yandex_id).toBe('yandex-123');
      expect(normalized.name).toBe('Test User');
      expect(normalized.email).toBe('test@example.com');
      expect(normalized.created_at).toBe('2024-01-01T00:00:00Z');
    });
  });
});
