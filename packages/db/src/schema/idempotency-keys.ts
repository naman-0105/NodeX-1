import { pgTable, uuid, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { executions } from './executions.js';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    logicalOperationId: text('logical_operation_id').notNull(),
    resultSnapshot: jsonb('result_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_idempotency_keys_unique_op').on(
      t.executionId,
      t.nodeId,
      t.logicalOperationId
    ),
  ]
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
