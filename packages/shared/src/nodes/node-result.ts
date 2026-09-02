export interface NodeErrorDetails {
  readonly message: string;
  readonly code?: string;
  readonly retriable?: boolean;
  readonly stack?: string;
  readonly details?: unknown;
}

export interface NodeResult<TOutput = unknown> {
  readonly status: 'SUCCEEDED' | 'FAILED' | 'WAITING';
  readonly output?: TOutput;
  readonly error?: NodeErrorDetails;
  readonly waitingReason?: string;
  readonly idempotencyKey?: string;
}
