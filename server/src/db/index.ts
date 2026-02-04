import pg, { QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database SSL configuration
// Production: Strict validation with CA certificate
// Development: Relaxed for local databases, strict for remote
function getSSLConfig(): boolean | { rejectUnauthorized: boolean; ca?: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalDev = process.env.DATABASE_URL?.includes('localhost') ||
                     process.env.DATABASE_URL?.includes('127.0.0.1');

  if (isProduction) {
    // Production requires proper SSL verification
    const caCert = process.env.DATABASE_CA_CERT;
    if (!caCert) {
      console.error('FATAL: DATABASE_CA_CERT environment variable is required in production');
      console.error('Get your CA certificate from DigitalOcean Database dashboard');
      process.exit(1);
    }
    return {
      rejectUnauthorized: true,
      ca: caCert,
    };
  }

  if (isLocalDev) {
    // Local development: no SSL needed
    return false;
  }

  // Non-local development (e.g., connecting to staging DB)
  // Allow self-signed certs but warn
  console.warn('WARNING: Using relaxed SSL validation for non-production remote database');
  console.warn('Set DATABASE_CA_CERT for proper certificate validation');
  return { rejectUnauthorized: false };
}

const sslConfig = getSSLConfig();

// Environment-driven pool configuration with production-scale defaults
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '50', 10);
const DB_IDLE_TIMEOUT = parseInt(process.env.DB_IDLE_TIMEOUT || '600000', 10);
const DB_CONNECTION_TIMEOUT = parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10);
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10);
const QUERY_TIMEOUT = parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: DB_POOL_SIZE,
  idleTimeoutMillis: DB_IDLE_TIMEOUT,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const client = await pool.connect();

  try {
    // Set per-query statement timeout to prevent runaway queries
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT}`);

    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;

    // Always log slow queries regardless of environment
    if (duration > SLOW_QUERY_THRESHOLD) {
      console.warn('[SLOW_QUERY]', {
        query: text.substring(0, 200),
        duration_ms: duration,
        threshold_ms: SLOW_QUERY_THRESHOLD,
        params_count: params?.length || 0
      });
    }

    // Debug logging only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }

    return result;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully');

    // Run migration files from migrations directory
    const migrationsPath = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationSql = fs.readFileSync(path.join(migrationsPath, file), 'utf-8');
        await pool.query(migrationSql);
        console.log(`Applied migration: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
