// User types
export interface User {
  id: string;
  yandex_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser extends User {
  last_login_at: string | null;
  ban_type: BanType | null;
  ban_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
  ban_expires_at: string | null;
}

export interface AdminUserWithStats extends AdminUser {
  posts_count: number;
  comments_count: number;
  flagged_comments_count: number;
  rejected_comments_count: number;
  banned_by_name?: string | null;
  is_admin: boolean;
}

// Ban types
export type BanType = 'full' | 'comment';
export type BanAction = 'ban' | 'unban' | 'modify';

// Post types
export interface AdminPost {
  id: string;
  user_id: string;
  type: 'LOST' | 'FOUND';
  animal_type: string;
  status: 'OPEN' | 'RESOLVED';
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  contact_info: string;
  reward: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  comments_enabled: boolean;
  comments_disabled_by: string | null;
  comments_disabled_at: string | null;
  comments_disabled_reason: string | null;
}

export interface AdminPostWithStats extends AdminPost {
  user_name: string;
  user_email: string;
  comments_count: number;
}

// Comment types
export interface AdminComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  post_title?: string;
}

// Ban history
export interface BanHistoryEntry {
  id: string;
  user_id: string;
  admin_id: string;
  action: BanAction;
  ban_type: BanType | null;
  reason: string | null;
  duration_hours: number | null;
  created_at: string;
  admin_name?: string;
}

// Audit log
export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: 'user' | 'post' | 'comment';
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_name?: string;
}

// Statistics
export interface OverviewStats {
  total_users: number;
  new_users_today: number;
  new_users_this_week: number;
  active_users_today: number;
  total_posts: number;
  open_posts: number;
  resolved_posts: number;
  new_posts_today: number;
  new_posts_this_week: number;
  total_comments: number;
  pending_comments: number;
  flagged_comments: number;
  new_comments_today: number;
  banned_users: number;
}

export interface UserStats {
  total_users: number;
  users_by_day: { date: string; count: number }[];
  active_users_by_day: { date: string; count: number }[];
  banned_users: number;
  comment_banned_users: number;
  top_posters: { id: string; name: string; avatar_url: string | null; posts_count: number }[];
  top_commenters: {
    id: string;
    name: string;
    avatar_url: string | null;
    comments_count: number;
  }[];
}

export interface PostStats {
  total_posts: number;
  open_posts: number;
  resolved_posts: number;
  posts_by_day: { date: string; count: number }[];
  posts_by_type: { lost: number; found: number };
  posts_by_animal_type: { animal_type: string; count: number }[];
  resolution_rate: number;
  avg_time_to_resolve_hours: number | null;
}

export interface CommentStats {
  total_comments: number;
  comments_by_status: { pending: number; approved: number; rejected: number; flagged: number };
  comments_by_day: { date: string; count: number }[];
  pending_reports: number;
  avg_moderation_score: number | null;
  auto_approved_rate: number;
  manual_review_rate: number;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
