import { Router, type Router as RouterType } from 'express';
import {
  slackAuthorizeHandler,
  slackCallbackHandler,
  getSlackChannelsHandler,
  saveSlackTokenHandler,
  getIntegrationStatusHandler,
  disconnectIntegrationHandler,
  saveTokenSchema,
} from '../controllers/integrations.js';
import { validateBody } from '../middleware/validate.js';

export const integrationRouter: RouterType = Router();

// Slack OAuth2 and Credentials
integrationRouter.get('/slack/authorize', slackAuthorizeHandler);
integrationRouter.get('/slack/callback', slackCallbackHandler);
integrationRouter.get('/slack/channels', getSlackChannelsHandler);
integrationRouter.post('/slack/token', validateBody(saveTokenSchema), saveSlackTokenHandler);

// Integration Status & Management
integrationRouter.get('/status', getIntegrationStatusHandler);
integrationRouter.delete('/:provider', disconnectIntegrationHandler);
