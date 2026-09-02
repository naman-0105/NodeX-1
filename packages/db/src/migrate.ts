import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPool, closePool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customPool?: pg.Pool): Promise<string[]> {
  const pool = customPool || getPool();
  const client = await pool.connect();

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 3. Find migration files
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedThisRun: string[] = [];

    for (const file of files) {
      if (!appliedSet.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`Applying migration: ${file}...`);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          appliedThisRun.push(file);
          console.log(`Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Failed to apply migration: ${file}`, err);
          throw err;
        }
      }
    }

    return appliedThisRun;
  } finally {
    client.release();
  }
}

// Direct CLI execution
if (process.argv[1] === __filename) {
  runMigrations()
    .then((applied) => {
      console.log(`Migrations complete. Applied ${applied.length} new migrations.`);
      return closePool();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
