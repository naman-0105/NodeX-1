import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const workflows = pgTable('workflows', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  currentVersionId: uuid('current_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
