import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';

export interface DelayNodeInput {
  readonly durationSeconds?: number;
  readonly until?: string;
}

export interface DelayNodeOutput {
  readonly durationSeconds?: number;
  readonly resumeAt: string;
  readonly resumedAt?: string;
}

export class DelayNode implements WorkflowNode<DelayNodeInput, DelayNodeOutput> {
  readonly type = 'delay';

  validate(input: DelayNodeInput): void {
    if (!input || (input.durationSeconds === undefined && !input.until)) {
      throw new Error('DelayNode requires either "durationSeconds" or "until" timestamp');
    }
  }

  async execute(
    input: DelayNodeInput,
    context: ExecutionContext
  ): Promise<NodeResult<DelayNodeOutput>> {
    this.validate(input);

    const existingOutput = context.stepOutputs[context.nodeId] as any;
    if (existingOutput && existingOutput.resumedAt) {
      return {
        status: 'SUCCEEDED',
        output: existingOutput as DelayNodeOutput,
      };
    }

    let resumeDate: Date;
    if (input.until) {
      resumeDate = new Date(input.until);
    } else {
      const durationMs = (input.durationSeconds ?? 0) * 1000;
      resumeDate = new Date(Date.now() + durationMs);
    }

    // Check if delay deadline has already passed
    if (Date.now() >= resumeDate.getTime()) {
      return {
        status: 'SUCCEEDED',
        output: {
          durationSeconds: input.durationSeconds,
          resumeAt: resumeDate.toISOString(),
          resumedAt: new Date().toISOString(),
        },
      };
    }

    // First time executing: transition to WAITING and release worker lease immediately
    return {
      status: 'WAITING',
      waitingReason: 'DELAY_UNTIL',
      output: {
        durationSeconds: input.durationSeconds,
        resumeAt: resumeDate.toISOString(),
      },
    };
  }
}
