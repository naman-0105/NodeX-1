import {
  db,
  withTransaction,
  executions,
  outboxEvents,
  taskInstances,
  executionEvents,
  eq,
  desc,
  asc,
  and,
  sql,
  inArray,
} from '@nodex/db';

export async function createExecutionWithOutbox(
  workflowId: string,
  workflowVersionId: string,
  triggerType: string,
  payload?: Record<string, unknown>
) {
  return withTransaction(async (tx) => {
    // 1. Insert execution record pinned to immutable workflow version
    const [execution] = await tx
      .insert(executions)
      .values({
        workflowId,
        workflowVersionId,
        triggerType,
        status: 'QUEUED',
      })
      .returning();

    // 2. Insert transactional outbox event
    const [outbox] = await tx
      .insert(outboxEvents)
      .values({
        aggregateId: execution.id,
        eventType: 'execution.queued',
        payloadJson: {
          executionId: execution.id,
          workflowId,
          workflowVersionId,
          triggerType,
          payload: payload || {},
        },
      })
      .returning();

    return {
      execution,
      outbox,
    };
  });
}

export async function getExecutionById(id: string) {
  const [exec] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, id))
    .limit(1);
  return exec || null;
}

export async function getExecutionWithDetails(id: string) {
  const [exec] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, id))
    .limit(1);

  if (!exec) return null;

  const tasks = await db
    .select()
    .from(taskInstances)
    .where(eq(taskInstances.executionId, id))
    .orderBy(asc(taskInstances.createdAt));

  const events = await db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.executionId, id))
    .orderBy(asc(executionEvents.sequence));

  return {
    execution: exec,
    tasks,
    events,
  };
}

export async function listExecutionsForWorkflow(
  workflowId: string,
  limit: number = 50,
  offset: number = 0
) {
  return db
    .select()
    .from(executions)
    .where(eq(executions.workflowId, workflowId))
    .orderBy(desc(executions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function cancelExecution(id: string) {
  const [cancelled] = await db
    .update(executions)
    .set({
      status: 'CANCELLED',
      finishedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(executions.id, id),
        inArray(executions.status, ['CREATED', 'QUEUED', 'RUNNING', 'WAITING'])
      )
    )
    .returning();

  return cancelled || null;
}
