import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { db, users, closePool, encrypt, decrypt } from '@nodex/db';
import { createApp } from '../src/app.js';

describe('Integrations & Slack OAuth2 API Tests', () => {
  const app = createApp();
  let testUserId: string;

  beforeAll(async () => {
    // Seed a test user
    const [user] = await db
      .insert(users)
      .values({
        email: `integrations-user-${Date.now()}@example.com`,
        passwordHash: 'hashed_pw',
        role: 'user',
      })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Encryption Vault (AES-256-GCM)', () => {
    it('encrypts and decrypts sensitive tokens symmetrically', () => {
      const sensitiveToken = 'xoxb-1234567890-super-secret-slack-token';
      const encrypted = encrypt(sensitiveToken);

      expect(encrypted).not.toBe(sensitiveToken);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(sensitiveToken);
    });

    it('rejects tampered ciphertexts or tags gracefully', () => {
      const encrypted = encrypt('my-secret-token');
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      const tampered = `${parts[0]}:${parts[1]}:${parts[2].replace(/a/g, 'b')}`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('Slack OAuth2 Endpoints', () => {
    it('GET /api/integrations/slack/authorize returns redirect or authorization info', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/authorize')
        .query({ ownerId: testUserId, json: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
    });

    it('GET /api/integrations/slack/callback handles OAuth callback and stores encrypted token', async () => {
      const state = Buffer.from(
        JSON.stringify({ ownerId: testUserId, frontendRedirect: 'http://localhost:5173' })
      ).toString('base64');

      const res = await request(app)
        .get('/api/integrations/slack/callback')
        .query({ code: 'mock_slack_code_123', state })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.provider).toBe('slack');
    });

    it('POST /api/integrations/slack/token saves direct bot token', async () => {
      const res = await request(app)
        .post('/api/integrations/slack/token')
        .send({
          ownerId: testUserId,
          token: 'xoxb-mock-direct-token-456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/integrations/slack/channels returns channel list', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/channels')
        .query({ ownerId: testUserId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
    });

    it('GET /api/integrations/status returns integration connection status', async () => {
      const res = await request(app)
        .get('/api/integrations/status')
        .query({ ownerId: testUserId });

      expect(res.status).toBe(200);
      expect(res.body.slack).toBeDefined();
      expect(res.body.slack.connected).toBe(true);
    });

    it('DELETE /api/integrations/:provider disconnects the credential', async () => {
      const deleteRes = await request(app)
        .delete('/api/integrations/slack')
        .query({ ownerId: testUserId });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const statusRes = await request(app)
        .get('/api/integrations/status')
        .query({ ownerId: testUserId });

      expect(statusRes.body.slack.connected).toBe(false);
    });
  });
});
