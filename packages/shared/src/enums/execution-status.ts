export enum ExecutionStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  RETRYING = 'RETRYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}

export const TERMINAL_EXECUTION_STATUSES = new Set<ExecutionStatus>([
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED,
  ExecutionStatus.TIMED_OUT,
]);

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return TERMINAL_EXECUTION_STATUSES.has(status);
}

const ALLOWED_EXECUTION_TRANSITIONS: Record<ExecutionStatus, ReadonlySet<ExecutionStatus>> = {
  [ExecutionStatus.CREATED]: new Set([
    ExecutionStatus.QUEUED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
  ]),
  [ExecutionStatus.QUEUED]: new Set([
    ExecutionStatus.RUNNING,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.TIMED_OUT,
    ExecutionStatus.FAILED,
  ]),
  [ExecutionStatus.RUNNING]: new Set([
    ExecutionStatus.WAITING,
    ExecutionStatus.RETRYING,
    ExecutionStatus.COMPLETED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.TIMED_OUT,
  ]),
  [ExecutionStatus.WAITING]: new Set([
    ExecutionStatus.RUNNING,
    ExecutionStatus.QUEUED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.TIMED_OUT,
  ]),
  [ExecutionStatus.RETRYING]: new Set([
    ExecutionStatus.RUNNING,
    ExecutionStatus.QUEUED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.TIMED_OUT,
  ]),
  [ExecutionStatus.COMPLETED]: new Set(),
  [ExecutionStatus.FAILED]: new Set(),
  [ExecutionStatus.CANCELLED]: new Set(),
  [ExecutionStatus.TIMED_OUT]: new Set(),
};

export function isValidExecutionTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  if (from === to) return true;
  return ALLOWED_EXECUTION_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertValidExecutionTransition(from: ExecutionStatus, to: ExecutionStatus): void {
  if (!isValidExecutionTransition(from, to)) {
    throw new Error(`Invalid execution status transition from ${from} to ${to}`);
  }
}
