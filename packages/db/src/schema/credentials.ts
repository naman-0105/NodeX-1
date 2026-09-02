import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const credentials = pgTable('credentials', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  encryptedData: text('encrypted_data').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
