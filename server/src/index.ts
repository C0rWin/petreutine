import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import pool, { initializeDatabase } from './db/index.js';
import { largeBodyParser, payloadTooLargeHandler } from './middleware/bodyParser.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  apiLimiter,
  authLimiter,
  httpsRedirect,
  requestLogger,
  securityHeaders,
} from './middleware/security.js';
import adminRouter from './routes/admin/index.js';
import authRouter from './routes/auth.js';
import commentsRouter from './routes/comments.js';
import moderationRouter from './routes/moderation.js';
import notificationsRouter from './routes/notifications.js';
import postsRouter from './routes/posts.js';
import searchRouter from './routes/search.js';
import uploadRouter from './routes/upload.js';
import { registerEventHandlers } from './services/events.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for proper IP detection behind load balancers
app.set('trust proxy', 1);

// HTTPS redirect in production
app.use(httpsRedirect);

// Security middleware - Helmet with enhanced config
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://api-maps.yandex.ru'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://api-maps.yandex.ru', 'https://oauth.yandex.ru'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding maps
  })
);

// Additional security headers
app.use(securityHeaders);

// Request logging in production
app.use(requestLogger);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Large body parser for upload routes (must be before global parser)
app.use('/api/upload', largeBodyParser);
app.use('/upload', largeBodyParser);

// Body parsing with size limits (1MB default, use largeBodyParser for upload routes)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NOTE: global input HTML-encoding was removed. It corrupted stored data by
// entity-encoding every string in the body (e.g. image URLs became
// https:&#x2F;&#x2F;... and would not load). SQL injection is prevented by
// parameterized queries and output XSS by React's JSX escaping.

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Internal endpoint for database connection status (protected by ADMIN_API_KEY)
app.get('/internal/db-url', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers['x-admin-key'];

  if (!adminKey) {
    res.status(503).json({ error: 'ADMIN_API_KEY not configured' });
    return;
  }

  if (!providedKey || providedKey !== adminKey) {
    res.status(401).json({ error: 'Invalid or missing X-Admin-Key header' });
    return;
  }

  try {
    // Measure query latency
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    res.json({
      status: 'connected',
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Internal endpoint for resetting the database (protected by ADMIN_API_KEY)
app.post('/internal/db-reset', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers['x-admin-key'];
  const confirmHeader = req.headers['x-confirm-reset'];

  if (!adminKey) {
    res.status(503).json({ error: 'ADMIN_API_KEY not configured' });
    return;
  }

  if (!providedKey || providedKey !== adminKey) {
    res.status(401).json({ error: 'Invalid or missing X-Admin-Key header' });
    return;
  }

  if (confirmHeader !== 'DELETE ALL DATA') {
    res.status(400).json({ error: 'Missing X-Confirm-Reset header with value "DELETE ALL DATA"' });
    return;
  }

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`
      DROP TABLE IF EXISTS admin_audit_log CASCADE;
      DROP TABLE IF EXISTS ban_history CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS comment_reports CASCADE;
      DROP TABLE IF EXISTS comment_votes CASCADE;
      DROP TABLE IF EXISTS comments CASCADE;
      DROP TABLE IF EXISTS user_roles CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS posts CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TYPE IF EXISTS ban_action CASCADE;
      DROP TYPE IF EXISTS ban_type CASCADE;
      DROP TYPE IF EXISTS notification_type CASCADE;
      DROP TYPE IF EXISTS report_status CASCADE;
      DROP TYPE IF EXISTS vote_type CASCADE;
      DROP TYPE IF EXISTS comment_status CASCADE;
      DROP TYPE IF EXISTS post_status CASCADE;
      DROP TYPE IF EXISTS animal_type CASCADE;
      DROP TYPE IF EXISTS post_type CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
      DROP FUNCTION IF EXISTS update_reply_count CASCADE;
      DROP FUNCTION IF EXISTS update_comment_vote_counts CASCADE;
      DROP FUNCTION IF EXISTS set_comment_path CASCADE;
      DROP FUNCTION IF EXISTS is_user_banned CASCADE;
      DROP FUNCTION IF EXISTS can_user_comment CASCADE;
    `);

    await pool.end();

    res.json({
      success: true,
      message: 'Database reset complete. Restart the app to recreate schema.',
    });
  } catch (error) {
    console.error('Database reset error:', error);
    res.status(500).json({ error: 'Database reset failed', details: String(error) });
  }
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);
app.use(apiLimiter); // Also apply to routes without /api prefix (DO may strip it)

// API routes with specific rate limits
// Mount routes both with and without /api prefix for DO App Platform compatibility
app.use('/api/posts', postsRouter);
app.use('/posts', postsRouter);
app.use('/api/search', searchRouter);
app.use('/search', searchRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/auth', authLimiter, authRouter);
app.use('/api/upload', uploadRouter);
app.use('/upload', uploadRouter);
app.use('/api/comments', commentsRouter);
app.use('/comments', commentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/notifications', notificationsRouter);
app.use('/api/moderation', moderationRouter);
app.use('/moderation', moderationRouter);
app.use('/api/admin', adminRouter);
app.use('/admin', adminRouter);

// Error handling
app.use(notFoundHandler);
app.use(payloadTooLargeHandler); // Handle 413 with helpful message
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  try {
    // Initialize database schema
    if (process.env.AUTO_MIGRATE === 'true') {
      await initializeDatabase();
    }

    // Register event handlers
    await registerEventHandlers();

    app.listen(PORT, () => {
      // Server started successfully
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
