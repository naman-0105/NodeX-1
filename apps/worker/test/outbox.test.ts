import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {
  db,
  closePool,
  outboxEvents,
  eq,
} from '@nodex/db';
import { pollAndPublishOutbox } from '../src/outbox/poller.js';
import { closeRedisConnection } from '../src/queue/connection.js';
import { closeExecutionQueue, getExecutionQueue } from '../src/queue/queues.js';

describe('Transactional Outbox Poller Integration Tests', () => {
  beforeAll(async () => {
    // Drain any existing unpublished events left from other tests
    await pollAndPublishOutbox(100);
  });

  afterAll(async () => {
    await closeExecutionQueue();
    await closeRedisConnection();
    await closePool();
  });

  it('polls unpublished outbox events, enqueues to BullMQ, and marks publishedAt', async () => {
    const aggregateId = crypto.randomUUID();

    // 1. Insert unpublished outbox event
    const [inserted] = await db
      .insert(outboxEvents)
      .values({
        aggregateId,
        eventType: 'execution.created',
        payloadJson: { executionId: aggregateId, workflowId: 'wf_test' },
      })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.publishedAt).toBeNull();

    // 2. Poll and publish
    const publishedCount = await pollAndPublishOutbox(10);
    expect(publishedCount).toBeGreaterThanOrEqual(1);

    // 3. Verify event is now marked published in Postgres
    const [updated] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, inserted.id));

    expect(updated.publishedAt).not.toBeNull();

    // 4. Verify job arrived in BullMQ queue
    const queue = getExecutionQueue();
    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    const matchingJob = jobs.find((j) => j.data.executionId === aggregateId);
    expect(matchingJob).toBeDefined();

    // Clean up job from queue
    if (matchingJob) {
      await matchingJob.remove();
    }
  });

  it('returns 0 when there are no unpublished outbox events', async () => {
    // If all events are published, returns 0
    const count = await pollAndPublishOutbox(10);
    expect(count).toBe(0);
  });
});
