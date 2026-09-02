import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { db, users, closePool } from '@nodex/db';
import { createApp } from '../src/app.js';

describe('API Control Plane Integration Tests', () => {
  const app = createApp();
  let testUserId: string;

  beforeAll(async () => {
    // Seed a test user
    const [user] = await db
      .insert(users)
      .values({
        email: `api-user-${Date.now()}@example.com`,
        passwordHash: 'hashed_pw',
        role: 'user',
      })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await closePool();
  });

  it('GET /health returns healthy status and DB connection', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });

  it('manages full workflow lifecycle: create, get, update, version, trigger', async () => {
    const initialDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        { id: 'http_1', type: 'http', config: { url: 'https://httpbin.org/get' } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'http_1' }],
    };

    // 1. POST /api/workflows
    const createRes = await request(app)
      .post('/api/workflows')
      .send({
        ownerId: testUserId,
        name: 'Customer Notification Workflow',
        definition: initialDefinition,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.workflow.name).toBe('Customer Notification Workflow');
    expect(createRes.body.version.version).toBe(1);
    const workflowId = createRes.body.workflow.id;
    const v1Id = createRes.body.version.id;

    // 2. GET /api/workflows/:id
    const getRes = await request(app).get(`/api/workflows/${workflowId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.workflow.id).toBe(workflowId);
    expect(getRes.body.currentVersion.id).toBe(v1Id);

    // 3. PUT /api/workflows/:id
    const updateRes = await request(app)
      .put(`/api/workflows/${workflowId}`)
      .send({ name: 'Updated Notification Workflow' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Notification Workflow');

    // 4. POST /api/workflows/:id/versions (Publish v2)
    const v2Definition = {
      nodes: [
        ...initialDefinition.nodes,
        { id: 'transform_1', type: 'transform', config: { code: 'return input;' } },
      ],
      edges: [
        ...initialDefinition.edges,
        { id: 'e2', source: 'http_1', target: 'transform_1' },
      ],
    };

    const publishRes = await request(app)
      .post(`/api/workflows/${workflowId}/versions`)
      .send({ definition: v2Definition });

    expect(publishRes.status).toBe(201);
    expect(publishRes.body.version.version).toBe(2);
    expect(publishRes.body.workflow.currentVersionId).toBe(publishRes.body.version.id);

    // 5. GET /api/workflows/:id/versions
    const listVersionsRes = await request(app).get(`/api/workflows/${workflowId}/versions`);
    expect(listVersionsRes.status).toBe(200);
    expect(listVersionsRes.body.versions.length).toBe(2);

    // 6. POST /api/workflows/:id/trigger (Atomic execution + outbox event creation)
    const triggerRes = await request(app)
      .post(`/api/workflows/${workflowId}/trigger`)
      .send({
        triggerType: 'manual',
        payload: { userId: 'usr_abc' },
      });

    expect(triggerRes.status).toBe(202);
    expect(triggerRes.body.executionId).toBeDefined();
    expect(triggerRes.body.status).toBe('QUEUED');
    expect(triggerRes.body.workflowVersionId).toBe(publishRes.body.version.id);

    const executionId = triggerRes.body.executionId;

    // 7. GET /api/executions/:id
    const execDetailsRes = await request(app).get(`/api/executions/${executionId}`);
    expect(execDetailsRes.status).toBe(200);
    expect(execDetailsRes.body.execution.id).toBe(executionId);
    expect(execDetailsRes.body.execution.status).toBe('QUEUED');

    // 8. GET /api/workflows/:id/executions
    const listExecsRes = await request(app).get(`/api/workflows/${workflowId}/executions`);
    expect(listExecsRes.status).toBe(200);
    expect(listExecsRes.body.executions.length).toBeGreaterThanOrEqual(1);

    // 9. POST /api/executions/:id/cancel
    const cancelRes = await request(app).post(`/api/executions/${executionId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');
  });

  it('ingests webhooks and handles deduplication atomically', async () => {
    // 1. Create active workflow
    const wfRes = await request(app)
      .post('/api/workflows')
      .send({
        ownerId: testUserId,
        name: 'Webhook Ingestion Workflow',
        definition: {
          nodes: [{ id: 'trig', type: 'trigger', config: {} }],
          edges: [],
        },
      });

    const workflowId = wfRes.body.workflow.id;
    const eventId = `webhook_event_${Date.now()}`;

    // 2. First webhook delivery
    const hook1 = await request(app)
      .post(`/api/webhooks/${workflowId}`)
      .set('x-event-id', eventId)
      .send({ event: 'invoice.paid', amount: 9900 });

    expect(hook1.status).toBe(202);
    expect(hook1.body.duplicate).toBe(false);
    expect(hook1.body.executionId).toBeDefined();

    // 3. Duplicate webhook delivery with same external event ID
    const hook2 = await request(app)
      .post(`/api/webhooks/${workflowId}`)
      .set('x-event-id', eventId)
      .send({ event: 'invoice.paid', amount: 9900 });

    expect(hook2.status).toBe(200);
    expect(hook2.body.duplicate).toBe(true);
    expect(hook2.body.executionId).toBe(hook1.body.executionId);
  });

  it('validates request bodies and returns structured 400 error', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        name: '', // Empty name should fail
        definition: { nodes: [], edges: [] },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('returns structured 404 error for non-existent resources', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/workflows/${nonExistentId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
