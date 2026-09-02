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

export async function submitApprovalDecision(
  executionId: string,
  taskId: string,
  decision: { approved: boolean; approver?: string; comments?: string }
) {
  return withTransaction(async (tx) => {
    // 1. Fetch task instance with lock
    const [task] = await tx
      .select()
      .from(taskInstances)
      .where(
        and(
          eq(taskInstances.id, taskId),
          eq(taskInstances.executionId, executionId)
        )
      )
      .limit(1)
      .for('update');

    if (!task) {
      throw new Error(`Task instance not found: ${taskId}`);
    }
    if (task.status !== 'WAITING') {
      throw new Error(`Task ${taskId} is not waiting for approval (current status: ${task.status})`);
    }

    const decisionPayload = {
      decision: {
        approved: decision.approved,
        approver: decision.approver || 'system_admin',
        comments: decision.comments || '',
        decisionAt: new Date().toISOString(),
      },
    };

    // 2. Update task instance
    const [updatedTask] = await tx
      .update(taskInstances)
      .set({
        status: decision.approved ? 'SUCCEEDED' : 'FAILED',
        outputJson: decisionPayload,
        finishedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(taskInstances.id, taskId))
      .returning();

    // 3. Append execution event
    const [latestEvent] = await tx
      .select({ sequence: executionEvents.sequence })
      .from(executionEvents)
      .where(eq(executionEvents.executionId, executionId))
      .orderBy(desc(executionEvents.sequence))
      .limit(1);

    const nextSeq = (latestEvent?.sequence ?? 0) + 1;
    await tx.insert(executionEvents).values({
      executionId,
      sequence: nextSeq,
      eventType: decision.approved ? 'task.approved' : 'task.rejected',
      payloadJson: {
        taskId,
        nodeId: task.nodeId,
        ...decisionPayload,
      },
    });

    // 4. Update execution and queue continuation if approved
    if (decision.approved) {
      const [updatedExec] = await tx
        .update(executions)
        .set({
          status: 'QUEUED',
          updatedAt: sql`NOW()`,
        })
        .where(eq(executions.id, executionId))
        .returning();

      // Enqueue continuation job via transactional outbox
      await tx.insert(outboxEvents).values({
        aggregateId: executionId,
        eventType: 'execution.queued',
        payloadJson: {
          executionId,
          resumedFromTaskId: taskId,
          triggerType: 'continuation',
        },
      });

      return {
        task: updatedTask,
        execution: updatedExec,
      };
    } else {
      const [failedExec] = await tx
        .update(executions)
        .set({
          status: 'FAILED',
          finishedAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(executions.id, executionId))
        .returning();

      return {
        task: updatedTask,
        execution: failedExec,
      };
    }
  });
}

export async function getPendingApprovals(executionId?: string) {
  if (executionId) {
    return db
      .select()
      .from(taskInstances)
      .where(
        and(
          eq(taskInstances.executionId, executionId),
          eq(taskInstances.status, 'WAITING')
        )
      )
      .orderBy(asc(taskInstances.createdAt));
  }

  return db
    .select()
    .from(taskInstances)
    .where(eq(taskInstances.status, 'WAITING'))
    .orderBy(asc(taskInstances.createdAt));
}
