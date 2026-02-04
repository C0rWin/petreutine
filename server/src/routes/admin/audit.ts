import { Response, Router } from 'express';

import { query } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { AdminAuditLogEntry, auditLogQuerySchema, PaginatedResponse } from '../../types/admin.js';

const router = Router();

/** GET / - Admin audit log with filters */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = auditLogQuerySchema.parse(req.query);
    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.admin_id) {
      whereClause += ` AND al.admin_id = $${paramIndex}`;
      queryParams.push(params.admin_id);
      paramIndex++;
    }
    if (params.target_type !== 'all') {
      whereClause += ` AND al.target_type = $${paramIndex}`;
      queryParams.push(params.target_type);
      paramIndex++;
    }
    if (params.action) {
      whereClause += ` AND al.action = $${paramIndex}`;
      queryParams.push(params.action);
      paramIndex++;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_audit_log al ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const logResult = await query<AdminAuditLogEntry>(
      `SELECT al.*, u.name as admin_name FROM admin_audit_log al
     JOIN users u ON u.id = al.admin_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    res.json({
      data: logResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    } as PaginatedResponse<AdminAuditLogEntry>);
  })
);

export default router;
