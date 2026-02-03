import { query } from '../../db/index.js';
import { AdminTargetType } from '../../types/admin.js';

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: AdminTargetType,
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}
