import 'dotenv/config';
import { initializeDatabase, closePool, query } from './index.js';

/**
 * Add moderation_alert to notification_type enum for existing databases.
 * This handles the case where the database was created before this enum value existed.
 * For fresh databases, schema.sql already includes the new value.
 */
async function addModerationAlertNotificationType(): Promise<void> {
  try {
    // Check if the enum value already exists
    const result = await query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'moderation_alert'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
      ) as exists
    `);

    if (!result.rows[0].exists) {
      await query(`
        ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moderation_alert'
      `);
      console.log('[Migration] Added moderation_alert to notification_type enum');
    } else {
      console.log('[Migration] moderation_alert already exists in notification_type enum');
    }
  } catch (error) {
    // Ignore if type doesn't exist yet (fresh db will create it via schema.sql)
    // or if ADD VALUE already occurred in a concurrent transaction
    const errorMessage = String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('already exists')) {
      console.log('[Migration] notification_type enum update skipped (expected for fresh databases)');
    } else {
      console.warn('[Migration] notification_type enum update warning:', error);
    }
  }
}

async function migrate() {
  console.log('Starting database migration...');

  try {
    // Run main schema initialization
    await initializeDatabase();

    // Run additional migrations for existing databases
    await addModerationAlertNotificationType();

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

migrate();
