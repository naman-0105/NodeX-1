import type { WorkflowDefinition, ExecutionStatus, TaskStatus } from '@nodex/shared';

const API_BASE = '/api';

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  currentVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetails {
  workflow: WorkflowSummary;
  currentVersion: {
    id: string;
    version: number;
    definitionJson: WorkflowDefinition;
    createdAt: string;
  };
}

export interface TaskInstanceSummary {
  id: string;
  executionId: string;
  nodeId: string;
  status: TaskStatus;
  attempt: number;
  workerId?: string;
  outputJson?: unknown;
  errorJson?: unknown;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface ExecutionEventSummary {
  id: string;
  executionId: string;
  sequence: number;
  eventType: string;
  payloadJson?: unknown;
  createdAt: string;
}

export interface ExecutionDetails {
  execution: {
    id: string;
    workflowId: string;
    workflowVersionId: string;
    triggerType: string;
    status: ExecutionStatus;
    startedAt?: string;
    finishedAt?: string;
    createdAt: string;
  };
  tasks: TaskInstanceSummary[];
  events: ExecutionEventSummary[];
}

export async function fetchWorkflows(): Promise<WorkflowSummary[]> {
  const res = await fetch(`${API_BASE}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows;
}

export async function fetchWorkflow(id: string): Promise<WorkflowDetails> {
  const res = await fetch(`${API_BASE}/workflows/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch workflow ${id}`);
  return res.json();
}

export async function createWorkflow(
  name: string,
  definition: WorkflowDefinition
): Promise<WorkflowDetails> {
  const res = await fetch(`${API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, definition }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to create workflow');
  }
  return res.json();
}

export async function updateWorkflow(
  id: string,
  updates: { name?: string; active?: boolean }
): Promise<WorkflowSummary> {
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update workflow');
  return res.json();
}

export async function publishWorkflowVersion(
  id: string,
  definition: WorkflowDefinition
): Promise<WorkflowDetails> {
  const res = await fetch(`${API_BASE}/workflows/${id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to publish version');
  }
  return res.json();
}

export async function triggerWorkflow(
  id: string,
  triggerType: string = 'manual',
  payload: Record<string, unknown> = {}
): Promise<{ executionId: string; status: ExecutionStatus }> {
  const res = await fetch(`${API_BASE}/workflows/${id}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggerType, payload }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to trigger workflow');
  }
  return res.json();
}

export async function fetchExecution(id: string): Promise<ExecutionDetails> {
  const res = await fetch(`${API_BASE}/executions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch execution ${id}`);
  return res.json();
}

export async function cancelExecution(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/executions/${id}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to cancel execution');
}

export async function approveTask(
  executionId: string,
  taskId: string,
  approver?: string,
  comments?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/executions/${executionId}/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, comments }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to approve task');
  }
}

export async function rejectTask(
  executionId: string,
  taskId: string,
  approver?: string,
  comments?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/executions/${executionId}/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, comments }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to reject task');
  }
}
