import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as workflowService from '../services/workflows.js';

export const createWorkflowSchema = z.object({
  ownerId: z.string().uuid().optional(),
  name: z.string().min(1, 'Workflow name is required'),
  definition: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        config: z.record(z.any()).default({}),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
      })
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
      })
    ),
  }),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const publishVersionSchema = z.object({
  definition: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
});

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

export async function createWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId =
      req.user?.id || req.body.ownerId || '00000000-0000-0000-0000-000000000001';
    const result = await workflowService.createWorkflow(
      ownerId,
      req.body.name,
      req.body.definition
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const result = await workflowService.getWorkflow(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listWorkflowsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const queryOwnerId = req.query.ownerId as string | undefined;
    const ownerId = queryOwnerId || req.user?.id;
    const list = await workflowService.listWorkflows(ownerId);
    res.json({ workflows: list });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const result = await workflowService.updateWorkflow(id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function publishVersionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const result = await workflowService.publishNewVersion(
      id,
      req.body.definition
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listVersionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const versions = await workflowService.listWorkflowVersions(id);
    res.json({ versions });
  } catch (err) {
    next(err);
  }
}

export async function getVersionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const versionId = getParam(req, 'versionId');
    const version = await workflowService.getWorkflowVersion(id, versionId);
    res.json(version);
  } catch (err) {
    next(err);
  }
}
