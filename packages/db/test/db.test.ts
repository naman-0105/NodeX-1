import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getPool,
  closePool,
  runMigrations,
  query,
  checkHealth,
  db,
  withTransaction,
  withPgTransaction,
  eq,
  users,
  workflows,
  workflowVersions,
  executions,
  taskInstances,
  executionEvents,
  webhookEvents,
  workflowSchedules,
  outboxEvents,
  idempotencyKeys,
  deadLetterTasks,
} from '../src/index.js';
import type { WorkflowDefinition } from '@nodex/shared';

describe('Drizzle Database Access Layer & Migrations Tests', () => {
  beforeAll(async () => {
    const isHealthy = await checkHealth();
    expect(isHealthy).toBe(true);
  });

  afterAll(async () => {
    await closePool();
  });

  it('runs initial migrations cleanly and idempotently', async () => {
    const applied1 = await runMigrations();
    expect(Array.isArray(applied1)).toBe(true);

    // Second run should apply 0 new migrations
    const applied2 = await runMigrations();
    expect(applied2.length).toBe(0);
  });

  it('verifies all 12 core tables exist in PostgreSQL', async () => {
    const expectedTables = [
      'users',
      'workflows',
      'workflow_versions',
      'credentials',
      'executions',
      'task_instances',
      'execution_events',
      'webhook_events',
      'workflow_schedules',
      'outbox_events',
      'idempotency_keys',
      'dead_letter_tasks',
    ];

    const res = await query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    const tablesInDb = new Set(res.rows.map((r) => r.table_name));

    for (const table of expectedTables) {
      expect(tablesInDb.has(table), `Table ${table} should exist in DB`).toBe(true);
    }
  });

  it('inserts and queries user -> workflow -> immutable version -> execution via Drizzle query builder', async () => {
    // 1. Insert user via Drizzle
    const [user] = await db
      .insert(users)
      .values({
        email: `drizzle-user-${Date.now()}@example.com`,
        passwordHash: 'hash_drizzle',
        role: 'admin',
      })
      .returning();

    expect(user.id).toBeDefined();
    expect(user.role).toBe('admin');

    // 2. Insert workflow via Drizzle
    const [workflow] = await db
      .insert(workflows)
      .values({
        ownerId: user.id,
        name: 'Drizzle Customer Onboarding Workflow',
      })
      .returning();

    expect(workflow.id).toBeDefined();
    expect(workflow.ownerId).toBe(user.id);

    // 3. Insert immutable workflow version with typed JSONB definition
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'trigger_1', type: 'trigger', config: {} },
        { id: 'http_1', type: 'http', config: { url: 'https://api.nodex.io/verify' } },
        { id: 'transform_1', type: 'transform', config: { code: 'return { ok: true };' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'http_1' },
        { id: 'e2', source: 'http_1', target: 'transform_1' },
      ],
    };

    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflowId: workflow.id,
        version: 1,
        definitionJson: definition,
      })
      .returning();

    expect(version.id).toBeDefined();
    expect(version.version).toBe(1);
    expect(version.definitionJson.nodes.length).toBe(3);

    // Update workflow currentVersionId
    await db
      .update(workflows)
      .set({ currentVersionId: version.id })
      .where(eq(workflows.id, workflow.id));

    // 4. Insert execution pinned to immutable workflow version
    const [execution] = await db
      .insert(executions)
      .values({
        workflowId: workflow.id,
        workflowVersionId: version.id,
        triggerType: 'manual',
        status: 'CREATED',
      })
      .returning();

    expect(execution.id).toBeDefined();
    expect(execution.workflowVersionId).toBe(version.id);
    expect(execution.status).toBe('CREATED');

    // 5. Insert task instances
    const [task] = await db
      .insert(taskInstances)
      .values({
        executionId: execution.id,
        nodeId: 'trigger_1',
        status: 'SUCCEEDED',
        attempt: 1,
        inputJson: { event: 'signup' },
        outputJson: { userId: 'usr_123' },
      })
      .returning();

    expect(task.id).toBeDefined();
    expect(task.status).toBe('SUCCEEDED');
    expect(task.attempt).toBe(1);

    // 6. Query execution with Drizzle eq filter
    const foundExecutions = await db
      .select()
      .from(executions)
      .where(eq(executions.id, execution.id));

    expect(foundExecutions.length).toBe(1);
    expect(foundExecutions[0].id).toBe(execution.id);
  });

  it('enforces webhook deduplication constraint using Drizzle', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `webhook-drizzle-${Date.now()}@example.com`,
        passwordHash: 'hash',
      })
      .returning();

    const [workflow] = await db
      .insert(workflows)
      .values({
        ownerId: user.id,
        name: 'Webhook Dedupe Drizzle Test',
      })
      .returning();

    const externalEventId = `evt_drizzle_${Date.now()}`;

    // First insert succeeds
    const [firstEvent] = await db
      .insert(webhookEvents)
      .values({
        workflowId: workflow.id,
        externalEventId,
        payloadHash: 'hash_abc123',
      })
      .returning();

    expect(firstEvent.id).toBeDefined();

    // Duplicate insert must throw unique constraint violation
    await expect(
      db.insert(webhookEvents).values({
        workflowId: workflow.id,
        externalEventId,
        payloadHash: 'hash_abc123_duplicate',
      })
    ).rejects.toThrow();
  });

  it('enforces composite idempotency key uniqueness using Drizzle', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `idemp-drizzle-${Date.now()}@example.com`,
        passwordHash: 'hash',
      })
      .returning();

    const [workflow] = await db
      .insert(workflows)
      .values({
        ownerId: user.id,
        name: 'Idempotency Drizzle Test',
      })
      .returning();

    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflowId: workflow.id,
        version: 1,
        definitionJson: { nodes: [], edges: [] },
      })
      .returning();

    const [execution] = await db
      .insert(executions)
      .values({
        workflowId: workflow.id,
        workflowVersionId: version.id,
        triggerType: 'manual',
      })
      .returning();

    // First key insert succeeds
    const [firstKey] = await db
      .insert(idempotencyKeys)
      .values({
        executionId: execution.id,
        nodeId: 'stripe_charge',
        logicalOperationId: 'charge_req_001',
        resultSnapshot: { chargeId: 'ch_123', amount: 5000 },
      })
      .returning();

    expect(firstKey.id).toBeDefined();

    // Duplicate composite key (execution_id, node_id, logical_operation_id) must throw
    await expect(
      db.insert(idempotencyKeys).values({
        executionId: execution.id,
        nodeId: 'stripe_charge',
        logicalOperationId: 'charge_req_001',
        resultSnapshot: { chargeId: 'ch_456', amount: 5000 },
      })
    ).rejects.toThrow();
  });

  it('handles explicit Drizzle transactions: commit and rollback', async () => {
    const userEmail = `tx-drizzle-${Date.now()}@example.com`;

    // 1. Rollback test
    await expect(
      withTransaction(async (tx) => {
        await tx.insert(users).values({
          email: userEmail,
          passwordHash: 'pwd',
        });
        throw new Error('Simulated rollback in Drizzle transaction');
      })
    ).rejects.toThrow('Simulated rollback in Drizzle transaction');

    const rollbackCheck = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail));
    expect(rollbackCheck.length).toBe(0);

    // 2. Commit test (Atomic Execution + Outbox Event creation)
    const txResult = await withTransaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email: userEmail,
          passwordHash: 'pwd',
        })
        .returning();

      const [wf] = await tx
        .insert(workflows)
        .values({
          ownerId: u.id,
          name: 'Atomic Outbox Workflow',
        })
        .returning();

      const [ver] = await tx
        .insert(workflowVersions)
        .values({
          workflowId: wf.id,
          version: 1,
          definitionJson: { nodes: [], edges: [] },
        })
        .returning();

      const [exec] = await tx
        .insert(executions)
        .values({
          workflowId: wf.id,
          workflowVersionId: ver.id,
          triggerType: 'manual',
          status: 'QUEUED',
        })
        .returning();

      const [outbox] = await tx
        .insert(outboxEvents)
        .values({
          aggregateId: exec.id,
          eventType: 'execution.queued',
          payloadJson: { executionId: exec.id, workflowId: wf.id },
        })
        .returning();

      return { exec, outbox };
    });

    expect(txResult.exec.id).toBeDefined();
    expect(txResult.outbox.id).toBeDefined();

    // Verify both were committed
    const [savedExec] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, txResult.exec.id));
    expect(savedExec).toBeDefined();
    expect(savedExec.status).toBe('QUEUED');

    const [savedOutbox] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, txResult.outbox.id));
    expect(savedOutbox).toBeDefined();
    expect(savedOutbox.aggregateId).toBe(txResult.exec.id);
  });

  it('handles raw pg transactions via withPgTransaction', async () => {
    const rawEmail = `raw-tx-${Date.now()}@example.com`;

    // Rollback scenario
    await expect(
      withPgTransaction(async (client) => {
        await client.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)`, [
          rawEmail,
          'pwd',
        ]);
        throw new Error('Raw PG rollback');
      })
    ).rejects.toThrow('Raw PG rollback');

    const checkRes = await query(`SELECT * FROM users WHERE email = $1`, [rawEmail]);
    expect(checkRes.rows.length).toBe(0);

    // Commit scenario
    await withPgTransaction(async (client) => {
      await client.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)`, [
        rawEmail,
        'pwd',
      ]);
    });

    const checkCommitted = await query(`SELECT * FROM users WHERE email = $1`, [rawEmail]);
    expect(checkCommitted.rows.length).toBe(1);
  });

  it('supports PostgreSQL locking operations (FOR UPDATE SKIP LOCKED)', async () => {
    // Insert an unpublished outbox event
    const [event] = await db
      .insert(outboxEvents)
      .values({
        aggregateId: '00000000-0000-0000-0000-000000000001',
        eventType: 'test.event',
        payloadJson: { test: true },
      })
      .returning();

    expect(event.id).toBeDefined();

    // Verify query with FOR UPDATE SKIP LOCKED via Drizzle works cleanly
    const lockedEvents = await withTransaction(async (tx) => {
      return tx
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.id, event.id))
        .for('update', { skipLocked: true });
    });

    expect(lockedEvents.length).toBe(1);
    expect(lockedEvents[0].id).toBe(event.id);
  });
});
