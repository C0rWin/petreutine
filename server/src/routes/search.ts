import { NextFunction, Request, Response, Router } from 'express';

import { query } from '../db/index.js';
import { PetPostWithUser, searchQuerySchema } from '../types/index.js';

const router = Router();

// Full-text search with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const {
      q,
      type,
      animal_type,
      location,
      status,
      date_from,
      date_to,
      lat,
      lon,
      radius_km,
      limit,
      offset,
    } = params;

    const hasQuery = Boolean(q && q.trim());
    // Geo radius applies only when a point + radius are all present.
    const hasGeo = lat !== undefined && lon !== undefined && radius_km !== undefined;

    // Build the shared WHERE clause once so the main and count queries stay in sync.
    const conditions: string[] = [];
    const queryParams: unknown[] = [];
    let i = 1;

    // The full-text query is always param $1 when present (relevance reuses it).
    if (hasQuery) {
      queryParams.push(q);
      conditions.push(`(
        p.search_vector @@ plainto_tsquery('russian', $${i})
        OR p.title ILIKE '%' || $${i} || '%'
        OR p.description ILIKE '%' || $${i} || '%'
        OR p.location ILIKE '%' || $${i} || '%'
        OR similarity(p.title, $${i}) > 0.1
        OR similarity(p.description, $${i}) > 0.1
      )`);
      i++;
    }

    if (type) {
      queryParams.push(type);
      conditions.push(`p.type = $${i++}`);
    }

    if (animal_type) {
      queryParams.push(animal_type);
      conditions.push(`p.animal_type = $${i++}`);
    }

    if (hasGeo) {
      // Great-circle (Haversine) distance in km; LEAST guards acos() rounding.
      const latIdx = i++;
      const lonIdx = i++;
      const radIdx = i++;
      queryParams.push(lat, lon, radius_km);
      conditions.push(`p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND (
        6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians($${latIdx})) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians($${lonIdx})) +
          sin(radians($${latIdx})) * sin(radians(p.latitude))
        )))
      ) <= $${radIdx}`);
    } else if (location) {
      queryParams.push(location);
      conditions.push(
        `(p.location ILIKE '%' || $${i} || '%' OR similarity(p.location, $${i}) > 0.2)`
      );
      i++;
    }

    if (status) {
      queryParams.push(status);
      conditions.push(`p.status = $${i++}`);
    }

    if (date_from) {
      queryParams.push(date_from);
      conditions.push(`p.created_at >= $${i++}`);
    }

    if (date_to) {
      queryParams.push(date_to);
      conditions.push(`p.created_at <= $${i++}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const relevanceSelect = hasQuery
      ? `,
        ts_rank(p.search_vector, plainto_tsquery('russian', $1)) +
        similarity(p.title, $1) * 0.5 +
        similarity(p.description, $1) * 0.3 +
        similarity(p.location, $1) * 0.2 as relevance`
      : '';

    const orderBy = hasQuery
      ? `ORDER BY relevance DESC, p.created_at DESC`
      : `ORDER BY p.created_at DESC`;

    const queryText = `
      SELECT
        p.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar_url', u.avatar_url,
          'yandex_id', u.yandex_id,
          'created_at', u.created_at
        ) as user${relevanceSelect}
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${whereSql}
      ${orderBy}
      LIMIT $${i++} OFFSET $${i++}
    `;

    const result = await query<PetPostWithUser & { relevance?: number }>(queryText, [
      ...queryParams,
      limit,
      offset,
    ]);

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM posts p ${whereSql}`,
      queryParams
    );

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
