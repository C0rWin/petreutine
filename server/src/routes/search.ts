import { NextFunction, Request, Response, Router } from 'express';

import { query } from '../db/index.js';
import { PetPostWithUser, searchQuerySchema } from '../types/index.js';

const router = Router();

// Full-text search with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const { q, type, animal_type, location, status, limit, offset } = params;

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
    `;

    // Add relevance score if search query provided
    if (q && q.trim()) {
      queryText += `,
        ts_rank(p.search_vector, plainto_tsquery('russian', $1)) +
        similarity(p.title, $1) * 0.5 +
        similarity(p.description, $1) * 0.3 +
        similarity(p.location, $1) * 0.2 as relevance
      `;
    }

    queryText += `
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;

    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Full-text search condition
    if (q && q.trim()) {
      queryParams.push(q);
      queryText += `
        AND (
          p.search_vector @@ plainto_tsquery('russian', $${paramIndex})
          OR p.title ILIKE '%' || $${paramIndex} || '%'
          OR p.description ILIKE '%' || $${paramIndex} || '%'
          OR p.location ILIKE '%' || $${paramIndex} || '%'
          OR similarity(p.title, $${paramIndex}) > 0.1
          OR similarity(p.description, $${paramIndex}) > 0.1
        )
      `;
      paramIndex++;
    }

    // Additional filters
    if (type) {
      queryParams.push(type);
      queryText += ` AND p.type = $${paramIndex++}`;
    }

    if (animal_type) {
      queryParams.push(animal_type);
      queryText += ` AND p.animal_type = $${paramIndex++}`;
    }

    if (location) {
      queryParams.push(location);
      queryText += ` AND (p.location ILIKE '%' || $${paramIndex} || '%' OR similarity(p.location, $${paramIndex++}) > 0.2)`;
    }

    if (status) {
      queryParams.push(status);
      queryText += ` AND p.status = $${paramIndex++}`;
    }

    // Order by relevance if searching, otherwise by date
    if (q && q.trim()) {
      queryText += ` ORDER BY relevance DESC, p.created_at DESC`;
    } else {
      queryText += ` ORDER BY p.created_at DESC`;
    }

    queryParams.push(limit, offset);
    queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

    const result = await query<PetPostWithUser & { relevance?: number }>(queryText, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      WHERE 1=1
    `;
    const countParams: unknown[] = [];
    let countParamIndex = 1;

    if (q && q.trim()) {
      countParams.push(q);
      countQuery += `
        AND (
          p.search_vector @@ plainto_tsquery('russian', $${countParamIndex})
          OR p.title ILIKE '%' || $${countParamIndex} || '%'
          OR p.description ILIKE '%' || $${countParamIndex} || '%'
          OR p.location ILIKE '%' || $${countParamIndex} || '%'
          OR similarity(p.title, $${countParamIndex}) > 0.1
          OR similarity(p.description, $${countParamIndex}) > 0.1
        )
      `;
      countParamIndex++;
    }

    if (type) {
      countParams.push(type);
      countQuery += ` AND p.type = $${countParamIndex++}`;
    }

    if (animal_type) {
      countParams.push(animal_type);
      countQuery += ` AND p.animal_type = $${countParamIndex++}`;
    }

    if (location) {
      countParams.push(location);
      countQuery += ` AND (p.location ILIKE '%' || $${countParamIndex} || '%' OR similarity(p.location, $${countParamIndex++}) > 0.2)`;
    }

    if (status) {
      countParams.push(status);
      countQuery += ` AND p.status = $${countParamIndex++}`;
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0]?.total || '0', 10),
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

// Find potential matches for a post (opposite type, similar description/location)
router.get('/matches/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Get the source post
    const sourceResult = await query<{
      type: string;
      animal_type: string;
      description: string;
      location: string;
    }>('SELECT type, animal_type, description, location FROM posts WHERE id = $1', [postId]);

    if (sourceResult.rows.length === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const source = sourceResult.rows[0];
    const oppositeType = source.type === 'LOST' ? 'FOUND' : 'LOST';

    // Find matches: opposite type, same animal, similar text/location
    const matchResult = await query<PetPostWithUser & { match_score: number }>(
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
        ) as user,
        (
          similarity(p.description, $1) * 0.4 +
          similarity(p.location, $2) * 0.4 +
          CASE WHEN p.animal_type = $3 THEN 0.2 ELSE 0 END
        ) as match_score
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.type = $4
        AND p.status = 'OPEN'
        AND p.id != $5
        AND (
          p.animal_type = $3
          OR similarity(p.description, $1) > 0.1
          OR similarity(p.location, $2) > 0.2
        )
      ORDER BY match_score DESC, p.created_at DESC
      LIMIT $6
    `,
      [source.description, source.location, source.animal_type, oppositeType, postId, limit]
    );

    res.json({
      matches: matchResult.rows.map(row => ({
        ...row,
        confidence: Math.min(row.match_score, 1),
        reason: generateMatchReason(source, row),
      })),
    });
  } catch (error) {
    next(error);
  }
});

function generateMatchReason(
  source: { animal_type: string; location: string },
  match: { animal_type: string; location: string; match_score: number }
): string {
  const reasons: string[] = [];

  if (source.animal_type === match.animal_type) {
    reasons.push(`Тот же тип животного (${match.animal_type})`);
  }

  if (match.match_score > 0.3) {
    reasons.push('Похожее описание');
  }

  if (match.location.toLowerCase().includes(source.location.toLowerCase().split(',')[0])) {
    reasons.push('Близкое местоположение');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Возможное совпадение';
}

export default router;
