import {
  db,
  withTransaction,
  taskInstances,
  executions,
  outboxEvents,
  deadLetterTasks,
  eq,
  sql,
  and,
  lt,
  isNotNull,
} from '@nodex/db';

export interface LeaseReclaimerOptions {
  readonly intervalMs?: number;
  readonly batchSize?: number;
  readonly maxAttempts?: number;
}

/**
 * Scans for crashed worker tasks (status = RUNNING and lease_until < NOW())
 * and safely reclaims or dead-letters them.
 */
export async function reclaimExpiredLeases(
  batchSize: number = 50,
  maxAttempts: number = 3
): Promise<number> {
  return withTransaction(async (tx) => {
    // 1. Fetch expired running task leases with row lock
    const expiredTasks = await tx
      .select()
      .from(taskInstances)
      .where(
        and(
          eq(taskInstances.status, 'RUNNING'),
          isNotNull(taskInstances.leaseUntil),
          lt(taskInstances.leaseUntil, sql`NOW()`)
        )
      )
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (expiredTasks.length === 0) {
      return 0;
    }

    for (const task of expiredTasks) {
      if (task.attempt < maxAttempts) {
        // Recoverable: transition to RETRYING and re-enqueue continuation
        await tx
          .update(taskInstances)
          .set({
            status: 'RETRYING',
            workerId: null,
            leaseUntil: null,
            updatedAt: sql`NOW()`,
          })
          .where(eq(taskInstances.id, task.id));

        // Enqueue outbox event so an active worker can pick up execution
        await tx.insert(outboxEvents).values({
          aggregateId: task.executionId,
          eventType: 'execution.queued',
          payloadJson: {
            executionId: task.executionId,
            reclaimedTaskId: task.id,
            reason: 'LEASE_EXPIRED_RECLAIM',
          },
        });
      } else {
        // Unrecoverable: mark task FAILED, record in DLQ, and fail execution
        const finalError = {
          message: 'Worker lease expired and max retry attempts exhausted (Worker Crash Detected)',
          code: 'LEASE_EXPIRED_CRASH',
          lastWorkerId: task.workerId,
        };

        await tx
          .update(taskInstances)
          .set({
            status: 'FAILED',
            workerId: null,
            leaseUntil: null,
            errorJson: finalError,
            finishedAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          })
          .where(eq(taskInstances.id, task.id));

        await tx.insert(deadLetterTasks).values({
          taskInstanceId: task.id,
          executionId: task.executionId,
          finalError,
          replayStatus: 'PENDING',
        });

        await tx
          .update(executions)
          .set({
            status: 'FAILED',
            finishedAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          })
          .where(eq(executions.id, task.executionId));
      }
    }

    return expiredTasks.length;
  });
}

export class LeaseReclaimerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isReclaiming = false;

  constructor(private readonly options: LeaseReclaimerOptions = {}) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = this.options.intervalMs ?? 2000;
    const batchSize = this.options.batchSize ?? 50;
    const maxAttempts = this.options.maxAttempts ?? 3;

    const loop = async () => {
      if (!this.isRunning) return;
      if (!this.isReclaiming) {
        this.isReclaiming = true;
        try {
          await reclaimExpiredLeases(batchSize, maxAttempts);
        } catch (err) {
          console.error('Error in lease reclaimer cycle:', err);
        } finally {
          this.isReclaiming = false;
        }
      }
      if (this.isRunning) {
        this.timer = setTimeout(loop, intervalMs);
      }
    };

    this.timer = setTimeout(loop, intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
