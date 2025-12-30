import { PetPost, User, PostType, AnimalType } from '../types';

// In development, Vite proxies /api to the backend
// In production, the API is served from the same domain
const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface PostsResponse {
  posts: PetPost[];
  total: number;
}

interface SearchResponse {
  posts: PetPost[];
  total: number;
  limit: number;
  offset: number;
}

interface MatchResult {
  id: string;
  confidence: number;
  reason: string;
  post: PetPost;
}

interface MatchesResponse {
  matches: (PetPost & { confidence: number; reason: string })[];
}

interface AuthResponse {
  user: User;
  token: string;
}

class ApiService {
  private token: string | null = null;
  private userId: string | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || `HTTP error ${response.status}` };
      }

      if (response.status === 204) {
        return { data: undefined as T };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  getUserId(): string | null {
    return this.userId;
  }

  // Posts
  async getPosts(filters?: {
    type?: PostType;
    animal_type?: AnimalType;
    status?: 'OPEN' | 'RESOLVED';
  }): Promise<ApiResponse<PostsResponse>> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.animal_type) params.set('animal_type', filters.animal_type);
    if (filters?.status) params.set('status', filters.status);

    const queryString = params.toString();
    return this.request<PostsResponse>(`/api/posts${queryString ? `?${queryString}` : ''}`);
  }

  async getPost(id: string): Promise<ApiResponse<PetPost>> {
    return this.request<PetPost>(`/api/posts/${id}`);
  }

  async createPost(post: Omit<PetPost, 'id' | 'userId' | 'user' | 'createdAt' | 'status'> & { latitude?: number; longitude?: number }): Promise<ApiResponse<PetPost>> {
    return this.request<PetPost>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: post.type,
        animal_type: post.animalType,
        title: post.title,
        description: post.description,
        location: post.location,
        latitude: post.latitude,
        longitude: post.longitude,
        contact_info: post.contactInfo,
        reward: post.reward,
        image_url: post.imageUrl,
      }),
    });
  }

  async updatePost(id: string, updates: Partial<PetPost>): Promise<ApiResponse<PetPost>> {
    const body: Record<string, unknown> = {};
    if (updates.type) body.type = updates.type;
    if (updates.animalType) body.animal_type = updates.animalType;
    if (updates.title) body.title = updates.title;
    if (updates.description) body.description = updates.description;
    if (updates.location) body.location = updates.location;
    if (updates.contactInfo) body.contact_info = updates.contactInfo;
    if (updates.reward !== undefined) body.reward = updates.reward;
    if (updates.imageUrl !== undefined) body.image_url = updates.imageUrl;
    if (updates.status) body.status = updates.status;

    return this.request<PetPost>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deletePost(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/posts/${id}`, {
      method: 'DELETE',
    });
  }

  // Search
  async search(query: string, filters?: {
    type?: PostType;
    animal_type?: AnimalType;
    location?: string;
    status?: 'OPEN' | 'RESOLVED';
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<SearchResponse>> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.animal_type) params.set('animal_type', filters.animal_type);
    if (filters?.location) params.set('location', filters.location);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());

    return this.request<SearchResponse>(`/api/search?${params.toString()}`);
  }

  // Find potential matches for a post
  async findMatches(postId: string): Promise<ApiResponse<MatchesResponse>> {
    return this.request<MatchesResponse>(`/api/search/matches/${postId}`);
  }

  // Auth
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/api/auth/me');
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  // Development only: create mock user
  async createDevUser(name: string, email: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/api/auth/dev/create-user', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });
  }

  // Image upload
  async uploadImage(file: File): Promise<ApiResponse<{ url: string; thumbnail: string; isBase64: boolean }>> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || `Ошибка загрузки: ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('Upload failed:', error);
      return { error: error instanceof Error ? error.message : 'Ошибка сети' };
    }
  }
}

export const api = new ApiService();
