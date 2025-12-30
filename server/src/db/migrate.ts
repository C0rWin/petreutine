import 'dotenv/config';
import { initializeDatabase, closePool } from './index.js';

async function migrate() {
  console.log('Starting database migration...');

  try {
    await initializeDatabase();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

migrate();
