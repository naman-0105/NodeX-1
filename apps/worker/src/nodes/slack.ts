import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';

export interface SlackNodeInput {
  readonly channel: string;
  readonly message: string;
  readonly token?: string;
  readonly timeoutMs?: number;
}

export interface SlackNodeOutput {
  readonly ok: boolean;
  readonly channel: string;
  readonly ts?: string;
  readonly message?: unknown;
}

export class SlackNode implements WorkflowNode<SlackNodeInput, SlackNodeOutput> {
  readonly type = 'slack';

  validate(input: SlackNodeInput): void {
    if (!input) {
      throw new Error('SlackNode requires configuration input');
    }
    if (!input.channel || typeof input.channel !== 'string' || !input.channel.trim()) {
      throw new Error('SlackNode requires a non-empty "channel" string');
    }
    if (!input.message || typeof input.message !== 'string' || !input.message.trim()) {
      throw new Error('SlackNode requires a non-empty "message" string');
    }
  }

  async execute(
    input: SlackNodeInput,
    context: ExecutionContext
  ): Promise<NodeResult<SlackNodeOutput>> {
    this.validate(input);

    const channel = input.channel.trim();
    const message = input.message.trim();
    const timeoutMs = input.timeoutMs ?? 15000;

    // Retrieve decrypted token from executionContext.credentials or input
    const creds = context.credentials as Record<string, any> | undefined;
    const slackCred = creds?.slack;
    const token =
      (typeof slackCred === 'object' ? slackCred?.accessToken : undefined) ||
      creds?.accessToken ||
      creds?.token ||
      input.token;

    if (!token || typeof token !== 'string') {
      return {
        status: 'FAILED',
        error: {
          message:
            'Slack access token not found. Please connect Slack in Settings/Integrations or provide a token in node configuration.',
          code: 'SLACK_AUTH_MISSING',
          retriable: false,
        },
      };
    }

    // Mock token handler for testing and local development
    if (token.startsWith('xoxb-mock-') || token.startsWith('mock_') || token.startsWith('test_')) {
      return {
        status: 'SUCCEEDED',
        output: {
          ok: true,
          channel,
          ts: `${Date.now() / 1000}.000100`,
          message: {
            text: message,
            channel,
            type: 'message',
          },
        },
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (context.signal) {
      context.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          text: message,
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as any;

      if (response.ok && data.ok) {
        return {
          status: 'SUCCEEDED',
          output: {
            ok: true,
            channel: data.channel || channel,
            ts: data.ts,
            message: data.message,
          },
        };
      }

      // Slack API returned an error payload
      const isRateLimit = data.error === 'rate_limited' || response.status === 429;
      return {
        status: 'FAILED',
        output: {
          ok: false,
          channel,
        },
        error: {
          message: `Slack API error: ${data.error || 'Failed to send message'}`,
          code: `SLACK_${(data.error || 'ERROR').toUpperCase()}`,
          retriable: isRateLimit || response.status >= 500,
          details: data,
        },
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      return {
        status: 'FAILED',
        error: {
          message: isTimeout
            ? `Slack API request timed out after ${timeoutMs}ms`
            : `Slack API network error: ${err.message}`,
          code: isTimeout ? 'SLACK_TIMEOUT' : 'SLACK_NETWORK_ERROR',
          retriable: true,
          details: { error: String(err) },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
