import { Router, type Router as RouterType } from 'express';
import { handleIncomingWebhook } from '../controllers/webhooks.js';

export const webhookRouter: RouterType = Router();

webhookRouter.post('/:workflowId', handleIncomingWebhook);
