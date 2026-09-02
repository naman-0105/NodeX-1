import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workflows } from './workflows.js';

export const workflowSchedules = pgTable(
  'workflow_schedules',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    schedule: text('schedule').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_workflow_schedules_polling').on(t.enabled, t.nextRunAt),
  ]
);

export type WorkflowSchedule = typeof workflowSchedules.$inferSelect;
export type NewWorkflowSchedule = typeof workflowSchedules.$inferInsert;
