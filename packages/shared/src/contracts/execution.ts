import type { ExecutionStatus } from '../enums/execution-status.js';
import type { TaskStatus } from '../enums/task-status.js';

export interface TriggerExecutionRequest {
  readonly triggerType: 'manual' | 'webhook' | 'schedule';
  readonly payload?: Record<string, unknown>;
}

export interface TaskInstanceResponse {
  readonly id: string;
  readonly executionId: string;
  readonly nodeId: string;
  readonly status: TaskStatus;
  readonly attempt: number;
  readonly inputJson?: unknown;
  readonly outputJson?: unknown;
  readonly errorJson?: unknown;
  readonly workerId?: string | null;
  readonly leaseUntil?: string | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExecutionEventResponse {
  readonly id: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly payloadJson: unknown;
  readonly createdAt: string;
}

export interface ExecutionResponse {
  readonly id: string;
  readonly workflowId: string;
  readonly workflowVersionId: string;
  readonly triggerType: string;
  readonly status: ExecutionStatus;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tasks?: readonly TaskInstanceResponse[];
  readonly events?: readonly ExecutionEventResponse[];
}
