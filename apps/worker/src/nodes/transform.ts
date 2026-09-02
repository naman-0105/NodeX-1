import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';
import { runSandboxedCode, SandboxError } from '../engine/sandbox.js';
import { createStepScope } from '../engine/evaluator.js';

export interface TransformNodeInput {
  readonly code: string;
  readonly input?: unknown;
  readonly timeoutMs?: number;
}

export interface TransformNodeOutput {
  readonly result: unknown;
  readonly logs: readonly string[];
  readonly executionTimeMs: number;
}

export class TransformNode implements WorkflowNode<TransformNodeInput, TransformNodeOutput> {
  readonly type = 'transform';

  validate(input: TransformNodeInput): void {
    if (!input || typeof input.code !== 'string' || !input.code.trim()) {
      throw new Error('TransformNode requires non-empty JavaScript "code" string in its configuration');
    }
  }

  async execute(
    input: TransformNodeInput,
    context: ExecutionContext
  ): Promise<NodeResult<TransformNodeOutput>> {
    this.validate(input);

    try {
      const sandboxRes = await runSandboxedCode(
        input.code,
        {
          input: input.input ?? {},
          steps: createStepScope(context.stepOutputs as Record<string, unknown>),
          trigger: context.triggerPayload ?? {},
        },
        {
          timeoutMs: input.timeoutMs ?? 2000,
        }
      );

      return {
        status: 'SUCCEEDED',
        output: {
          result: sandboxRes.result,
          logs: sandboxRes.logs,
          executionTimeMs: sandboxRes.executionTimeMs,
        },
      };
    } catch (err: any) {
      const isSandboxErr = err instanceof SandboxError;
      return {
        status: 'FAILED',
        error: {
          message: err.message,
          code: isSandboxErr ? err.code : 'TRANSFORM_EXECUTION_ERROR',
          retriable: false,
          details: { codeSnippet: input.code },
        },
      };
    }
  }
}
