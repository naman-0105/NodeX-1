export interface ExecutionLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface ExecutionContext {
  readonly executionId: string;
  readonly taskId: string;
  readonly nodeId: string;
  readonly workflowId: string;
  readonly workflowVersionId: string;
  readonly attempt: number;
  readonly stepOutputs: Readonly<Record<string, unknown>>;
  readonly triggerPayload?: Readonly<Record<string, unknown>>;
  readonly credentials?: Readonly<Record<string, unknown>>;
  readonly env?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly logger?: ExecutionLogger;
  heartbeat?(): Promise<void>;
}
