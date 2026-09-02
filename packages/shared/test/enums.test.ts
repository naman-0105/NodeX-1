import { describe, it, expect } from 'vitest';
import {
  ExecutionStatus,
  isValidExecutionTransition,
  assertValidExecutionTransition,
  isTerminalExecutionStatus,
} from '../src/enums/execution-status.js';
import {
  TaskStatus,
  isValidTaskTransition,
  assertValidTaskTransition,
  isTerminalTaskStatus,
} from '../src/enums/task-status.js';

describe('ExecutionStatus Transitions', () => {
  it('allows valid execution transitions', () => {
    expect(isValidExecutionTransition(ExecutionStatus.CREATED, ExecutionStatus.QUEUED)).toBe(true);
    expect(isValidExecutionTransition(ExecutionStatus.QUEUED, ExecutionStatus.RUNNING)).toBe(true);
    expect(isValidExecutionTransition(ExecutionStatus.RUNNING, ExecutionStatus.WAITING)).toBe(true);
    expect(isValidExecutionTransition(ExecutionStatus.WAITING, ExecutionStatus.RUNNING)).toBe(true);
    expect(isValidExecutionTransition(ExecutionStatus.RUNNING, ExecutionStatus.COMPLETED)).toBe(true);
  });

  it('rejects invalid execution transitions from terminal states', () => {
    expect(isValidExecutionTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING)).toBe(false);
    expect(isValidExecutionTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING)).toBe(false);
    expect(isValidExecutionTransition(ExecutionStatus.CANCELLED, ExecutionStatus.RUNNING)).toBe(false);
    expect(isValidExecutionTransition(ExecutionStatus.TIMED_OUT, ExecutionStatus.RUNNING)).toBe(false);
  });

  it('throws on assertValidExecutionTransition for invalid transition', () => {
    expect(() =>
      assertValidExecutionTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING)
    ).toThrow(/Invalid execution status transition/);
  });

  it('identifies terminal execution statuses', () => {
    expect(isTerminalExecutionStatus(ExecutionStatus.COMPLETED)).toBe(true);
    expect(isTerminalExecutionStatus(ExecutionStatus.FAILED)).toBe(true);
    expect(isTerminalExecutionStatus(ExecutionStatus.CANCELLED)).toBe(true);
    expect(isTerminalExecutionStatus(ExecutionStatus.TIMED_OUT)).toBe(true);
    expect(isTerminalExecutionStatus(ExecutionStatus.RUNNING)).toBe(false);
    expect(isTerminalExecutionStatus(ExecutionStatus.WAITING)).toBe(false);
  });
});

describe('TaskStatus Transitions', () => {
  it('allows valid task transitions', () => {
    expect(isValidTaskTransition(TaskStatus.PENDING, TaskStatus.READY)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.READY, TaskStatus.RUNNING)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.RUNNING, TaskStatus.WAITING)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.WAITING, TaskStatus.READY)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.RUNNING, TaskStatus.SUCCEEDED)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.RUNNING, TaskStatus.FAILED)).toBe(true);
  });

  it('rejects invalid task transitions from terminal states', () => {
    expect(isValidTaskTransition(TaskStatus.SUCCEEDED, TaskStatus.RUNNING)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.FAILED, TaskStatus.RUNNING)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.SKIPPED, TaskStatus.RUNNING)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.CANCELLED, TaskStatus.RUNNING)).toBe(false);
  });

  it('throws on assertValidTaskTransition for invalid transition', () => {
    expect(() =>
      assertValidTaskTransition(TaskStatus.SUCCEEDED, TaskStatus.RUNNING)
    ).toThrow(/Invalid task status transition/);
  });

  it('identifies terminal task statuses', () => {
    expect(isTerminalTaskStatus(TaskStatus.SUCCEEDED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.FAILED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.SKIPPED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.CANCELLED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.RUNNING)).toBe(false);
    expect(isTerminalTaskStatus(TaskStatus.WAITING)).toBe(false);
  });
});
