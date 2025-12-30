import { z } from 'zod';

export enum PostType {
  LOST = 'LOST',
  FOUND = 'FOUND',
}

export enum AnimalType {
  DOG = 'Dog',
  CAT = 'Cat',
  BIRD = 'Bird',
  OTHER = 'Other',
}

export enum PostStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export interface User {
  id: string;
  yandex_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: Date;
}

export interface PetPost {
  id: string;
  user_id: string;
  type: PostType;
  animal_type: AnimalType;
  status: PostStatus;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  contact_info: string;
  reward?: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PetPostWithUser extends PetPost {
  user: User;
}

// Zod schemas for validation
export const createPostSchema = z.object({
  type: z.nativeEnum(PostType),
  animal_type: z.nativeEnum(AnimalType),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  location: z.string().min(2).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contact_info: z.string().min(5).max(200),
  reward: z.string().max(50).optional(),
  image_url: z.string().url().optional(),
});

export const updatePostSchema = createPostSchema.partial().extend({
  status: z.nativeEnum(PostStatus).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  type: z.nativeEnum(PostType).optional(),
  animal_type: z.nativeEnum(AnimalType).optional(),
  location: z.string().max(200).optional(),
  status: z.nativeEnum(PostStatus).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
