import { describe, it, expect, afterAll } from 'vitest';
import {
  db,
  closePool,
  users,
  workflows,
  workflowVersions,
  executions,
  taskInstances,
  idempotencyKeys,
  deadLetterTasks,
  eq,
} from '@nodex/db';
import { acquireTaskLease, renewTaskLease, releaseTaskLease } from '../src/reliability/lease.js';
import { calculateBackoffWithJitter, shouldRetryTask } from '../src/reliability/retry.js';
import { checkIdempotency, recordIdempotency } from '../src/reliability/idempotency.js';
import { moveToDeadLetter } from '../src/reliability/dlq.js';

describe('Worker Reliability Primitives Integration Tests', () => {
  afterAll(async () => {
    await closePool();
  });

  async function createTestExecutionAndTask() {
    const [user] = await db
      .insert(users)
      .values({ email: `rel-${Date.now()}@example.com`, passwordHash: 'hash' })
      .returning();

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: user.id, name: 'Reliability Test' })
      .returning();

    const [ver] = await db
      .insert(workflowVersions)
      .values({ workflowId: wf.id, version: 1, definitionJson: { nodes: [], edges: [] } })
      .returning();

    const [exec] = await db
      .insert(executions)
      .values({ workflowId: wf.id, workflowVersionId: ver.id, triggerType: 'manual' })
      .returning();

    const [task] = await db
      .insert(taskInstances)
      .values({ executionId: exec.id, nodeId: 'http_step', status: 'PENDING' })
      .returning();

    return { exec, task };
  }

  describe('Task Leasing', () => {
    it('acquires and renews lease for worker', async () => {
      const { task } = await createTestExecutionAndTask();
      const workerA = 'worker_alpha';
      const workerB = 'worker_beta';

      // Worker A acquires lease
      const acquired = await acquireTaskLease(task.id, workerA, { durationSeconds: 10 });
      expect(acquired).toBe(true);

      const [taskAfterLease] = await db
        .select()
        .from(taskInstances)
        .where(eq(taskInstances.id, task.id));
      expect(taskAfterLease.workerId).toBe(workerA);
      expect(taskAfterLease.status).toBe('RUNNING');
      expect(taskAfterLease.leaseUntil).not.toBeNull();

      // Worker B tries to acquire lease while Worker A holds active lease -> should fail
      const conflict = await acquireTaskLease(task.id, workerB, { durationSeconds: 10 });
      expect(conflict).toBe(false);

      // Worker A renews lease
      const renewed = await renewTaskLease(task.id, workerA, { durationSeconds: 15 });
      expect(renewed).toBe(true);

      // Worker A releases lease on completion
      const released = await releaseTaskLease(task.id, workerA, 'SUCCEEDED', {
        output: { result: 'ok' },
      });
      expect(released).toBe(true);

      const [finalTask] = await db
        .select()
        .from(taskInstances)
        .where(eq(taskInstances.id, task.id));
      expect(finalTask.status).toBe('SUCCEEDED');
      expect(finalTask.leaseUntil).toBeNull();
      expect(finalTask.outputJson).toEqual({ result: 'ok' });
    });
  });

  describe('Idempotency Keys', () => {
    it('checks and records composite idempotency keys', async () => {
      const { exec } = await createTestExecutionAndTask();
      const nodeId = 'stripe_payment';
      const opId = 'charge_999';

      // 1. Initial check returns false
      const initial = await checkIdempotency(exec.id, nodeId, opId);
      expect(initial.alreadyExecuted).toBe(false);

      // 2. Record idempotency snapshot
      await recordIdempotency(exec.id, nodeId, opId, { chargeId: 'ch_live_123', amount: 5000 });

      // 3. Second check returns true with cached snapshot
      const cached = await checkIdempotency(exec.id, nodeId, opId);
      expect(cached.alreadyExecuted).toBe(true);
      expect(cached.resultSnapshot).toEqual({ chargeId: 'ch_live_123', amount: 5000 });
    });
  });

  describe('Exponential Backoff & Retries', () => {
    it('calculates jittered backoff within bounded range', () => {
      for (let i = 0; i < 5; i++) {
        const delay = calculateBackoffWithJitter(i, { baseDelayMs: 100, maxDelayMs: 5000 });
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(5000);
      }
    });

    it('decides retry eligibility correctly', () => {
      expect(shouldRetryTask(1, { retriable: true }, { maxAttempts: 3 })).toBe(true);
      expect(shouldRetryTask(3, { retriable: true }, { maxAttempts: 3 })).toBe(false);
      expect(shouldRetryTask(1, { retriable: false }, { maxAttempts: 3 })).toBe(false);
    });
  });

  describe('Dead Letter Queue (DLQ)', () => {
    it('persists exhausted failed tasks in dead_letter_tasks', async () => {
      const { exec, task } = await createTestExecutionAndTask();
      const finalError = { message: 'Max retry attempts exhausted', code: 'ETIMEDOUT' };

      const dlqId = await moveToDeadLetter(task.id, exec.id, finalError);
      expect(dlqId).toBeDefined();

      const [dlqRow] = await db
        .select()
        .from(deadLetterTasks)
        .where(eq(deadLetterTasks.id, dlqId));

      expect(dlqRow).toBeDefined();
      expect(dlqRow.taskInstanceId).toBe(task.id);
      expect(dlqRow.executionId).toBe(exec.id);
      expect(dlqRow.replayStatus).toBe('PENDING');
      expect(dlqRow.finalError).toEqual(finalError);
    });
  });
});
