import { db, withTransaction, outboxEvents, eq, sql, inArray } from '@nodex/db';
import { enqueueExecutionJob } from '../queue/queues.js';

export interface OutboxPollerOptions {
  readonly pollIntervalMs?: number;
  readonly batchSize?: number;
}

/**
 * Polls unpublished outbox events using FOR UPDATE SKIP LOCKED and publishes them to BullMQ.
 */
export async function pollAndPublishOutbox(batchSize: number = 50): Promise<number> {
  return withTransaction(async (tx) => {
    // 1. Fetch unpublished outbox events with row locking to prevent concurrent poller collisions
    const pendingEvents = await tx
      .select()
      .from(outboxEvents)
      .where(sql`published_at IS NULL`)
      .orderBy(outboxEvents.createdAt)
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (pendingEvents.length === 0) {
      return 0;
    }

    const publishedIds: string[] = [];

    for (const event of pendingEvents) {
      try {
        const payload = (event.payloadJson || {}) as Record<string, unknown>;

        if (event.eventType === 'execution.created' || event.eventType === 'execution.queued') {
          await enqueueExecutionJob({
            executionId: event.aggregateId,
            workflowId: payload.workflowId as string | undefined,
            triggerType: payload.triggerType as string | undefined,
          });
        }

        publishedIds.push(event.id);
      } catch (err) {
        console.error(`Failed to publish outbox event ${event.id}:`, err);
        // Do not mark this event as published; it will be retried on next poll cycle
      }
    }

    // 2. Mark published events with timestamp
    if (publishedIds.length > 0) {
      await tx
        .update(outboxEvents)
        .set({ publishedAt: sql`NOW()` })
        .where(inArray(outboxEvents.id, publishedIds));
    }

    return publishedIds.length;
  });
}

export class OutboxPollerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPolling = false;

  constructor(private readonly options: OutboxPollerOptions = {}) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = this.options.pollIntervalMs ?? 500;
    const batchSize = this.options.batchSize ?? 50;

    const loop = async () => {
      if (!this.isRunning) return;
      if (!this.isPolling) {
        this.isPolling = true;
        try {
          await pollAndPublishOutbox(batchSize);
        } catch (err) {
          console.error('Error during outbox polling cycle:', err);
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
