import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workflows } from './workflows.js';
import { workflowVersions } from './workflow-versions.js';

export const executions = pgTable(
  'executions',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    workflowVersionId: uuid('workflow_version_id')
      .notNull()
      .references(() => workflowVersions.id),
    triggerType: text('trigger_type').notNull(),
    status: text('status').notNull().default('CREATED'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_executions_workflow_status').on(t.workflowId, t.status),
    index('idx_executions_version_id').on(t.workflowVersionId),
    index('idx_executions_status').on(t.status),
  ]
);

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
