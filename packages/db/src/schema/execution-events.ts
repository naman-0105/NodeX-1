import { pgTable, uuid, integer, text, jsonb, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { executions } from './executions.js';

export const executionEvents = pgTable(
  'execution_events',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_execution_events_execution_sequence').on(t.executionId, t.sequence),
    index('idx_execution_events_execution_id').on(t.executionId),
  ]
);

export type ExecutionEvent = typeof executionEvents.$inferSelect;
export type NewExecutionEvent = typeof executionEvents.$inferInsert;
