import crypto from 'node:crypto';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as workflowRepo from '../repositories/workflow.js';
import * as webhookRepo from '../repositories/webhook.js';

export function computePayloadHash(payload: unknown): string {
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

export async function processIncomingWebhook(
  workflowId: string,
  externalEventId: string,
  payload: unknown
) {
  if (!externalEventId || !externalEventId.trim()) {
    throw new ValidationError('Webhook externalEventId header/parameter is required');
  }

  // 1. Check for duplicate webhook delivery
  const existing = await webhookRepo.findWebhookEvent(workflowId, externalEventId);
  if (existing) {
    return {
      duplicate: true,
      executionId: existing.executionId,
      message: 'Duplicate webhook event already processed',
    };
  }

  // 2. Validate workflow
  const workflow = await workflowRepo.getWorkflowById(workflowId);
  if (!workflow) {
    throw new NotFoundError(`Workflow not found: ${workflowId}`);
  }
  if (!workflow.active) {
    throw new ValidationError(`Cannot accept webhooks for inactive workflow: ${workflowId}`);
  }
  if (!workflow.currentVersionId) {
    throw new ValidationError(`Workflow has no published version: ${workflowId}`);
  }

  const payloadHash = computePayloadHash(payload);

  // 3. Atomically record webhook event + execution + outbox event
  const result = await webhookRepo.recordWebhookAndCreateExecution(
    workflow.id,
    externalEventId,
    payloadHash,
    workflow.currentVersionId,
    payload
  );

  return {
    duplicate: false,
    executionId: result.executionId,
    message: 'Webhook received and execution queued',
  };
}
