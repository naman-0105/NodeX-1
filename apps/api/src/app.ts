import express, { type Express } from 'express';
import cors from 'cors';
import { workflowRouter } from './routes/workflows.js';
import { executionRouter } from './routes/executions.js';
import { webhookRouter } from './routes/webhooks.js';
import { errorHandler } from './middleware/error-handler.js';
import { checkHealth } from '@nodex/db';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const isDbHealthy = await checkHealth();
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      database: isDbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/workflows', workflowRouter);
  app.use('/api/executions', executionRouter);
  app.use('/api/webhooks', webhookRouter);

  // Centralized Error Handler (must be last middleware)
  app.use(errorHandler);

  return app;
}
