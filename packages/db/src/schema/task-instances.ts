import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { executions } from './executions.js';

export const taskInstances = pgTable(
  'task_instances',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    status: text('status').notNull().default('PENDING'),
    attempt: integer('attempt').notNull().default(0),
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    errorJson: jsonb('error_json'),
    workerId: text('worker_id'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_task_instances_execution_node').on(t.executionId, t.nodeId),
    index('idx_task_instances_status_lease').on(t.status, t.leaseUntil),
    index('idx_task_instances_worker_lease').on(t.workerId, t.leaseUntil),
  ]
);

export type TaskInstance = typeof taskInstances.$inferSelect;
export type NewTaskInstance = typeof taskInstances.$inferInsert;
