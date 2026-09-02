import { Router, type Router as RouterType } from 'express';
import {
  createWorkflowHandler,
  getWorkflowHandler,
  listWorkflowsHandler,
  updateWorkflowHandler,
  publishVersionHandler,
  listVersionsHandler,
  getVersionHandler,
  createWorkflowSchema,
  updateWorkflowSchema,
  publishVersionSchema,
} from '../controllers/workflows.js';
import {
  triggerExecutionHandler,
  listWorkflowExecutionsHandler,
  triggerExecutionSchema,
} from '../controllers/executions.js';
import { validateBody } from '../middleware/validate.js';

export const workflowRouter: RouterType = Router();

// Workflow CRUD
workflowRouter.post('/', validateBody(createWorkflowSchema), createWorkflowHandler);
workflowRouter.get('/', listWorkflowsHandler);
workflowRouter.get('/:id', getWorkflowHandler);
workflowRouter.put('/:id', validateBody(updateWorkflowSchema), updateWorkflowHandler);

// Workflow Versioning
workflowRouter.post('/:id/versions', validateBody(publishVersionSchema), publishVersionHandler);
workflowRouter.get('/:id/versions', listVersionsHandler);
workflowRouter.get('/:id/versions/:versionId', getVersionHandler);

// Workflow Execution Triggers
workflowRouter.post('/:id/trigger', validateBody(triggerExecutionSchema), triggerExecutionHandler);
workflowRouter.get('/:id/executions', listWorkflowExecutionsHandler);
