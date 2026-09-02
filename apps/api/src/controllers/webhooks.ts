import type { Request, Response, NextFunction } from 'express';
import * as webhookService from '../services/webhooks.js';

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

export async function handleIncomingWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workflowId = getParam(req, 'workflowId');

    // Extract external event ID from standard headers or request body/query
    const externalEventId =
      (req.headers['x-event-id'] as string) ||
      (req.headers['x-webhook-id'] as string) ||
      (req.headers['x-github-delivery'] as string) ||
      (req.query.eventId as string) ||
      (req.body && req.body.id ? String(req.body.id) : undefined) ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const result = await webhookService.processIncomingWebhook(
      workflowId,
      externalEventId,
      req.body
    );

    if (result.duplicate) {
      res.status(200).json(result);
    } else {
      res.status(202).json(result);
    }
  } catch (err) {
    next(err);
  }
}
