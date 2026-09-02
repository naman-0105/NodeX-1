import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';
import { evaluateExpression } from '../engine/evaluator.js';

export interface IfNodeInput {
  readonly expression: string;
}

export interface IfNodeOutput {
  readonly condition: boolean;
  readonly branch: 'true' | 'false';
}

export class IfNode implements WorkflowNode<IfNodeInput, IfNodeOutput> {
  readonly type = 'if';

  validate(input: IfNodeInput): void {
    if (!input || typeof input.expression !== 'string' || !input.expression.trim()) {
      throw new Error('IfNode requires a valid "expression" string in its configuration');
    }
  }

  async execute(input: IfNodeInput, context: ExecutionContext): Promise<NodeResult<IfNodeOutput>> {
    this.validate(input);

    try {
      const stepsContext: Record<string, { output?: unknown; error?: unknown }> = {};
      for (const [nodeId, val] of Object.entries(context.stepOutputs || {})) {
        if (val && typeof val === 'object' && ('output' in val || 'error' in val)) {
          stepsContext[nodeId] = val as { output?: unknown; error?: unknown };
        } else {
          stepsContext[nodeId] = { output: val };
        }
      }

      const evalResult = evaluateExpression(input.expression, {
        steps: stepsContext,
        trigger: context.triggerPayload as Record<string, unknown>,
        env: context.env as Record<string, string>,
      });

      const condition = Boolean(evalResult);
      return {
        status: 'SUCCEEDED',
        output: {
          condition,
          branch: condition ? 'true' : 'false',
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: {
          message: `IfNode expression evaluation failed: ${err.message}`,
          code: 'IF_EXPRESSION_ERROR',
          retriable: false,
          details: { expression: input.expression },
        },
      };
    }
  }
}
