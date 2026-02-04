-- Performance indexes for admin stats queries
-- These are partial indexes optimized for common query patterns

-- Posts by status (for dashboard counts)
CREATE INDEX IF NOT EXISTS idx_posts_status_open ON posts(id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_posts_status_resolved ON posts(id) WHERE status = 'RESOLVED';

-- Comments by status (for moderation counts)
CREATE INDEX IF NOT EXISTS idx_comments_status_pending ON comments(id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_comments_status_flagged ON comments(id) WHERE status = 'flagged';
CREATE INDEX IF NOT EXISTS idx_comments_status_approved ON comments(id) WHERE status = 'approved';

-- Users with bans (for admin user counts)
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(id) WHERE ban_type IS NOT NULL;

-- Covering index for top posters query
CREATE INDEX IF NOT EXISTS idx_posts_user_id_covering ON posts(user_id) INCLUDE (id);
