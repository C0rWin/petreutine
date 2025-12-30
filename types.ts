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
  yandex_id?: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
  // Legacy support
  verified?: boolean;
  avatarUrl?: string;
}

export interface PetPost {
  id: string;
  user_id?: string;
  userId?: string; // Legacy support
  user: User;
  type: PostType;
  animal_type?: AnimalType;
  animalType?: AnimalType; // Legacy support
  status: 'OPEN' | 'RESOLVED';
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  contact_info?: string;
  contactInfo?: string; // Legacy support
  reward?: string;
  image_url?: string;
  imageUrl?: string; // Legacy support
  created_at?: string;
  createdAt?: number; // Legacy support
  updated_at?: string;
}

export interface MatchResult {
  postId: string;
  reason: string;
  confidence: number;
}

// Helper to normalize post data from API
export function normalizePost(post: PetPost): PetPost {
  return {
    ...post,
    userId: post.user_id || post.userId,
    animalType: post.animal_type || post.animalType,
    contactInfo: post.contact_info || post.contactInfo,
    imageUrl: post.image_url || post.imageUrl,
    createdAt: post.created_at ? new Date(post.created_at).getTime() : post.createdAt,
    user: {
      ...post.user,
      avatarUrl: post.user.avatar_url || post.user.avatarUrl,
      verified: true, // All DB users are considered verified
    },
  };
}

// Helper to normalize user data from API
export function normalizeUser(user: User): User {
  return {
    ...user,
    avatarUrl: user.avatar_url || user.avatarUrl,
    verified: true,
  };
}
