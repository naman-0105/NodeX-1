import {
  db,
  withTransaction,
  webhookEvents,
  executions,
  outboxEvents,
  eq,
  and,
} from '@nodex/db';

export async function findWebhookEvent(workflowId: string, externalEventId: string) {
  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.workflowId, workflowId),
        eq(webhookEvents.externalEventId, externalEventId)
      )
    )
    .limit(1);

  return event || null;
}

export async function recordWebhookAndCreateExecution(
  workflowId: string,
  externalEventId: string,
  payloadHash: string,
  workflowVersionId: string,
  payload?: unknown
) {
  return withTransaction(async (tx) => {
    // 1. Insert execution record
    const [execution] = await tx
      .insert(executions)
      .values({
        workflowId,
        workflowVersionId,
        triggerType: 'webhook',
        status: 'QUEUED',
      })
      .returning();

    // 2. Insert webhook event (with unique constraint on workflow_id, external_event_id)
    const [webhookEvent] = await tx
      .insert(webhookEvents)
      .values({
        workflowId,
        externalEventId,
        payloadHash,
        executionId: execution.id,
      })
      .returning();

    // 3. Insert transactional outbox event
    const [outbox] = await tx
      .insert(outboxEvents)
      .values({
        aggregateId: execution.id,
        eventType: 'execution.queued',
        payloadJson: {
          executionId: execution.id,
          workflowId,
          workflowVersionId,
          triggerType: 'webhook',
          externalEventId,
          payload: payload || {},
        },
      })
      .returning();

    return {
      executionId: execution.id,
      webhookEventId: webhookEvent.id,
      outboxId: outbox.id,
    };
  });
}
