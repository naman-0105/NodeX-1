import type { ExecutionContext } from './context.js';
import type { NodeResult } from './node-result.js';

export interface WorkflowNode<TInput = unknown, TOutput = unknown> {
  readonly type: string;
  validate(input: TInput): void;
  execute(input: TInput, context: ExecutionContext): Promise<NodeResult<TOutput>>;
}
