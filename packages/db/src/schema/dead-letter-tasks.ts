import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { taskInstances } from './task-instances.js';
import { executions } from './executions.js';

export const deadLetterTasks = pgTable(
  'dead_letter_tasks',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    taskInstanceId: uuid('task_instance_id')
      .notNull()
      .references(() => taskInstances.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    finalError: jsonb('final_error').notNull(),
    movedAt: timestamp('moved_at', { withTimezone: true }).notNull().defaultNow(),
    replayStatus: text('replay_status').notNull().default('PENDING'),
  },
  (t) => [
    index('idx_dead_letter_tasks_execution').on(t.executionId),
    index('idx_dead_letter_tasks_replay_status').on(t.replayStatus),
  ]
);

export type DeadLetterTask = typeof deadLetterTasks.$inferSelect;
export type NewDeadLetterTask = typeof deadLetterTasks.$inferInsert;
