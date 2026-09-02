import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';

export interface TriggerNodeInput {
  readonly payload?: Record<string, unknown>;
}

export interface TriggerNodeOutput {
  readonly payload: Record<string, unknown>;
  readonly timestamp: string;
}

export class TriggerNode implements WorkflowNode<TriggerNodeInput, TriggerNodeOutput> {
  readonly type = 'trigger';

  validate(_input: TriggerNodeInput): void {
    // Trigger node does not require strict input parameters
  }

  async execute(
    input: TriggerNodeInput,
    context: ExecutionContext
  ): Promise<NodeResult<TriggerNodeOutput>> {
    const payload = input?.payload ?? context.triggerPayload ?? {};
    return {
      status: 'SUCCEEDED',
      output: {
        payload: payload as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
