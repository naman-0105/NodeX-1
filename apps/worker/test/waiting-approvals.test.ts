import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  db,
  closePool,
  users,
  workflows,
  workflowVersions,
  executions,
  taskInstances,
  outboxEvents,
  eq,
} from '@nodex/db';
import type { WorkflowDefinition } from '@nodex/shared';
import { processWorkflowExecution } from '../src/queue/worker.js';
import { submitApprovalDecision } from '../../api/src/repositories/execution.js';
import { pollAndResumeDueDelays } from '../../scheduler/src/poller.js';

describe('Phase 6: Durable Waiting & Human-In-The-Loop Approval Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `hitl-user-${Date.now()}@example.com`, passwordHash: 'pwd' })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await closePool();
  });

  it('releases worker lease immediately upon entering WAITING status for approvals', async () => {
    // 1. Create approval workflow: Trigger -> Approval -> Transform
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start_node', type: 'trigger', config: {} },
        {
          id: 'manager_approval',
          type: 'approval',
          config: {
            prompt: 'Approve $10,000 refund for customer?',
            approvers: ['finance_admin'],
          },
        },
        {
          id: 'post_approval_task',
          type: 'transform',
          config: {
            code: 'return { refundProcessed: true, approvedBy: steps.manager_approval.output.decision.approver };',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start_node', target: 'manager_approval' },
        { id: 'e2', source: 'manager_approval', target: 'post_approval_task' },
      ],
    };

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: testUserId, name: 'Refund Approval Workflow', active: true })
      .returning();

    const [version] = await db
      .insert(workflowVersions)
      .values({ workflowId: wf.id, version: 1, definitionJson: definition })
      .returning();

    const [exec] = await db
      .insert(executions)
      .values({ workflowId: wf.id, workflowVersionId: version.id, triggerType: 'manual', status: 'QUEUED' })
      .returning();

    // 2. Worker executes workflow until it hits ApprovalNode
    await processWorkflowExecution(exec.id, 'worker_hitl_instance');

    // 3. Verify Execution entered WAITING
    const [waitingExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));

    expect(waitingExec.status).toBe('WAITING');

    // 4. CRITICAL INVARIANT: Verify worker lease was released immediately (lease_until is NULL)
    const tasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    const approvalTask = tasks.find((t) => t.nodeId === 'manager_approval');
    expect(approvalTask).toBeDefined();
    expect(approvalTask?.status).toBe('WAITING');
    expect(approvalTask?.leaseUntil).toBeNull(); // Worker is completely free!

    // 5. Simulate Human approving via API
    const decisionResult = await submitApprovalDecision(exec.id, approvalTask!.id, {
      approved: true,
      approver: 'alice@finance.com',
      comments: 'Approved per policy #41',
    });

    expect(decisionResult.task.status).toBe('SUCCEEDED');
    expect(decisionResult.execution.status).toBe('QUEUED');

    // 6. Verify continuation outbox event was generated
    const [outbox] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, exec.id));

    expect(outbox).toBeDefined();
    expect(outbox.eventType).toBe('execution.queued');

    // 7. Worker resumes and finishes remainder of the workflow
    await processWorkflowExecution(exec.id, 'worker_hitl_instance');

    // 8. Verify entire workflow completed successfully
    const [completedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));

    expect(completedExec.status).toBe('COMPLETED');
    expect(completedExec.finishedAt).not.toBeNull();

    const finalTasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    const postTask = finalTasks.find((t) => t.nodeId === 'post_approval_task');
    expect(postTask).toBeDefined();
    expect(postTask?.status).toBe('SUCCEEDED');
    expect((postTask?.outputJson as any).result.approvedBy).toBe('alice@finance.com');
  });

  it('handles rejection and marks workflow FAILED', async () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        { id: 'appr', type: 'approval', config: { prompt: 'Approve?' } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'appr' }],
    };

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: testUserId, name: 'Rejection Workflow' })
      .returning();

    const [ver] = await db
      .insert(workflowVersions)
      .values({ workflowId: wf.id, version: 1, definitionJson: definition })
      .returning();

    const [exec] = await db
      .insert(executions)
      .values({ workflowId: wf.id, workflowVersionId: ver.id, triggerType: 'manual', status: 'QUEUED' })
      .returning();

    await processWorkflowExecution(exec.id, 'worker_rej');

    const tasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    const apprTask = tasks.find((t) => t.nodeId === 'appr')!;
    expect(apprTask).toBeDefined();
    expect(apprTask.status).toBe('WAITING');

    const result = await submitApprovalDecision(exec.id, apprTask.id, {
      approved: false,
      approver: 'bob@security.com',
      comments: 'Security policy violation',
    });

    expect(result.task.status).toBe('FAILED');
    expect(result.execution.status).toBe('FAILED');
  });

  it('handles DelayNode: enters WAITING, releases lease, and resumes when deadline arrives', async () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        { id: 'wait_step', type: 'delay', config: { durationSeconds: 3600 } },
        { id: 'after_delay', type: 'transform', config: { code: 'return { done: true };' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'wait_step' },
        { id: 'e2', source: 'wait_step', target: 'after_delay' },
      ],
    };

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: testUserId, name: 'Delay Workflow' })
      .returning();

    const [ver] = await db
      .insert(workflowVersions)
      .values({ workflowId: wf.id, version: 1, definitionJson: definition })
      .returning();

    const [exec] = await db
      .insert(executions)
      .values({ workflowId: wf.id, workflowVersionId: ver.id, triggerType: 'manual', status: 'QUEUED' })
      .returning();

    // 1. Initial run enters WAITING
    await processWorkflowExecution(exec.id, 'worker_delay');

    const [waitingExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));
    expect(waitingExec.status).toBe('WAITING');

    const tasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    const delayTask = tasks.find((t) => t.nodeId === 'wait_step')!;
    expect(delayTask).toBeDefined();
    expect(delayTask.status).toBe('WAITING');
    expect(delayTask.leaseUntil).toBeNull(); // Worker lease freed!

    // 2. Simulate timer expiring in DB
    await db
      .update(taskInstances)
      .set({
        outputJson: {
          durationSeconds: 3600,
          resumeAt: new Date(Date.now() - 5000).toISOString(), // Past deadline!
        },
      })
      .where(eq(taskInstances.id, delayTask.id));

    // 3. Scheduler poller detects expired delay and resumes
    const resumedCount = await pollAndResumeDueDelays(10);
    expect(resumedCount).toBeGreaterThanOrEqual(1);

    const [queuedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));
    expect(queuedExec.status).toBe('QUEUED');

    // 4. Worker finishes continuation
    await processWorkflowExecution(exec.id, 'worker_delay');

    const [completedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));
    expect(completedExec.status).toBe('COMPLETED');
  });
});
