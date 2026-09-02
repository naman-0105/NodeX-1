import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workflows } from './workflows.js';
import { executions } from './executions.js';

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    externalEventId: text('external_event_id').notNull(),
    payloadHash: text('payload_hash').notNull(),
    executionId: uuid('execution_id').references(() => executions.id, {
      onDelete: 'set null',
    }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_webhook_events_workflow_external_id').on(
      t.workflowId,
      t.externalEventId
    ),
    index('idx_webhook_events_workflow_id').on(t.workflowId),
  ]
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
