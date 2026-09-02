import { describe, it, expect, afterAll } from 'vitest';
import {
  db,
  closePool,
  users,
  workflows,
  workflowVersions,
  executions,
  taskInstances,
  executionEvents,
  eq,
} from '@nodex/db';
import type { WorkflowDefinition } from '@nodex/shared';
import { processWorkflowExecution } from '../src/queue/worker.js';

describe('Durable Workflow Queue Processor Integration Tests', () => {
  afterAll(async () => {
    await closePool();
  });

  it('durably executes a workflow against PostgreSQL state machine', async () => {
    // 1. Setup user & workflow in PostgreSQL
    const [user] = await db
      .insert(users)
      .values({ email: `worker-test-${Date.now()}@example.com`, passwordHash: 'pwd' })
      .returning();

    const [wf] = await db
      .insert(workflows)
      .values({ ownerId: user.id, name: 'Durable Queue Workflow' })
      .returning();

    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'start_node', type: 'trigger', config: {} },
        {
          id: 'transform_data',
          type: 'transform',
          config: {
            code: 'return { message: "Hello NodeX", processed: true, code: 200 };',
          },
        },
      ],
      edges: [{ id: 'e1', source: 'start_node', target: 'transform_data' }],
    };

    // 2. Insert immutable workflow version
    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflowId: wf.id,
        version: 1,
        definitionJson: definition,
      })
      .returning();

    // 3. Insert execution in QUEUED status
    const [exec] = await db
      .insert(executions)
      .values({
        workflowId: wf.id,
        workflowVersionId: version.id,
        triggerType: 'manual',
        status: 'QUEUED',
      })
      .returning();

    expect(exec.status).toBe('QUEUED');

    // 4. Process execution via worker engine
    await processWorkflowExecution(exec.id, 'test_worker_instance');

    // 5. Verify execution transitioned to COMPLETED in PostgreSQL
    const [completedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, exec.id));

    expect(completedExec.status).toBe('COMPLETED');
    expect(completedExec.startedAt).not.toBeNull();
    expect(completedExec.finishedAt).not.toBeNull();

    // 6. Verify task instances were durably created and succeeded
    const tasks = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.executionId, exec.id));

    expect(tasks.length).toBe(2);
    const transformTask = tasks.find((t) => t.nodeId === 'transform_data');
    expect(transformTask).toBeDefined();
    expect(transformTask?.status).toBe('SUCCEEDED');
    expect((transformTask?.outputJson as any).result.message).toBe('Hello NodeX');

    // 7. Verify audit trail was appended to execution_events
    const events = await db
      .select()
      .from(executionEvents)
      .where(eq(executionEvents.executionId, exec.id));

    expect(events.length).toBeGreaterThanOrEqual(3);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain('execution.started');
    expect(eventTypes).toContain('task.succeeded');
    expect(eventTypes).toContain('execution.completed');
  });
});
