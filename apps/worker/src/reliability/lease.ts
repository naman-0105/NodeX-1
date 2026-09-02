import { db, taskInstances, eq, sql, and, or, isNull, lt } from '@nodex/db';
import type { TaskStatus } from '@nodex/shared';

export interface LeaseOptions {
  readonly durationSeconds?: number;
}

/**
 * Acquires a lease on a task instance using PostgreSQL server timestamps.
 */
export async function acquireTaskLease(
  taskInstanceId: string,
  workerId: string,
  options: LeaseOptions = {}
): Promise<boolean> {
  const durationSeconds = options.durationSeconds ?? 30;

  const result = await db
    .update(taskInstances)
    .set({
      workerId,
      status: 'RUNNING',
      leaseUntil: sql`NOW() + (${durationSeconds} || ' seconds')::INTERVAL`,
      startedAt: sql`COALESCE(started_at, NOW())`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(taskInstances.id, taskInstanceId),
        or(
          isNull(taskInstances.leaseUntil),
          lt(taskInstances.leaseUntil, sql`NOW()`),
          eq(taskInstances.workerId, workerId)
        )
      )
    )
    .returning({ id: taskInstances.id });

  return result.length > 0;
}

/**
 * Renews an active task lease held by this worker.
 */
export async function renewTaskLease(
  taskInstanceId: string,
  workerId: string,
  options: LeaseOptions = {}
): Promise<boolean> {
  const durationSeconds = options.durationSeconds ?? 30;

  const result = await db
    .update(taskInstances)
    .set({
      leaseUntil: sql`NOW() + (${durationSeconds} || ' seconds')::INTERVAL`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(taskInstances.id, taskInstanceId),
        eq(taskInstances.workerId, workerId)
      )
    )
    .returning({ id: taskInstances.id });

  return result.length > 0;
}

/**
 * Releases a task lease upon completion, failure, or transition to waiting.
 */
export async function releaseTaskLease(
  taskInstanceId: string,
  workerId: string,
  finalStatus: TaskStatus | string,
  resultData?: { output?: unknown; error?: unknown }
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {
    leaseUntil: null,
    status: finalStatus,
    updatedAt: sql`NOW()`,
  };

  if (resultData?.output !== undefined) {
    updatePayload.outputJson = resultData.output;
  }
  if (resultData?.error !== undefined) {
    updatePayload.errorJson = resultData.error;
  }
  if (finalStatus !== 'WAITING' && finalStatus !== 'RUNNING') {
    updatePayload.finishedAt = sql`NOW()`;
  }

  const result = await db
    .update(taskInstances)
    .set(updatePayload)
    .where(
      and(
        eq(taskInstances.id, taskInstanceId),
        eq(taskInstances.workerId, workerId)
      )
    )
    .returning({ id: taskInstances.id });

  return result.length > 0;
}
