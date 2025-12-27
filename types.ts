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

export interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  avatarUrl?: string;
}

export interface PetPost {
  id: string;
  userId: string;
  user: User;
  type: PostType;
  animalType: AnimalType;
  status: 'OPEN' | 'RESOLVED';
  title: string;
  description: string;
  location: string;
  contactInfo: string;
  reward?: string;
  imageUrl?: string; // Base64 or URL
  createdAt: number;
}

export interface GeminiMatchResult {
  postId: string;
  reason: string;
  confidence: number;
}