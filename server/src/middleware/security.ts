import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Слишком много запросов. Попробуйте позже.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Слишком много попыток входа. Попробуйте через 15 минут.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for post creation
export const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 posts per hour
  message: {
    error: 'Превышен лимит создания объявлений. Попробуйте позже.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// HTTPS redirect middleware for production
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  // Skip HTTPS redirect for health checks (internal requests)
  if (req.path === '/health') {
    next();
    return;
  }

  // Skip if no x-forwarded-proto header (internal/direct requests)
  if (!req.headers['x-forwarded-proto']) {
    next();
    return;
  }

  // Check if we're in production and request is not secure
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    // Redirect to HTTPS
    res.redirect(301, `https://${req.headers.host}${req.url}`);
    return;
  }
  next();
}

// Sanitize string input to prevent XSS
function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Recursively sanitize object values
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => (typeof item === 'string' ? sanitizeString(item) : item));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Input sanitization middleware
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }

  // Sanitize query params
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeString(value);
      }
    }
  }

  next();
}

// Security headers for API responses
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  next();
}

// Request logging middleware for security monitoring
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    // Log to stdout for cloud logging services
    console.log(JSON.stringify(logData));
  }

  next();
}
