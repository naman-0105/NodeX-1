import { describe, it, expect, vi } from 'vitest';
import { TriggerNode } from '../src/nodes/trigger.js';
import { HttpNode } from '../src/nodes/http.js';
import { TransformNode } from '../src/nodes/transform.js';
import { IfNode } from '../src/nodes/if.js';
import type { ExecutionContext } from '@nodex/shared';

describe('MVP Node Executors', () => {
  const dummyContext: ExecutionContext = {
    executionId: 'exec_123',
    taskId: 'task_123',
    nodeId: 'node_1',
    workflowId: 'wf_1',
    workflowVersionId: 'ver_1',
    attempt: 1,
    stepOutputs: {
      prev_node: { value: 42 },
    },
    triggerPayload: {
      userId: 'usr_abc',
    },
  };

  describe('TriggerNode', () => {
    const trigger = new TriggerNode();

    it('passes trigger payload through to output', async () => {
      const res = await trigger.execute({}, dummyContext);
      expect(res.status).toBe('SUCCEEDED');
      expect(res.output?.payload).toEqual({ userId: 'usr_abc' });
      expect(res.output?.timestamp).toBeDefined();
    });
  });

  describe('TransformNode', () => {
    const transform = new TransformNode();

    it('validates required code property', () => {
      expect(() => transform.validate({ code: '' })).toThrow(/requires non-empty/);
    });

    it('executes user transform in sandbox with context access', async () => {
      const res = await transform.execute(
        {
          code: 'return { doubled: steps.prev_node.value * 2, user: trigger.userId };',
        },
        dummyContext
      );

      expect(res.status).toBe('SUCCEEDED');
      expect(res.output?.result).toEqual({
        doubled: 84,
        user: 'usr_abc',
      });
    });
  });

  describe('IfNode', () => {
    const ifNode = new IfNode();

    it('validates required expression property', () => {
      expect(() => ifNode.validate({ expression: '' })).toThrow(/requires a valid "expression"/);
    });

    it('branches "true" when expression evaluates truthy', async () => {
      const res = await ifNode.execute(
        { expression: 'steps.prev_node.value === 42' },
        dummyContext
      );

      expect(res.status).toBe('SUCCEEDED');
      expect(res.output).toEqual({
        condition: true,
        branch: 'true',
      });
    });

    it('branches "false" when expression evaluates falsy', async () => {
      const res = await ifNode.execute(
        { expression: 'steps.prev_node.value > 100' },
        dummyContext
      );

      expect(res.status).toBe('SUCCEEDED');
      expect(res.output).toEqual({
        condition: false,
        branch: 'false',
      });
    });
  });

  describe('HttpNode', () => {
    const httpNode = new HttpNode();

    it('validates required url', () => {
      expect(() => httpNode.validate({ url: '' })).toThrow(/requires a valid "url"/);
      expect(() => httpNode.validate({ url: 'not-a-url' })).toThrow(/invalid URL/);
    });

    it('executes HTTP fetch call (mocked)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, id: 123 }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const res = await httpNode.execute(
        {
          url: 'https://api.example.com/items',
          method: 'POST',
          body: { name: 'Widget' },
        },
        dummyContext
      );

      expect(res.status).toBe('SUCCEEDED');
      expect(res.output?.status).toBe(200);
      expect(res.output?.data).toEqual({ success: true, id: 123 });

      vi.unstubAllGlobals();
    });
  });
});
