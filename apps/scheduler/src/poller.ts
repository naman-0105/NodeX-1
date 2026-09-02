import cronParser from 'cron-parser';
import {
  db,
  withTransaction,
  workflowSchedules,
  workflows,
  executions,
  outboxEvents,
  eq,
  sql,
  and,
  lte,
} from '@nodex/db';

export interface SchedulePollerOptions {
  readonly intervalMs?: number;
  readonly batchSize?: number;
}

/**
 * Calculates the next run date for a given cron expression and timezone.
 */
export function calculateNextRunDate(
  scheduleCron: string,
  timezone: string = 'UTC',
  currentDate: Date = new Date()
): Date {
  try {
    const interval = cronParser.parseExpression(scheduleCron, {
      currentDate,
      tz: timezone,
    });
    return interval.next().toDate();
  } catch (err: any) {
    throw new Error(`Invalid cron schedule "${scheduleCron}": ${err.message}`);
  }
}

/**
 * Queries due workflow schedules (enabled and next_run_at <= NOW()) using row locking,
 * triggers an execution + outbox event for each in a single transaction, and advances next_run_at.
 */
export async function pollAndTriggerDueSchedules(batchSize: number = 20): Promise<number> {
  return withTransaction(async (tx) => {
    // 1. Fetch due schedules with row locking
    const dueSchedules = await tx
      .select({
        id: workflowSchedules.id,
        workflowId: workflowSchedules.workflowId,
        schedule: workflowSchedules.schedule,
        timezone: workflowSchedules.timezone,
        nextRunAt: workflowSchedules.nextRunAt,
        currentVersionId: workflows.currentVersionId,
        workflowActive: workflows.active,
      })
      .from(workflowSchedules)
      .innerJoin(workflows, eq(workflowSchedules.workflowId, workflows.id))
      .where(
        and(
          eq(workflowSchedules.enabled, true),
          lte(workflowSchedules.nextRunAt, sql`NOW()`),
          eq(workflows.active, true)
        )
      )
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (dueSchedules.length === 0) {
      return 0;
    }

    for (const item of dueSchedules) {
      if (!item.currentVersionId) {
        console.warn(`Skipping schedule ${item.id} for workflow ${item.workflowId} because no version is published`);
        continue;
      }

      // 2. Insert execution record
      const [execution] = await tx
        .insert(executions)
        .values({
          workflowId: item.workflowId,
          workflowVersionId: item.currentVersionId,
          triggerType: 'schedule',
          status: 'QUEUED',
        })
        .returning();

      // 3. Insert transactional outbox event
      await tx.insert(outboxEvents).values({
        aggregateId: execution.id,
        eventType: 'execution.queued',
        payloadJson: {
          executionId: execution.id,
          workflowId: item.workflowId,
          workflowVersionId: item.currentVersionId,
          triggerType: 'schedule',
          scheduleId: item.id,
        },
      });

      // 4. Advance next_run_at
      const nextRun = calculateNextRunDate(item.schedule, item.timezone);
      await tx
        .update(workflowSchedules)
        .set({
          nextRunAt: nextRun,
          updatedAt: sql`NOW()`,
        })
        .where(eq(workflowSchedules.id, item.id));
    }

    return dueSchedules.length;
  });
}

export class SchedulePollerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPolling = false;

  constructor(private readonly options: SchedulePollerOptions = {}) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = this.options.intervalMs ?? 1000;
    const batchSize = this.options.batchSize ?? 20;

    const loop = async () => {
      if (!this.isRunning) return;
      if (!this.isPolling) {
        this.isPolling = true;
        try {
          await pollAndTriggerDueSchedules(batchSize);
        } catch (err) {
          console.error('Error in schedule poller cycle:', err);
        } finally {
          this.isPolling = false;
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
