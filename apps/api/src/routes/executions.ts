import { Router, type Router as RouterType } from 'express';
import {
  getExecutionHandler,
  cancelExecutionHandler,
  approveTaskHandler,
  rejectTaskHandler,
  getPendingApprovalsHandler,
  approvalDecisionSchema,
} from '../controllers/executions.js';
import { validateBody } from '../middleware/validate.js';

export const executionRouter: RouterType = Router();

// Execution queries and cancellation
executionRouter.get('/:id', getExecutionHandler);
executionRouter.post('/:id/cancel', cancelExecutionHandler);

// Approvals & Human-In-The-Loop
executionRouter.get('/:id/approvals', getPendingApprovalsHandler);
executionRouter.post(
  '/:id/tasks/:taskId/approve',
  validateBody(approvalDecisionSchema),
  approveTaskHandler
);
executionRouter.post(
  '/:id/tasks/:taskId/reject',
  validateBody(approvalDecisionSchema),
  rejectTaskHandler
);
