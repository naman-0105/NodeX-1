import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { getPool } from './pool.js';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export async function withTransaction<T>(
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  const database = getDb();
  return database.transaction(async (tx) => {
    return callback(tx);
  });
}
