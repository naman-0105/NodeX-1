import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackNode } from '../src/nodes/slack.js';
import { defaultNodeRegistry } from '../src/nodes/registry.js';
import type { ExecutionContext } from '@nodex/shared';

describe('SlackNode Executor Tests', () => {
  const dummyContext: ExecutionContext = {
    executionId: 'exec_123',
    taskId: 'task_123',
    nodeId: 'slack_1',
    workflowId: 'wf_1',
    workflowVersionId: 'ver_1',
    attempt: 1,
    stepOutputs: {},
    triggerPayload: {},
    credentials: {
      slack: {
        accessToken: 'xoxb-mock-token-for-test',
      },
    },
  };

  const slackNode = new SlackNode();

  it('is registered in defaultNodeRegistry under type "slack"', () => {
    expect(defaultNodeRegistry.has('slack')).toBe(true);
    const registeredNode = defaultNodeRegistry.get('slack');
    expect(registeredNode.type).toBe('slack');
  });

  describe('Validation', () => {
    it('throws error when input is missing or empty', () => {
      expect(() => slackNode.validate(null as any)).toThrow(/requires configuration input/);
    });

    it('throws error when channel is missing or empty', () => {
      expect(() => slackNode.validate({ channel: '', message: 'hello' })).toThrow(
        /requires a non-empty "channel"/
      );
    });

    it('throws error when message is missing or empty', () => {
      expect(() => slackNode.validate({ channel: 'general', message: '   ' })).toThrow(
        /requires a non-empty "message"/
      );
    });
  });

  describe('Execution', () => {
    it('returns FAILED when access token is not found in credentials or input', async () => {
      const contextWithoutCreds: ExecutionContext = {
        ...dummyContext,
        credentials: {},
      };

      const result = await slackNode.execute(
        { channel: 'general', message: 'Hello world' },
        contextWithoutCreds
      );

      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('SLACK_AUTH_MISSING');
      expect(result.error?.retriable).toBe(false);
    });

    it('successfully sends message using mock token without network call', async () => {
      const result = await slackNode.execute(
        { channel: 'general', message: 'Deploy notification' },
        dummyContext
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(result.output?.ok).toBe(true);
      expect(result.output?.channel).toBe('general');
      expect(result.output?.ts).toBeDefined();
      expect(result.output?.message).toEqual({
        text: 'Deploy notification',
        channel: 'general',
        type: 'message',
      });
    });

    it('supports direct token in input payload', async () => {
      const contextWithoutCreds: ExecutionContext = {
        ...dummyContext,
        credentials: undefined,
      };

      const result = await slackNode.execute(
        {
          channel: 'alerts',
          message: 'Server disk full',
          token: 'xoxb-mock-direct-token',
        },
        contextWithoutCreds
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(result.output?.channel).toBe('alerts');
    });

    describe('With Mocked Real Slack API', () => {
      const realContext: ExecutionContext = {
        ...dummyContext,
        credentials: {
          slack: {
            accessToken: 'xoxb-real-production-token',
          },
        },
      };

      const originalFetch = global.fetch;

      afterEach(() => {
        global.fetch = originalFetch;
      });

      it('handles successful Slack API response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            channel: 'C01234567',
            ts: '1600000000.000100',
            message: { text: 'Hello Slack!' },
          }),
        });

        const result = await slackNode.execute(
          { channel: 'C01234567', message: 'Hello Slack!' },
          realContext
        );

        expect(result.status).toBe('SUCCEEDED');
        expect(result.output?.ok).toBe(true);
        expect(result.output?.channel).toBe('C01234567');
        expect(result.output?.ts).toBe('1600000000.000100');
      });

      it('handles Slack API error response (e.g. channel_not_found)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            ok: false,
            error: 'channel_not_found',
          }),
        });

        const result = await slackNode.execute(
          { channel: 'invalid_channel', message: 'Hello Slack!' },
          realContext
        );

        expect(result.status).toBe('FAILED');
        expect(result.error?.code).toBe('SLACK_CHANNEL_NOT_FOUND');
        expect(result.error?.message).toContain('channel_not_found');
      });

      it('handles rate limiting (429 / rate_limited) as retriable', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            ok: false,
            error: 'rate_limited',
          }),
        });

        const result = await slackNode.execute(
          { channel: 'general', message: 'Spammy message' },
          realContext
        );

        expect(result.status).toBe('FAILED');
        expect(result.error?.retriable).toBe(true);
      });
    });
  });
});
