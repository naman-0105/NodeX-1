import type { WorkflowDefinition } from '@nodex/shared';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as workflowRepo from '../repositories/workflow.js';

export async function createWorkflow(
  ownerId: string,
  name: string,
  definition: WorkflowDefinition
) {
  if (!name || !name.trim()) {
    throw new ValidationError('Workflow name is required');
  }
  if (!definition || !definition.nodes || definition.nodes.length === 0) {
    throw new ValidationError('Workflow must contain at least one node');
  }

  return workflowRepo.createWorkflowWithInitialVersion(ownerId, name.trim(), definition);
}

export async function getWorkflow(id: string) {
  const result = await workflowRepo.getWorkflowWithVersion(id);
  if (!result || !result.workflow) {
    throw new NotFoundError(`Workflow not found: ${id}`);
  }
  return result;
}

export async function listWorkflows(ownerId?: string) {
  return workflowRepo.listWorkflows(ownerId);
}

export async function updateWorkflow(
  id: string,
  updates: { name?: string; active?: boolean }
) {
  const existing = await workflowRepo.getWorkflowById(id);
  if (!existing) {
    throw new NotFoundError(`Workflow not found: ${id}`);
  }
  return workflowRepo.updateWorkflowMetadata(id, updates);
}

export async function publishNewVersion(
  workflowId: string,
  definition: WorkflowDefinition
) {
  const existing = await workflowRepo.getWorkflowById(workflowId);
  if (!existing) {
    throw new NotFoundError(`Workflow not found: ${workflowId}`);
  }
  if (!definition || !definition.nodes || definition.nodes.length === 0) {
    throw new ValidationError('Workflow version must contain at least one node');
  }

  return workflowRepo.createWorkflowVersion(workflowId, definition);
}

export async function listWorkflowVersions(workflowId: string) {
  const existing = await workflowRepo.getWorkflowById(workflowId);
  if (!existing) {
    throw new NotFoundError(`Workflow not found: ${workflowId}`);
  }
  return workflowRepo.listWorkflowVersions(workflowId);
}

export async function getWorkflowVersion(workflowId: string, versionId: string) {
  const version = await workflowRepo.getWorkflowVersion(workflowId, versionId);
  if (!version) {
    throw new NotFoundError(`Workflow version not found: ${versionId}`);
  }
  return version;
}
