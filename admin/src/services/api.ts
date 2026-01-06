import {
  ApiResponse,
  PaginatedResponse,
  AdminUserWithStats,
  AdminPostWithStats,
  AdminComment,
  BanHistoryEntry,
  AuditLogEntry,
  OverviewStats,
  UserStats,
  PostStats,
  CommentStats,
  BanType,
} from '../types';

const API_BASE = '/api/admin';

class AdminApi {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async getUsers(params: {
    limit?: number;
    offset?: number;
    search?: string;
    sort_by?: 'created_at' | 'last_login_at' | 'name' | 'email';
    sort_order?: 'asc' | 'desc';
    ban_status?: 'all' | 'banned' | 'not_banned' | 'comment_banned' | 'full_banned';
  } = {}): Promise<ApiResponse<PaginatedResponse<AdminUserWithStats>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/users?${query}`);
  }

  async getUser(id: string): Promise<ApiResponse<AdminUserWithStats>> {
    return this.request(`/users/${id}`);
  }

  async getUserPosts(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<PaginatedResponse<AdminPostWithStats>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/users/${userId}/posts?${query}`);
  }

  async getUserComments(
    userId: string,
    params: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<ApiResponse<PaginatedResponse<AdminComment>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/users/${userId}/comments?${query}`);
  }

  async getUserBanHistory(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<PaginatedResponse<BanHistoryEntry>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/users/${userId}/ban-history?${query}`);
  }

  async banUser(
    userId: string,
    data: { ban_type: BanType; reason: string; duration_hours?: number }
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unbanUser(
    userId: string,
    data?: { reason?: string }
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/users/${userId}/unban`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // ============================================
  // POST MANAGEMENT
  // ============================================

  async getPosts(params: {
    limit?: number;
    offset?: number;
    search?: string;
    sort_by?: 'created_at' | 'updated_at' | 'title';
    sort_order?: 'asc' | 'desc';
    type?: 'all' | 'LOST' | 'FOUND';
    status?: 'all' | 'OPEN' | 'RESOLVED';
    comments_enabled?: 'all' | 'enabled' | 'disabled';
    user_id?: string;
  } = {}): Promise<ApiResponse<PaginatedResponse<AdminPostWithStats>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/posts?${query}`);
  }

  async getPost(id: string): Promise<ApiResponse<AdminPostWithStats>> {
    return this.request(`/posts/${id}`);
  }

  async togglePostComments(
    postId: string,
    data: { enabled: boolean; reason?: string }
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/posts/${postId}/toggle-comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePost(
    postId: string,
    data: { reason: string }
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/posts/${postId}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getOverviewStats(): Promise<ApiResponse<OverviewStats>> {
    return this.request('/stats/overview');
  }

  async getUserStats(days: number = 30): Promise<ApiResponse<UserStats>> {
    return this.request(`/stats/users?days=${days}`);
  }

  async getPostStats(days: number = 30): Promise<ApiResponse<PostStats>> {
    return this.request(`/stats/posts?days=${days}`);
  }

  async getCommentStats(days: number = 30): Promise<ApiResponse<CommentStats>> {
    return this.request(`/stats/comments?days=${days}`);
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  async getAuditLog(params: {
    limit?: number;
    offset?: number;
    admin_id?: string;
    target_type?: 'all' | 'user' | 'post' | 'comment';
    action?: string;
  } = {}): Promise<ApiResponse<PaginatedResponse<AuditLogEntry>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return this.request(`/audit-log?${query}`);
  }
}

export const adminApi = new AdminApi();
