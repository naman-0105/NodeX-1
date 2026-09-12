import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiNode } from '../src/nodes/gemini.js';
import { defaultNodeRegistry } from '../src/nodes/registry.js';
import type { ExecutionContext } from '@nodex/shared';

describe('GeminiNode Executor Tests', () => {
  const dummyContext: ExecutionContext = {
    executionId: 'exec_gemini_1',
    taskId: 'task_gemini_1',
    nodeId: 'gemini_1',
    workflowId: 'wf_1',
    workflowVersionId: 'ver_1',
    attempt: 1,
    stepOutputs: {},
    triggerPayload: {},
    env: {
      GEMINI_API_KEY: 'test-gemini-api-key-12345',
    },
  };

  const geminiNode = new GeminiNode();

  it('is registered in defaultNodeRegistry under type "gemini"', () => {
    expect(defaultNodeRegistry.has('gemini')).toBe(true);
    const registered = defaultNodeRegistry.get('gemini');
    expect(registered.type).toBe('gemini');
  });

  describe('Validation', () => {
    it('throws error when input is null or missing', () => {
      expect(() => geminiNode.validate(null as any)).toThrow(/requires configuration input/);
    });

    it('throws error when prompt is empty or whitespace', () => {
      expect(() => geminiNode.validate({ prompt: '' })).toThrow(/requires a non-empty "prompt"/);
      expect(() => geminiNode.validate({ prompt: '   ' })).toThrow(/requires a non-empty "prompt"/);
    });

    it('passes validation when valid prompt is provided', () => {
      expect(() => geminiNode.validate({ prompt: 'Explain quantum computing' })).not.toThrow();
    });
  });

  describe('Execution & Error Handling', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns FAILED with GEMINI_API_KEY_MISSING when API key is not present', async () => {
      const contextWithoutKey: ExecutionContext = {
        ...dummyContext,
        env: {},
      };

      // Ensure process.env does not have it for this test
      const prevKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const result = await geminiNode.execute(
          { prompt: 'Tell me a joke' },
          contextWithoutKey
        );

        expect(result.status).toBe('FAILED');
        expect(result.error?.code).toBe('GEMINI_API_KEY_MISSING');
        expect(result.error?.retriable).toBe(false);
      } finally {
        if (prevKey) process.env.GEMINI_API_KEY = prevKey;
      }
    });

    it('successfully calls Gemini REST API and extracts output text', async () => {
      let capturedUrl = '';
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Hello! I am Gemini, an AI developed by Google.' }],
                  role: 'model',
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              promptTokenCount: 5,
              candidatesTokenCount: 12,
              totalTokenCount: 17,
            },
          }),
        };
      });

      const result = await geminiNode.execute(
        {
          prompt: 'Introduce yourself',
          model: 'gemini-3.6-flash',
        },
        dummyContext
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(result.output?.result).toBe('Hello! I am Gemini, an AI developed by Google.');
      expect(result.output?.model).toBe('gemini-3.6-flash');
      expect(result.output?.finishReason).toBe('STOP');
      expect(result.output?.usageMetadata?.totalTokenCount).toBe(17);

      expect(capturedUrl).toContain('gemini-3.6-flash:generateContent');
      expect(capturedUrl).toContain('key=test-gemini-api-key-12345');
      expect(capturedBody.contents[0].parts[0].text).toBe('Introduce yourself');
    });

    it('formats systemPrompt into systemInstruction payload', async () => {
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Concise summary.' }],
                },
              },
            ],
          }),
        };
      });

      const result = await geminiNode.execute(
        {
          prompt: 'Summarize this document',
          systemPrompt: 'You are a concise executive assistant.',
          model: 'gemini-2.5-pro',
        },
        dummyContext
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(capturedBody.systemInstruction).toEqual({
        parts: [{ text: 'You are a concise executive assistant.' }],
      });
      expect(capturedBody.contents[0].parts[0].text).toBe('Summarize this document');
    });

    it('treats HTTP 429 rate limits and 5xx errors as retriable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: {
            code: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
      });

      const result = await geminiNode.execute(
        { prompt: 'Heavy AI query' },
        dummyContext
      );

      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('GEMINI_429');
      expect(result.error?.retriable).toBe(true);
      expect(result.error?.message).toContain('Resource has been exhausted');
    });

    it('treats HTTP 400 Bad Request as non-retriable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 400,
            message: 'Invalid JSON payload structure.',
            status: 'INVALID_ARGUMENT',
          },
        }),
      });

      const result = await geminiNode.execute(
        { prompt: 'Query with bad parameter' },
        dummyContext
      );

      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('GEMINI_400');
      expect(result.error?.retriable).toBe(false);
    });

    it('handles network timeouts and abort signals as retriable errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: Connection timed out'));

      const result = await geminiNode.execute(
        { prompt: 'Query that disconnects' },
        dummyContext
      );

      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('GEMINI_NETWORK_ERROR');
      expect(result.error?.retriable).toBe(true);
    });
  });
});
