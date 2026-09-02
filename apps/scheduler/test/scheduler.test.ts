import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  db,
  closePool,
  users,
  workflows,
  workflowVersions,
  workflowSchedules,
  executions,
  taskInstances,
  outboxEvents,
  deadLetterTasks,
  eq,
  sql,
} from '@nodex/db';
import {
  calculateNextRunDate,
  pollAndTriggerDueSchedules,
} from '../src/poller.js';
import { reclaimExpiredLeases } from '../src/lease-reclaimer.js';

describe('Scheduler & Lease Reclaimer Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `sched-user-${Date.now()}@example.com`, passwordHash: 'pwd' })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Cron Expression Calculation', () => {
    it('calculates future dates from standard cron patterns', () => {
      const now = new Date('2026-09-02T12:00:00Z');
      const nextRun = calculateNextRunDate('*/5 * * * *', 'UTC', now);

      expect(nextRun.toISOString()).toBe('2026-09-02T12:05:00.000Z');
    });

    it('handles timezones correctly', () => {
      const now = new Date('2026-09-02T12:00:00Z');
      const nextRunNY = calculateNextRunDate('0 9 * * *', 'America/New_York', now);

      expect(nextRunNY.getTime()).toBeGreaterThan(now.getTime());
    });

    it('throws descriptive error on malformed cron string', () => {
      expect(() => calculateNextRunDate('invalid cron')).toThrow(/Invalid cron schedule/);
    });
  });

  describe('Due Schedule Poller', () => {
    it('polls due schedules, triggers executions + outbox, and advances next_run_at', async () => {
      // 1. Create workflow + version
      const [wf] = await db
        .insert(workflows)
        .values({ ownerId: testUserId, name: 'Scheduled ETL Workflow', active: true })
        .returning();

      const [ver] = await db
        .insert(workflowVersions)
        .values({
          workflowId: wf.id,
          version: 1,
          definitionJson: {
            nodes: [{ id: 'trig', type: 'trigger', config: {} }],
            edges: [],
          },
        })
        .returning();

      await db
        .update(workflows)
        .set({ currentVersionId: ver.id })
        .where(eq(workflows.id, wf.id));

      // 2. Create past-due schedule
      const [sched] = await db
        .insert(workflowSchedules)
        .values({
          workflowId: wf.id,
          schedule: '*/10 * * * *',
          timezone: 'UTC',
          nextRunAt: sql`NOW() - INTERVAL '1 minute'`, // Due now!
          enabled: true,
        })
        .returning();

      // 3. Poll and trigger
      const triggeredCount = await pollAndTriggerDueSchedules(10);
      expect(triggeredCount).toBeGreaterThanOrEqual(1);

      // 4. Verify execution was created
      const [exec] = await db
        .select()
        .from(executions)
        .where(eq(executions.workflowId, wf.id));

      expect(exec).toBeDefined();
      expect(exec.triggerType).toBe('schedule');
      expect(exec.workflowVersionId).toBe(ver.id);
      expect(exec.status).toBe('QUEUED');

      // 5. Verify outbox event was created
      const [outbox] = await db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, exec.id));

      expect(outbox).toBeDefined();
      expect(outbox.eventType).toBe('execution.queued');

      // 6. Verify schedule next_run_at was advanced into the future
      const [updatedSched] = await db
        .select()
        .from(workflowSchedules)
        .where(eq(workflowSchedules.id, sched.id));

      expect(new Date(updatedSched.nextRunAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Lease Recovery & Crash Reclaimer', () => {
    it('reclaims expired running tasks and marks them RETRYING', async () => {
      // 1. Create execution + expired task
      const [wf] = await db
        .insert(workflows)
        .values({ ownerId: testUserId, name: 'Crash Test Workflow' })
        .returning();

      const [ver] = await db
        .insert(workflowVersions)
        .values({ workflowId: wf.id, version: 1, definitionJson: { nodes: [], edges: [] } })
        .returning();

      const [exec] = await db
        .insert(executions)
        .values({ workflowId: wf.id, workflowVersionId: ver.id, triggerType: 'manual', status: 'RUNNING' })
        .returning();

      const [expiredTask] = await db
        .insert(taskInstances)
        .values({
          executionId: exec.id,
          nodeId: 'worker_crashed_node',
          status: 'RUNNING',
          attempt: 1, // Eligible for retry (< 3)
          workerId: 'crashed_worker_instance',
          leaseUntil: sql`NOW() - INTERVAL '10 seconds'`, // Expired!
        })
        .returning();

      // 2. Run lease reclaimer
      const reclaimedCount = await reclaimExpiredLeases(10, 3);
      expect(reclaimedCount).toBeGreaterThanOrEqual(1);

      // 3. Verify task is set to RETRYING and lease cleared
      const [reclaimedTask] = await db
        .select()
        .from(taskInstances)
        .where(eq(taskInstances.id, expiredTask.id));

      expect(reclaimedTask.status).toBe('RETRYING');
      expect(reclaimedTask.workerId).toBeNull();
      expect(reclaimedTask.leaseUntil).toBeNull();
    });

    it('dead-letters tasks that exceed max attempts during lease expiration', async () => {
      const [wf] = await db
        .insert(workflows)
        .values({ ownerId: testUserId, name: 'Max Retries Crash Workflow' })
        .returning();

      const [ver] = await db
        .insert(workflowVersions)
        .values({ workflowId: wf.id, version: 1, definitionJson: { nodes: [], edges: [] } })
        .returning();

      const [exec] = await db
        .insert(executions)
        .values({ workflowId: wf.id, workflowVersionId: ver.id, triggerType: 'manual', status: 'RUNNING' })
        .returning();

      const [exhaustedTask] = await db
        .insert(taskInstances)
        .values({
          executionId: exec.id,
          nodeId: 'exhausted_node',
          status: 'RUNNING',
          attempt: 3, // At max attempts!
          workerId: 'doomed_worker',
          leaseUntil: sql`NOW() - INTERVAL '10 seconds'`,
        })
        .returning();

      // Run lease reclaimer
      const reclaimedCount = await reclaimExpiredLeases(10, 3);
      expect(reclaimedCount).toBeGreaterThanOrEqual(1);

      // Verify task failed
      const [failedTask] = await db
        .select()
        .from(taskInstances)
        .where(eq(taskInstances.id, exhaustedTask.id));

      expect(failedTask.status).toBe('FAILED');
      expect(failedTask.leaseUntil).toBeNull();

      // Verify recorded in dead_letter_tasks
      const [dlq] = await db
        .select()
        .from(deadLetterTasks)
        .where(eq(deadLetterTasks.taskInstanceId, exhaustedTask.id));

      expect(dlq).toBeDefined();
      expect(dlq.executionId).toBe(exec.id);
      expect(dlq.replayStatus).toBe('PENDING');

      // Verify execution marked FAILED
      const [failedExec] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, exec.id));

      expect(failedExec.status).toBe('FAILED');
    });
  });
});
