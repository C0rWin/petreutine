import { describe, expect, it } from '@jest/globals';

import {
  AnimalType,
  createPostSchema,
  PostStatus,
  PostType,
  searchQuerySchema,
  updatePostSchema,
} from '../../types/index.js';

describe('Types and Schemas', () => {
  describe('Enums', () => {
    it('should have correct PostType values', () => {
      expect(PostType.LOST).toBe('LOST');
      expect(PostType.FOUND).toBe('FOUND');
    });

    it('should have correct AnimalType values', () => {
      expect(AnimalType.DOG).toBe('Dog');
      expect(AnimalType.CAT).toBe('Cat');
      expect(AnimalType.BIRD).toBe('Bird');
      expect(AnimalType.OTHER).toBe('Other');
    });

    it('should have correct PostStatus values', () => {
      expect(PostStatus.OPEN).toBe('OPEN');
      expect(PostStatus.RESOLVED).toBe('RESOLVED');
    });
  });

  describe('createPostSchema', () => {
    const validPost = {
      type: PostType.LOST,
      animal_type: AnimalType.DOG,
      title: 'Lost Golden Retriever',
      description: 'A friendly golden retriever went missing near the park',
      location: 'Moscow, Central Park',
      contact_info: '+7 999 123 4567',
    };

    it('should validate a valid post', () => {
      const result = createPostSchema.safeParse(validPost);
      expect(result.success).toBe(true);
    });

    it('should validate post with optional fields', () => {
      const postWithOptionals = {
        ...validPost,
        latitude: 55.7558,
        longitude: 37.6173,
        reward: '10000 руб.',
        image_url: 'https://example.com/dog.jpg',
      };
      const result = createPostSchema.safeParse(postWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should reject invalid post type', () => {
      const invalidPost = { ...validPost, type: 'INVALID' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid animal type', () => {
      const invalidPost = { ...validPost, animal_type: 'INVALID' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject title too short', () => {
      const invalidPost = { ...validPost, title: 'AB' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject title too long', () => {
      const invalidPost = { ...validPost, title: 'A'.repeat(201) };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject description too short', () => {
      const invalidPost = { ...validPost, description: 'Short' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject description too long', () => {
      const invalidPost = { ...validPost, description: 'A'.repeat(2001) };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject location too short', () => {
      const invalidPost = { ...validPost, location: 'A' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject contact_info too short', () => {
      const invalidPost = { ...validPost, contact_info: '123' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid latitude (too low)', () => {
      const invalidPost = { ...validPost, latitude: -91 };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid latitude (too high)', () => {
      const invalidPost = { ...validPost, latitude: 91 };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude (too low)', () => {
      const invalidPost = { ...validPost, longitude: -181 };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude (too high)', () => {
      const invalidPost = { ...validPost, longitude: 181 };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject invalid image_url', () => {
      const invalidPost = { ...validPost, image_url: 'not-a-url' };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidPost = { type: PostType.LOST };
      const result = createPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });
  });

  describe('updatePostSchema', () => {
    it('should validate partial update with status', () => {
      const result = updatePostSchema.safeParse({
        status: PostStatus.RESOLVED,
      });
      expect(result.success).toBe(true);
    });

    it('should validate partial update with title only', () => {
      const result = updatePostSchema.safeParse({
        title: 'Updated Title Here',
      });
      expect(result.success).toBe(true);
    });

    it('should validate empty update', () => {
      const result = updatePostSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate full update', () => {
      const result = updatePostSchema.safeParse({
        type: PostType.FOUND,
        animal_type: AnimalType.CAT,
        title: 'Found Cat',
        description: 'Found a cat near the shopping center',
        location: 'Saint Petersburg',
        contact_info: '+7 999 987 6543',
        status: PostStatus.OPEN,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = updatePostSchema.safeParse({
        status: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchQuerySchema', () => {
    it('should validate empty search query', () => {
      const result = searchQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should validate search with query string', () => {
      const result = searchQuerySchema.safeParse({ q: 'golden retriever' });
      expect(result.success).toBe(true);
    });

    it('should validate search with all filters', () => {
      const result = searchQuerySchema.safeParse({
        q: 'dog',
        type: PostType.LOST,
        animal_type: AnimalType.DOG,
        location: 'Moscow',
        status: PostStatus.OPEN,
        limit: 50,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should coerce limit and offset to numbers', () => {
      const result = searchQuerySchema.safeParse({
        limit: '30',
        offset: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(30);
        expect(result.data.offset).toBe(5);
      }
    });

    it('should reject limit too low', () => {
      const result = searchQuerySchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit too high', () => {
      const result = searchQuerySchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = searchQuerySchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject query too long', () => {
      const result = searchQuerySchema.safeParse({ q: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });
  });
});
