import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AppError } from './errorHandler.js';
import { AuthenticatedRequest, UserRoleType } from './auth.js';

// Cache for user roles (simple in-memory, clears on restart)
const roleCache = new Map<string, { roles: UserRoleType[]; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user roles from database (with caching)
 */
async function getUserRoles(userId: string): Promise<UserRoleType[]> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.roles;
  }

  const result = await query<{ role: UserRoleType }>(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );

  const roles = result.rows.map(r => r.role);
  roleCache.set(userId, { roles, cachedAt: Date.now() });

  return roles;
}

/**
 * Clear role cache for a user (call after role changes)
 */
export function clearRoleCache(userId: string): void {
  roleCache.delete(userId);
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: UserRoleType[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError('Требуется авторизация', 401);
      }

      const userRoles = await getUserRoles(req.userId);

      // Admin has access to everything
      if (userRoles.includes('admin')) {
        req.userRoles = userRoles;
        return next();
      }

      // Check if user has any of the allowed roles
      const hasRole = allowedRoles.some(role => userRoles.includes(role));
      if (!hasRole) {
        throw new AppError('Недостаточно прав для выполнения этого действия', 403);
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require moderator or admin role
 */
export const requireModerator = requireRole('moderator', 'admin');

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Optional role check - attaches roles to request if authenticated
 */
export async function attachRoles(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (req.userId) {
      req.userRoles = await getUserRoles(req.userId);
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Re-export UserRoleType for convenience
export { UserRoleType };
