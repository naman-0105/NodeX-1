import express, { type Express } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { workflowRouter } from './routes/workflows.js';
import { executionRouter } from './routes/executions.js';
import { webhookRouter } from './routes/webhooks.js';
import { metricsRouter } from './routes/metrics.js';
import { integrationRouter } from './routes/integrations.js';
import { authenticateUser } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { checkHealth } from '@nodex/db';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const isDbHealthy = await checkHealth();
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      database: isDbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  // Global Auth Token Extraction
  app.use(authenticateUser);

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/workflows', workflowRouter);
  app.use('/api/executions', executionRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/integrations', integrationRouter);

  // Centralized Error Handler (must be last middleware)
  app.use(errorHandler);

  return app;
}
