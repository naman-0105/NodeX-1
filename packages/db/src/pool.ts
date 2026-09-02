import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return { connectionString };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'nodex',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool(getPoolConfig());
    poolInstance.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }
  return poolInstance;
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function withPgTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
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

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await query<{ one: number }>('SELECT 1 as one');
    return res.rows[0]?.one === 1;
  } catch {
    return false;
  }
}
