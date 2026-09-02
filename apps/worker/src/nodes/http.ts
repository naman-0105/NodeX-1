import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';

export interface HttpNodeInput {
  readonly url: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly idempotencyKey?: string;
}

export interface HttpNodeOutput {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: unknown;
}

export class HttpNode implements WorkflowNode<HttpNodeInput, HttpNodeOutput> {
  readonly type = 'http';

  validate(input: HttpNodeInput): void {
    if (!input || !input.url) {
      throw new Error('HttpNode requires a valid "url" in its configuration');
    }
    try {
      new URL(input.url);
    } catch {
      throw new Error(`HttpNode received an invalid URL: "${input.url}"`);
    }
  }

  async execute(input: HttpNodeInput, context: ExecutionContext): Promise<NodeResult<HttpNodeOutput>> {
    this.validate(input);

    const method = input.method || 'GET';
    const timeoutMs = input.timeoutMs ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'NodeX-Workflow-Engine/1.0',
        ...(input.headers || {}),
      };

      let requestBody: string | undefined;
      if (input.body !== undefined && input.body !== null && method !== 'GET' && method !== 'HEAD') {
        if (typeof input.body === 'object') {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          requestBody = JSON.stringify(input.body);
        } else {
          requestBody = String(input.body);
        }
      }

      if (context.signal) {
        context.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const response = await fetch(input.url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      let responseData: unknown;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      if (response.ok) {
        return {
          status: 'SUCCEEDED',
          output: {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: responseData,
          },
          idempotencyKey: input.idempotencyKey,
        };
      } else {
        return {
          status: 'FAILED',
          output: {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: responseData,
          },
          error: {
            message: `HTTP Request failed with status ${response.status}: ${response.statusText}`,
            code: `HTTP_${response.status}`,
            retriable: response.status >= 500 || response.status === 429,
            details: responseData,
          },
        };
      }
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      return {
        status: 'FAILED',
        error: {
          message: isTimeout
            ? `HTTP request timed out after ${timeoutMs}ms`
            : `HTTP request network error: ${err.message}`,
          code: isTimeout ? 'HTTP_TIMEOUT' : 'HTTP_NETWORK_ERROR',
          retriable: true,
          details: { error: String(err) },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
