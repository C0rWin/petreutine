import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { User } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Yandex OAuth configuration
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || '';
const YANDEX_REDIRECT_URI = process.env.YANDEX_REDIRECT_URI || 'http://localhost:3001/api/auth/yandex/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Yandex OAuth URLs
const YANDEX_AUTH_URL = 'https://oauth.yandex.ru/authorize';
const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_USER_INFO_URL = 'https://login.yandex.ru/info';

interface YandexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface YandexUserInfo {
  id: string;
  login: string;
  default_email: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
}

// Get current authenticated user
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

// Initiate Yandex OAuth flow
router.get('/yandex', (_req: Request, res: Response) => {
  if (!YANDEX_CLIENT_ID) {
    res.status(500).json({ error: 'Yandex OAuth не настроен' });
    return;
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: YANDEX_CLIENT_ID,
    redirect_uri: YANDEX_REDIRECT_URI,
    scope: 'login:email login:info login:avatar',
  });

  res.redirect(`${YANDEX_AUTH_URL}?${params.toString()}`);
});

// Handle Yandex OAuth callback
router.get('/yandex/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('Yandex OAuth error:', error);
      res.redirect(`${FRONTEND_URL}?error=oauth_denied`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${FRONTEND_URL}?error=no_code`);
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch(YANDEX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_CLIENT_SECRET,
        redirect_uri: YANDEX_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Yandex token error:', errorText);
      res.redirect(`${FRONTEND_URL}?error=token_error`);
      return;
    }

    const tokenData = await tokenResponse.json() as YandexTokenResponse;

    // Get user info from Yandex
    const userInfoResponse = await fetch(`${YANDEX_USER_INFO_URL}?format=json`, {
      headers: {
        Authorization: `OAuth ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('Yandex user info error:', errorText);
      res.redirect(`${FRONTEND_URL}?error=user_info_error`);
      return;
    }

    const yandexUser = await userInfoResponse.json() as YandexUserInfo;

    // Build user name
    const userName = yandexUser.real_name ||
      yandexUser.display_name ||
      (yandexUser.first_name && yandexUser.last_name
        ? `${yandexUser.first_name} ${yandexUser.last_name}`
        : yandexUser.login);

    // Build avatar URL
    const avatarUrl = yandexUser.is_avatar_empty
      ? null
      : `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`;

    // Find or create user in database
    let user: User;

    const existingUser = await query<User>(
      'SELECT * FROM users WHERE yandex_id = $1',
      [yandexUser.id]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      const updateResult = await query<User>(
        `UPDATE users
         SET name = $1, email = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE yandex_id = $4
         RETURNING id, yandex_id, name, email, avatar_url, created_at`,
        [userName, yandexUser.default_email, avatarUrl, yandexUser.id]
      );
      user = updateResult.rows[0];
    } else {
      // Check if this will be the first user (for auto-admin)
      const userCountResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users'
      );
      const isFirstUser = parseInt(userCountResult.rows[0].count, 10) === 0;

      // Create new user
      const insertResult = await query<User>(
        `INSERT INTO users (yandex_id, name, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, yandex_id, name, email, avatar_url, created_at`,
        [yandexUser.id, userName, yandexUser.default_email, avatarUrl]
      );
      user = insertResult.rows[0];

      // Auto-grant admin role to first user
      if (isFirstUser) {
        await query(
          `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`,
          [user.id]
        );
        console.log(`First user ${user.email} auto-granted admin role`);
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Redirect to frontend with token (use root path for SPA compatibility)
    res.redirect(`${FRONTEND_URL}/?token=${token}`);
  } catch (error) {
    console.error('Yandex OAuth callback error:', error);
    next(error);
  }
});

// Logout (client-side token removal, but we can also add token blacklisting here)
router.post('/logout', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  // For now, just return success - client should remove token
  // In production, you might want to blacklist the token or clear sessions
  res.json({ success: true });
});

// Development only: Create mock user for testing without Yandex OAuth
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/create-user', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body;

      if (!name || !email) {
        throw new AppError('Name and email are required', 400);
      }

      // Check if this will be the first user (for auto-admin)
      const userCountResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users'
      );
      const isFirstUser = parseInt(userCountResult.rows[0].count, 10) === 0;

      const yandexId = `dev_${Date.now()}`;

      const result = await query<User>(
        `INSERT INTO users (yandex_id, name, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, yandex_id, name, email, avatar_url, created_at`,
        [yandexId, name, email, 'https://avatars.yandex.net/get-yapic/0/0-0/islands-200']
      );

      const user = result.rows[0];

      // Auto-grant admin role to first user
      if (isFirstUser) {
        await query(
          `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`,
          [user.id]
        );
        console.log(`First user ${user.email} auto-granted admin role`);
      }

      // Generate token for dev user
      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      res.status(201).json({ user, token, isAdmin: isFirstUser });
    } catch (error) {
      next(error);
    }
  });
}

export default router;
