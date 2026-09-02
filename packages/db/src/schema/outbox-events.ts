import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_outbox_events_unpublished')
      .on(t.createdAt)
      .where(sql`published_at IS NULL`),
  ]
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
