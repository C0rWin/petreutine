-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yandex_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Post type enum
DO $$ BEGIN
    CREATE TYPE post_type AS ENUM ('LOST', 'FOUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Animal type enum
DO $$ BEGIN
    CREATE TYPE animal_type AS ENUM ('Dog', 'Cat', 'Bird', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Post status enum
DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type post_type NOT NULL,
    animal_type animal_type NOT NULL,
    status post_status NOT NULL DEFAULT 'OPEN',
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(200) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_info VARCHAR(200) NOT NULL,
    reward VARCHAR(50),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Full-text search vector column
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('russian', coalesce(location, '')), 'C')
    ) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_animal_type ON posts(animal_type);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(location);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(search_vector);

-- Trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_description_trgm ON posts USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_location_trgm ON posts USING GIN(location gin_trgm_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sessions table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- COMMENTS SYSTEM
-- ============================================

-- Comment status enum for moderation
DO $$ BEGIN
    CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vote type enum
DO $$ BEGIN
    CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report status enum
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification type enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'comment_reply',
        'post_comment',
        'comment_upvote',
        'moderation_approved',
        'moderation_rejected',
        'moderation_alert'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Comments table (Adjacency List with Materialized Path for threading)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,

    -- Moderation
    status comment_status NOT NULL DEFAULT 'pending',
    ai_moderation_score DECIMAL(3, 2),
    ai_moderation_reason TEXT,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP WITH TIME ZONE,

    -- Denormalized vote counts for performance
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,

    -- Threading metadata
    depth INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL DEFAULT '',
    reply_count INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_path ON comments(path text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_score ON comments(score DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_status ON comments(post_id, status);

-- Trigger for comments updated_at
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment votes table
CREATE TABLE IF NOT EXISTS comment_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type vote_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_comment_vote UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes(user_id);

-- Comment reports table
CREATE TABLE IF NOT EXISTS comment_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    reason VARCHAR(50) NOT NULL,
    description TEXT,

    status report_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_report UNIQUE (comment_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_created_at ON comment_reports(created_at DESC);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    related_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    related_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- User roles table for moderation
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- ============================================
-- COMMENT SYSTEM HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update reply_count on parent comments
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reply_count ON comments;
CREATE TRIGGER trigger_update_reply_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_reply_count();

-- Function to update vote counts on comments
CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE comments SET upvotes = upvotes - 1 WHERE id = OLD.comment_id;
        ELSE
            UPDATE comments SET downvotes = downvotes - 1 WHERE id = OLD.comment_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.vote_type != NEW.vote_type THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE comments SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE comments SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vote_counts ON comment_votes;
CREATE TRIGGER trigger_update_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON comment_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_vote_counts();

-- Function to set comment path after insert
CREATE OR REPLACE FUNCTION set_comment_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
    parent_depth INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := NEW.id::TEXT;
        NEW.depth := 0;
    ELSE
        SELECT path, depth INTO parent_path, parent_depth
        FROM comments WHERE id = NEW.parent_id;

        NEW.path := parent_path || '.' || NEW.id::TEXT;
        NEW.depth := parent_depth + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_comment_path ON comments;
CREATE TRIGGER trigger_set_comment_path
    BEFORE INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION set_comment_path();

-- ============================================
-- ADMIN PANEL SYSTEM
-- ============================================

-- Ban type enum
DO $$ BEGIN
    CREATE TYPE ban_type AS ENUM ('full', 'comment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add admin-related columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_type ban_type;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_ban_type ON users(ban_type) WHERE ban_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_ban_expires ON users(ban_expires_at) WHERE ban_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

-- Add comments_enabled columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_disabled_by UUID REFERENCES users(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_disabled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_disabled_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_comments_enabled ON posts(comments_enabled) WHERE comments_enabled = FALSE;

-- Ban action type enum
DO $$ BEGIN
    CREATE TYPE ban_action AS ENUM ('ban', 'unban', 'modify');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ban history table
CREATE TABLE IF NOT EXISTS ban_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    action ban_action NOT NULL,
    ban_type ban_type,
    reason TEXT,
    duration_hours INTEGER, -- NULL = permanent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ban_history_user_id ON ban_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_history_created_at ON ban_history(created_at DESC);

-- Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(20) NOT NULL, -- 'user', 'post', 'comment'
    target_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- Function to check if user ban has expired
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_ban_type ban_type;
    user_ban_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT ban_type, ban_expires_at INTO user_ban_type, user_ban_expires
    FROM users WHERE id = p_user_id;

    -- No ban
    IF user_ban_type IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if ban has expired
    IF user_ban_expires IS NOT NULL AND user_ban_expires < CURRENT_TIMESTAMP THEN
        -- Auto-clear expired ban
        UPDATE users SET
            ban_type = NULL,
            ban_reason = NULL,
            banned_at = NULL,
            banned_by = NULL,
            ban_expires_at = NULL
        WHERE id = p_user_id;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can comment (not full banned or comment banned)
CREATE OR REPLACE FUNCTION can_user_comment(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_ban_type ban_type;
    user_ban_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT ban_type, ban_expires_at INTO user_ban_type, user_ban_expires
    FROM users WHERE id = p_user_id;

    -- No ban
    IF user_ban_type IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if ban has expired
    IF user_ban_expires IS NOT NULL AND user_ban_expires < CURRENT_TIMESTAMP THEN
        -- Auto-clear expired ban
        UPDATE users SET
            ban_type = NULL,
            ban_reason = NULL,
            banned_at = NULL,
            banned_by = NULL,
            ban_expires_at = NULL
        WHERE id = p_user_id;
        RETURN TRUE;
    END IF;

    -- Both full and comment bans prevent commenting
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- OAUTH STATE STORAGE
-- ============================================

-- OAuth states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_token VARCHAR(64) NOT NULL UNIQUE,
    redirect_to VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Function to clean up expired OAuth states (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_states WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FEEDBACK / CONTACT MESSAGES
-- Submitted from the public site's contact form; read in the admin panel.
-- =============================================
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120),
    email VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_unread ON feedback(is_read) WHERE is_read = FALSE;
