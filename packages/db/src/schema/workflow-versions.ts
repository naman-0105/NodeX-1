import { pgTable, uuid, integer, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { WorkflowDefinition } from '@nodex/shared';
import { workflows } from './workflows.js';

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    definitionJson: jsonb('definition_json').$type<WorkflowDefinition>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_workflow_versions_workflow_version').on(t.workflowId, t.version),
  ]
);

export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type NewWorkflowVersion = typeof workflowVersions.$inferInsert;
