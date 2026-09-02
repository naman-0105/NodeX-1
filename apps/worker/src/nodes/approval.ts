import type { WorkflowNode, ExecutionContext, NodeResult } from '@nodex/shared';

export interface ApprovalNodeInput {
  readonly prompt?: string;
  readonly approvers?: readonly string[];
  readonly timeoutSeconds?: number;
  readonly defaultDecision?: 'APPROVED' | 'REJECTED';
}

export interface ApprovalDecision {
  readonly approved: boolean;
  readonly approver?: string;
  readonly comments?: string;
  readonly decisionAt?: string;
}

export interface ApprovalNodeOutput {
  readonly prompt: string;
  readonly approvers: readonly string[];
  readonly requestedAt: string;
  readonly decision?: ApprovalDecision;
}

export class ApprovalNode implements WorkflowNode<ApprovalNodeInput, ApprovalNodeOutput> {
  readonly type = 'approval';

  validate(_input: ApprovalNodeInput): void {
    // Optional prompt/approvers validation
  }

  async execute(
    input: ApprovalNodeInput,
    context: ExecutionContext
  ): Promise<NodeResult<ApprovalNodeOutput>> {
    this.validate(input);

    // If context already contains prior step/task resolution data (resumption payload)
    const existingOutput = context.stepOutputs[context.nodeId] as any;
    if (existingOutput && existingOutput.decision) {
      return {
        status: 'SUCCEEDED',
        output: existingOutput as ApprovalNodeOutput,
      };
    }

    // First time executing: transition to WAITING and release worker lease immediately
    const prompt = input.prompt || 'Manual approval required to proceed';
    const approvers = input.approvers || [];
    const requestedAt = new Date().toISOString();

    return {
      status: 'WAITING',
      waitingReason: 'APPROVAL_REQUIRED',
      output: {
        prompt,
        approvers,
        requestedAt,
      },
    };
  }
}
