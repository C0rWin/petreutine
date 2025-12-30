import { Router, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import {
  createPostSchema,
  updatePostSchema,
  PetPostWithUser,
  CreatePostInput,
  UpdatePostInput,
} from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { createPostLimiter } from '../middleware/security.js';

const router = Router();

// Get all posts (with optional filters) - public
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { type, animal_type, status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        p.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar_url', u.avatar_url,
          'yandex_id', u.yandex_id,
          'created_at', u.created_at
        ) as user
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (type) {
      queryText += ` AND p.type = $${paramIndex++}`;
      params.push(type);
    }

    if (animal_type) {
      queryText += ` AND p.animal_type = $${paramIndex++}`;
      params.push(animal_type);
    }

    if (status) {
      queryText += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    queryText += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query<PetPostWithUser>(queryText, params);

    res.json({
      posts: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
});

// Get single post by ID - public
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query<PetPostWithUser>(
      `
      SELECT
        p.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar_url', u.avatar_url,
          'yandex_id', u.yandex_id,
          'created_at', u.created_at
        ) as user
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Объявление не найдено', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create new post - requires authentication + rate limiting
router.post('/', createPostLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const data: CreatePostInput = createPostSchema.parse(req.body);

    const result = await query<PetPostWithUser>(
      `
      WITH inserted_post AS (
        INSERT INTO posts (
          user_id, type, animal_type, title, description,
          location, latitude, longitude, contact_info, reward, image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      )
      SELECT
        p.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar_url', u.avatar_url,
          'yandex_id', u.yandex_id,
          'created_at', u.created_at
        ) as user
      FROM inserted_post p
      JOIN users u ON p.user_id = u.id
    `,
      [
        userId,
        data.type,
        data.animal_type,
        data.title,
        data.description,
        data.location,
        data.latitude || null,
        data.longitude || null,
        data.contact_info,
        data.reward || null,
        data.image_url || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update post - requires authentication and ownership
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Check ownership
    const ownerCheck = await query<{ user_id: string }>('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0) {
      throw new AppError('Объявление не найдено', 404);
    }
    if (ownerCheck.rows[0].user_id !== userId) {
      throw new AppError('Нет прав на редактирование этого объявления', 403);
    }

    const data: UpdatePostInput = updatePostSchema.parse(req.body);

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      throw new AppError('Нет полей для обновления', 400);
    }

    values.push(id);

    const result = await query<PetPostWithUser>(
      `
      WITH updated_post AS (
        UPDATE posts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      )
      SELECT
        p.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar_url', u.avatar_url,
          'yandex_id', u.yandex_id,
          'created_at', u.created_at
        ) as user
      FROM updated_post p
      JOIN users u ON p.user_id = u.id
    `,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete post - requires authentication and ownership
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Check ownership
    const ownerCheck = await query<{ user_id: string }>('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0) {
      throw new AppError('Объявление не найдено', 404);
    }
    if (ownerCheck.rows[0].user_id !== userId) {
      throw new AppError('Нет прав на удаление этого объявления', 403);
    }

    await query('DELETE FROM posts WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
