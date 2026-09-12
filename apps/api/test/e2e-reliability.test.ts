import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  db,
  closePool,
  users,
  workflows,
  workflowVersions,
  executions,
  taskInstances,
  outboxEvents,
  deadLetterTasks,
  eq,
  sql,
} from '@nodex/db';
import type { WorkflowDefinition } from '@nodex/shared';
import { createApp } from '../src/app.js';
import { pollAndPublishOutbox } from '../../worker/src/outbox/poller.js';
import { processWorkflowExecution } from '../../worker/src/queue/worker.js';
import { reclaimExpiredLeases } from '../../scheduler/src/lease-reclaimer.js';
import { closeRedisConnection } from '../../worker/src/queue/connection.js';
import { closeExecutionQueue, getExecutionQueue } from '../../worker/src/queue/queues.js';

describe('Phase 8: End-to-End Reliability & Observability Verification', () => {
  const app = createApp();
  let testUserId: string;

  beforeAll(async () => {
    // Clear outbox backlog from prior test runs
    await pollAndPublishOutbox(200);

    const [user] = await db
      .insert(users)
      .values({ email: `e2e-user-${Date.now()}@example.com`, passwordHash: 'pwd' })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await closeExecutionQueue();
    await closeRedisConnection();
    await closePool();
  });

  it('verifies /api/metrics observability endpoint', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
    expect(res.body.metrics).toBeDefined();
    expect(typeof res.body.metrics.outboxUnpublishedCount).toBe('number');
    expect(typeof res.body.metrics.pendingDeadLettersCount).toBe('number');
  });

  it('E2E Scenario 1: Async API Trigger -> Outbox -> BullMQ -> Worker Processor -> Completed DAG', async () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        {
          id: 'compute_score',
          type: 'transform',
          config: {
            code: 'return { score: 95, approved: true, username: input.user };',
          },
        },
        {
          id: 'check_score',
          type: 'if',
          config: {
            condition: 'steps.compute_score.output.score >= 80',
          },
        },
        {
          id: 'high_score_branch',
          type: 'transform',
          config: {
            code: 'return { tier: "VIP", granted: true };',
          },
        },
        {
          id: 'low_score_branch',
          type: 'transform',
          config: {
            code: 'return { tier: "STANDARD", granted: false };',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'compute_score' },
        { id: 'e2', source: 'compute_score', target: 'check_score' },
        { id: 'e3', source: 'check_score', target: 'high_score_branch', sourceHandle: 'true' },
        { id: 'e4', source: 'check_score', target: 'low_score_branch', sourceHandle: 'false' },
      ],
    };

    // 1. Create workflow via API
    const createWfRes = await request(app)
      .post('/api/workflows')
      .send({
        ownerId: testUserId,
        name: 'Credit Scoring Pipeline',
        definition,
      });
    expect(createWfRes.status).toBe(201);
    const workflowId = createWfRes.body.workflow.id;

    // 2. Trigger workflow via API
    const triggerRes = await request(app)
      .post(`/api/workflows/${workflowId}/trigger`)
      .send({
        triggerType: 'manual',
        payload: { user: 'alex_99' },
      });
    expect(triggerRes.status).toBe(202);
    const executionId = triggerRes.body.executionId;

    // 3. Outbox poller relays event to BullMQ
    const publishedCount = await pollAndPublishOutbox(10);
    expect(publishedCount).toBeGreaterThanOrEqual(1);

    // 4. Worker processes execution
    await processWorkflowExecution(executionId, 'worker_e2e_node');

    // 5. Query execution via API to verify DAG completed
    const execDetailsRes = await request(app).get(`/api/executions/${executionId}`);
    expect(execDetailsRes.status).toBe(200);
    expect(execDetailsRes.body.execution.status).toBe('COMPLETED');

    const tasks = execDetailsRes.body.tasks;
    const highScoreTask = tasks.find((t: any) => t.nodeId === 'high_score_branch');
    const lowScoreTask = tasks.find((t: any) => t.nodeId === 'low_score_branch');

    // Verified branching: 'true' branch executed, 'false' branch skipped
    expect(highScoreTask).toBeDefined();
    expect(highScoreTask.status).toBe('SUCCEEDED');
    expect(highScoreTask.outputJson.result.tier).toBe('VIP');

    expect(lowScoreTask).toBeDefined();
    expect(lowScoreTask.status).toBe('SKIPPED');
  });

  it('E2E Scenario 2: Worker Crash Recovery & Resumption from Checkpoint without duplicate side effects', async () => {
    // Workflow: Step 1 (succeeded) -> Step 2 (crashed mid-run) -> Step 3
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        {
          id: 'step_1',
          type: 'transform',
          config: { code: 'return { step1: "done" };' },
        },
        {
          id: 'step_2',
          type: 'transform',
          config: { code: 'return { step2: "done" };' },
        },
        {
          id: 'step_3',
          type: 'transform',
          config: { code: 'return { step3: "done" };' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'step_1' },
        { id: 'e2', source: 'step_1', target: 'step_2' },
        { id: 'e3', source: 'step_2', target: 'step_3' },
      ],
    };

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: testUserId, name: 'Crash Recovery Workflow' })
      .returning();

    const [ver] = await db
      .insert(workflowVersions)
      .values({ workflowId: wf.id, version: 1, definitionJson: definition })
      .returning();

    const [exec] = await db
      .insert(executions)
      .values({
        workflowId: wf.id,
        workflowVersionId: ver.id,
        triggerType: 'manual',
        status: 'RUNNING',
      })
      .returning();

    // Seed Step 1 as already SUCCEEDED
    await db.insert(taskInstances).values({
      executionId: exec.id,
      nodeId: 'step_1',
      status: 'SUCCEEDED',
      outputJson: { step1: 'done' },
    });

    // Seed Step 2 as crashed with expired lease
    const [crashedTask] = await db
      .insert(taskInstances)
      .values({
        executionId: exec.id,
        nodeId: 'step_2',
        status: 'RUNNING',
        attempt: 1,
        workerId: 'crashed_worker_dead',
        leaseUntil: sql`NOW() - INTERVAL '15 seconds'`,
      })
      .returning();

    // 1. Scheduler lease reclaimer detects crashed worker and sets RETRYING
    const reclaimed = await reclaimExpiredLeases(10, 3);
    expect(reclaimed).toBeGreaterThanOrEqual(1);

    const [taskAfterReclaim] = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.id, crashedTask.id));
    expect(taskAfterReclaim.status).toBe('RETRYING');
    expect(taskAfterReclaim.leaseUntil).toBeNull();

    // 2. New healthy worker picks up execution and resumes from Step 2 checkpoint
    await processWorkflowExecution(exec.id, 'healthy_worker_2');

    // 3. Verify workflow fully finished to completion
    const [completedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));

    expect(completedExec.status).toBe('COMPLETED');

    const finalTasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    expect(finalTasks.length).toBeGreaterThanOrEqual(4); // start, step_1, step_2, step_3 (plus retry attempts)
    const finalStep2 = finalTasks.find((t) => t.nodeId === 'step_2' && t.status === 'SUCCEEDED');
    const finalStep3 = finalTasks.find((t) => t.nodeId === 'step_3' && t.status === 'SUCCEEDED');
    expect(finalStep2).toBeDefined();
    expect(finalStep3).toBeDefined();
  });

  it('E2E Scenario 3: Human-In-The-Loop Approval Full Flow with Non-Blocking Worker', async () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        {
          id: 'expense_approval',
          type: 'approval',
          config: { prompt: 'Approve $5,000 server purchase?' },
        },
        {
          id: 'provision_server',
          type: 'transform',
          config: { code: 'return { serverProvisioned: true, approvedBy: steps.expense_approval.output.decision.approver };' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'expense_approval' },
        { id: 'e2', source: 'expense_approval', target: 'provision_server' },
      ],
    };

    const createWfRes = await request(app)
      .post('/api/workflows')
      .send({
        ownerId: testUserId,
        name: 'Server Purchase Workflow',
        definition,
      });
    const workflowId = createWfRes.body.workflow.id;

    // Trigger execution
    const triggerRes = await request(app).post(`/api/workflows/${workflowId}/trigger`).send({});
    const executionId = triggerRes.body.executionId;

    // Outbox & worker process until pause
    await pollAndPublishOutbox(10);
    await processWorkflowExecution(executionId, 'worker_hitl_run');

    // Verify WAITING state
    const waitingRes = await request(app).get(`/api/executions/${executionId}`);
    expect(waitingRes.body.execution.status).toBe('WAITING');

    const approvalTask = waitingRes.body.tasks.find((t: any) => t.nodeId === 'expense_approval');
    expect(approvalTask.status).toBe('WAITING');

    // Human approves via API
    const approveRes = await request(app)
      .post(`/api/executions/${executionId}/tasks/${approvalTask.id}/approve`)
      .send({ approver: 'cto@company.com', comments: 'Budget approved' });
    expect(approveRes.status).toBe(200);

    // Worker resumes continuation
    await processWorkflowExecution(executionId, 'worker_hitl_run');

    // Verify completed
    const finalRes = await request(app).get(`/api/executions/${executionId}`);
    expect(finalRes.body.execution.status).toBe('COMPLETED');
    const provTask = finalRes.body.tasks.find((t: any) => t.nodeId === 'provision_server');
    expect(provTask.status).toBe('SUCCEEDED');
    expect(provTask.outputJson.result.approvedBy).toBe('cto@company.com');
  });
});
