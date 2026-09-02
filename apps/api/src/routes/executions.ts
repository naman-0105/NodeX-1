import { Router, type Router as RouterType } from 'express';
import {
  getExecutionHandler,
  cancelExecutionHandler,
} from '../controllers/executions.js';

export const executionRouter: RouterType = Router();

executionRouter.get('/:id', getExecutionHandler);
executionRouter.post('/:id/cancel', cancelExecutionHandler);
