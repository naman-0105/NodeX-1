import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as executionService from '../services/executions.js';

export const triggerExecutionSchema = z.object({
  triggerType: z.enum(['manual', 'webhook', 'schedule']).default('manual'),
  payload: z.record(z.any()).optional(),
});

export const listExecutionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const approvalDecisionSchema = z.object({
  approver: z.string().optional(),
  comments: z.string().optional(),
});

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

export async function triggerExecutionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workflowId = getParam(req, 'workflowId') || getParam(req, 'id');
    const triggerType = req.body.triggerType || 'manual';
    const payload = req.body.payload || {};

    const execution = await executionService.triggerExecution(
      workflowId,
      triggerType,
      payload
    );

    res.status(202).json({
      executionId: execution.id,
      status: execution.status,
      workflowId: execution.workflowId,
      workflowVersionId: execution.workflowVersionId,
      createdAt: execution.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function getExecutionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const details = await executionService.getExecutionDetails(id);
    res.json(details);
  } catch (err) {
    next(err);
  }
}

export async function listWorkflowExecutionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workflowId = getParam(req, 'workflowId') || getParam(req, 'id');
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const list = await executionService.listWorkflowExecutions(
      workflowId,
      limit,
      offset
    );

    res.json({ executions: list });
  } catch (err) {
    next(err);
  }
}

export async function cancelExecutionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const cancelled = await executionService.cancelExecution(id);
    res.json({
      executionId: cancelled.id,
      status: cancelled.status,
      finishedAt: cancelled.finishedAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const executionId = getParam(req, 'id');
    const taskId = getParam(req, 'taskId');
    const approver = req.body.approver || 'system_user';
    const comments = req.body.comments;

    const result = await executionService.submitTaskApproval(executionId, taskId, {
      approved: true,
      approver,
      comments,
    });

    res.json({
      success: true,
      message: 'Task approved and workflow resumed',
      executionId: result.execution.id,
      executionStatus: result.execution.status,
      taskId: result.task.id,
      taskStatus: result.task.status,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectTaskHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const executionId = getParam(req, 'id');
    const taskId = getParam(req, 'taskId');
    const approver = req.body.approver || 'system_user';
    const comments = req.body.comments;

    const result = await executionService.submitTaskApproval(executionId, taskId, {
      approved: false,
      approver,
      comments,
    });

    res.json({
      success: true,
      message: 'Task rejected and workflow marked failed',
      executionId: result.execution.id,
      executionStatus: result.execution.status,
      taskId: result.task.id,
      taskStatus: result.task.status,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPendingApprovalsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const executionId = req.params.id ? getParam(req, 'id') : undefined;
    const approvals = await executionService.getPendingApprovals(executionId);
    res.json({ pendingApprovals: approvals });
  } catch (err) {
    next(err);
  }
}
