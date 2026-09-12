import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { closePool } from '@nodex/db';
import { createApp } from '../src/app.js';

describe('Authentication & User Management API Tests', () => {
  const app = createApp();
  const testEmail = `auth-test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authToken: string;
  let testUserId: string;

  afterAll(async () => {
    await closePool();
  });

  it('POST /api/auth/register creates a new user and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Jane Doe',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.user.name).toBe('Jane Doe');
    expect(res.body.user.authProvider).toBe('local');
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');

    authToken = res.body.token;
    testUserId = res.body.user.id;
  });

  it('POST /api/auth/register fails on duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'AnotherPassword',
      });

    expect(res.status).toBe(409);
    expect(res.body.error?.message).toContain('already exists');
  });

  it('POST /api/auth/login succeeds with correct password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(testUserId);
    expect(res.body.token).toBeDefined();
  });

  it('POST /api/auth/login fails with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error?.message).toContain('Invalid email or password');
  });

  it('GET /api/auth/me returns authenticated user profile with Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(testUserId);
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.user.name).toBe('Jane Doe');
  });

  it('GET /api/auth/me returns 401 without Bearer token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/google/url returns OAuth configuration object', async () => {
    const res = await request(app).get('/api/auth/google/url');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('configured');
    expect(res.body).toHaveProperty('url');
  });

  it('creates workflow with authenticated user as owner', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Jane Secret Pipeline',
        definition: {
          nodes: [{ id: 'n1', type: 'trigger', config: {} }],
          edges: [],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.workflow.ownerId).toBe(testUserId);
    expect(res.body.workflow.name).toBe('Jane Secret Pipeline');
  });
});
