export enum TaskStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  RETRYING = 'RETRYING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export const TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  TaskStatus.SUCCEEDED,
  TaskStatus.FAILED,
  TaskStatus.SKIPPED,
  TaskStatus.CANCELLED,
]);

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status);
}

const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  [TaskStatus.PENDING]: new Set([
    TaskStatus.READY,
    TaskStatus.SKIPPED,
    TaskStatus.CANCELLED,
    TaskStatus.FAILED,
  ]),
  [TaskStatus.READY]: new Set([
    TaskStatus.RUNNING,
    TaskStatus.SKIPPED,
    TaskStatus.CANCELLED,
    TaskStatus.FAILED,
  ]),
  [TaskStatus.RUNNING]: new Set([
    TaskStatus.WAITING,
    TaskStatus.RETRYING,
    TaskStatus.SUCCEEDED,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
  ]),
  [TaskStatus.WAITING]: new Set([
    TaskStatus.READY,
    TaskStatus.RUNNING,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
  ]),
  [TaskStatus.RETRYING]: new Set([
    TaskStatus.READY,
    TaskStatus.RUNNING,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
  ]),
  [TaskStatus.SUCCEEDED]: new Set(),
  [TaskStatus.FAILED]: new Set(),
  [TaskStatus.SKIPPED]: new Set(),
  [TaskStatus.CANCELLED]: new Set(),
};

export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TASK_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertValidTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!isValidTaskTransition(from, to)) {
    throw new Error(`Invalid task status transition from ${from} to ${to}`);
  }
}
