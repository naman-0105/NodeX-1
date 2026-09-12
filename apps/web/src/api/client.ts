import type { WorkflowDefinition, ExecutionStatus, TaskStatus } from '@nodex/shared';

const API_BASE = '/api';
const TOKEN_KEY = 'nodex_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  authProvider: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserSummary;
  token: string;
}

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

// --- Authentication APIs ---

export async function registerUser(data: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Registration failed');
  }
  const result = (await res.json()) as AuthResponse;
  setAuthToken(result.token);
  return result;
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Login failed');
  }
  const result = (await res.json()) as AuthResponse;
  setAuthToken(result.token);
  return result;
}

export async function fetchCurrentUser(): Promise<UserSummary> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) {
    clearAuthToken();
    throw new Error('Failed to fetch user profile');
  }
  const data = await res.json();
  return data.user;
}

export async function fetchGoogleAuthUrl(redirectUri?: string): Promise<{ url: string; configured: boolean }> {
  const query = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const res = await fetch(`${API_BASE}/auth/google/url${query}`);
  if (!res.ok) throw new Error('Failed to fetch Google OAuth URL');
  return res.json();
}

export async function handleGoogleCallback(code: string, redirectUri?: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Google authentication failed');
  }
  const result = (await res.json()) as AuthResponse;
  setAuthToken(result.token);
  return result;
}

// --- Workflow APIs ---

export async function fetchWorkflows(): Promise<WorkflowSummary[]> {
  const res = await authFetch(`${API_BASE}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows;
}

export async function fetchWorkflow(id: string): Promise<WorkflowDetails> {
  const res = await authFetch(`${API_BASE}/workflows/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch workflow ${id}`);
  return res.json();
}

export async function createWorkflow(
  name: string,
  definition: WorkflowDefinition
): Promise<WorkflowDetails> {
  const res = await authFetch(`${API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, definition }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to create workflow');
  }
  return res.json();
}

export async function updateWorkflow(
  id: string,
  updates: { name?: string; active?: boolean }
): Promise<WorkflowSummary> {
  const res = await authFetch(`${API_BASE}/workflows/${id}`, {
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
  const res = await authFetch(`${API_BASE}/workflows/${id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to publish version');
  }
  return res.json();
}

export async function triggerWorkflow(
  id: string,
  triggerType: string = 'manual',
  payload: Record<string, unknown> = {}
): Promise<{ executionId: string; status: ExecutionStatus }> {
  const res = await authFetch(`${API_BASE}/workflows/${id}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggerType, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to trigger workflow');
  }
  return res.json();
}

export async function fetchExecution(id: string): Promise<ExecutionDetails> {
  const res = await authFetch(`${API_BASE}/executions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch execution ${id}`);
  return res.json();
}

export async function fetchWorkflowExecutions(
  workflowId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ executions: Array<{ id: string; workflowId: string; workflowVersionId: string; triggerType: string; status: ExecutionStatus; startedAt?: string; finishedAt?: string; createdAt: string }> }> {
  const res = await authFetch(`${API_BASE}/workflows/${workflowId}/executions?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to fetch executions for workflow ${workflowId}`);
  return res.json();
}

export async function cancelExecution(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/executions/${id}/cancel`, {
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
  const res = await authFetch(`${API_BASE}/executions/${executionId}/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, comments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to approve task');
  }
}

export async function rejectTask(
  executionId: string,
  taskId: string,
  approver?: string,
  comments?: string
): Promise<void> {
  const res = await authFetch(`${API_BASE}/executions/${executionId}/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, comments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to reject task');
  }
}

export interface SlackChannelOption {
  readonly id: string;
  readonly name: string;
  readonly isPrivate?: boolean;
}

export interface IntegrationStatus {
  readonly slack: {
    readonly connected: boolean;
    readonly teamName?: string;
    readonly updatedAt?: string;
  };
}

export async function fetchSlackChannels(): Promise<SlackChannelOption[]> {
  const res = await authFetch(`${API_BASE}/integrations/slack/channels`);
  if (!res.ok) {
    throw new Error('Failed to fetch Slack channels');
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return data;
  }
  return data.channels || [];
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const res = await authFetch(`${API_BASE}/integrations/status`);
  if (!res.ok) {
    throw new Error('Failed to fetch integration status');
  }
  return res.json();
}

export async function saveSlackToken(token: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/integrations/slack/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to save Slack token');
  }
}

export async function disconnectIntegration(provider: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/integrations/${provider}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to disconnect ${provider}`);
  }
}
