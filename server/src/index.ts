import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabase } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  apiLimiter,
  authLimiter,
  createPostLimiter,
  httpsRedirect,
  sanitizeInput,
  securityHeaders,
  requestLogger,
} from './middleware/security.js';
import postsRouter from './routes/posts.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import uploadRouter from './routes/upload.js';
import commentsRouter from './routes/comments.js';
import notificationsRouter from './routes/notifications.js';
import moderationRouter from './routes/moderation.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for proper IP detection behind load balancers
app.set('trust proxy', 1);

// HTTPS redirect in production
app.use(httpsRedirect);

// Security middleware - Helmet with enhanced config
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://api-maps.yandex.ru"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api-maps.yandex.ru", "https://oauth.yandex.ru"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding maps
}));

// Additional security headers
app.use(securityHeaders);

// Request logging in production
app.use(requestLogger);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize database schema
    if (process.env.AUTO_MIGRATE === 'true') {
      await initializeDatabase();
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
