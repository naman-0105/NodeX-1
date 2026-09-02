import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as workflowRepo from '../repositories/workflow.js';
import * as executionRepo from '../repositories/execution.js';

export async function triggerExecution(
  workflowId: string,
  triggerType: string = 'manual',
  payload?: Record<string, unknown>
) {
  const workflow = await workflowRepo.getWorkflowById(workflowId);
  if (!workflow) {
    throw new NotFoundError(`Workflow not found: ${workflowId}`);
  }
  if (!workflow.active) {
    throw new ValidationError(`Cannot trigger inactive workflow: ${workflowId}`);
  }
  if (!workflow.currentVersionId) {
    throw new ValidationError(`Workflow has no published version to execute: ${workflowId}`);
  }

  const { execution } = await executionRepo.createExecutionWithOutbox(
    workflow.id,
    workflow.currentVersionId,
    triggerType,
    payload
  );

  return execution;
}

export async function getExecutionDetails(id: string) {
  const result = await executionRepo.getExecutionWithDetails(id);
  if (!result) {
    throw new NotFoundError(`Execution not found: ${id}`);
  }
  return result;
}

export async function listWorkflowExecutions(
  workflowId: string,
  limit: number = 50,
  offset: number = 0
) {
  const workflow = await workflowRepo.getWorkflowById(workflowId);
  if (!workflow) {
    throw new NotFoundError(`Workflow not found: ${workflowId}`);
  }
  return executionRepo.listExecutionsForWorkflow(workflowId, limit, offset);
}

export async function cancelExecution(id: string) {
  const execution = await executionRepo.getExecutionById(id);
  if (!execution) {
    throw new NotFoundError(`Execution not found: ${id}`);
  }
  const cancelled = await executionRepo.cancelExecution(id);
  if (!cancelled) {
    throw new ValidationError(`Execution ${id} cannot be cancelled in state ${execution.status}`);
  }
  return cancelled;
}

export async function submitTaskApproval(
  executionId: string,
  taskId: string,
  decision: { approved: boolean; approver?: string; comments?: string }
) {
  const execution = await executionRepo.getExecutionById(executionId);
  if (!execution) {
    throw new NotFoundError(`Execution not found: ${executionId}`);
  }

  try {
    return await executionRepo.submitApprovalDecision(executionId, taskId, decision);
  } catch (err: any) {
    throw new ValidationError(err.message);
  }
}

export async function getPendingApprovals(executionId?: string) {
  if (executionId) {
    const execution = await executionRepo.getExecutionById(executionId);
    if (!execution) {
      throw new NotFoundError(`Execution not found: ${executionId}`);
    }
  }
  return executionRepo.getPendingApprovals(executionId);
}
