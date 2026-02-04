import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { query } from '../db/index.js';
import { User } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
}

export type UserRoleType = 'admin' | 'moderator';
export type BanType = 'full' | 'comment';

export interface UserWithBanInfo extends User {
  ban_type: BanType | null;
  ban_reason: string | null;
  ban_expires_at: Date | null;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
  userRoles?: UserRoleType[];
  userBanType?: BanType | null;
}

// Generate JWT token
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// Check if ban has expired and clear it if so
async function checkAndClearExpiredBan(
  userId: string,
  banExpiresAt: Date | null
): Promise<boolean> {
  if (banExpiresAt && new Date(banExpiresAt) < new Date()) {
    await query(
      `UPDATE users SET
        ban_type = NULL,
        ban_reason = NULL,
        banned_at = NULL,
        banned_by = NULL,
        ban_expires_at = NULL
       WHERE id = $1`,
      [userId]
    );
    return true; // Ban was cleared
  }
  return false;
}

// Authentication middleware - requires valid token
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }

    // Get user from database with ban info
    const result = await query<UserWithBanInfo>(
      `SELECT id, yandex_id, name, email, avatar_url, created_at,
              ban_type, ban_reason, ban_expires_at
       FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    const user = result.rows[0];

    // Check if user has a full ban
    if (user.ban_type === 'full') {
      // Check if ban has expired
      const banCleared = await checkAndClearExpiredBan(payload.userId, user.ban_expires_at);

      if (!banCleared) {
        // Still banned
        const expiresMessage = user.ban_expires_at
          ? ` до ${new Date(user.ban_expires_at).toLocaleDateString('ru-RU')}`
          : ' навсегда';
        res.status(403).json({
          error: `Ваш аккаунт заблокирован${expiresMessage}`,
          ban_reason: user.ban_reason,
          ban_expires_at: user.ban_expires_at,
        });
        return;
      }
      // Ban was cleared, continue
      user.ban_type = null;
    }

    // Update last_login_at (fire and forget, don't wait)
    query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [
      payload.userId,
    ]).catch(err => console.error('Failed to update last_login_at:', err));

    req.user = user;
    req.userId = payload.userId;
    req.userBanType = user.ban_type; // Pass ban type for comment restrictions
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
}

// Optional authentication - attaches user if token present, but doesn't require it
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (payload) {
        const result = await query<User>(
          'SELECT id, yandex_id, name, email, avatar_url, created_at FROM users WHERE id = $1',
          [payload.userId]
        );

        if (result.rows.length > 0) {
          req.user = result.rows[0];
          req.userId = payload.userId;
        }
      }
    }

    next();
  } catch {
    // Don't fail on optional auth errors, just continue without user
    next();
  }
}
