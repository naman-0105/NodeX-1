export * from './engine/dag.js';
export * from './engine/evaluator.js';
export * from './engine/sandbox.js';
export * from './engine/executor.js';
export * from './nodes/registry.js';
export * from './nodes/trigger.js';
export * from './nodes/http.js';
export * from './nodes/transform.js';
export * from './nodes/if.js';
export * from './nodes/approval.js';
export * from './nodes/delay.js';
export * from './reliability/lease.js';
export * from './reliability/heartbeat.js';
export * from './reliability/retry.js';
export * from './reliability/idempotency.js';
export * from './reliability/dlq.js';
export * from './outbox/poller.js';
export * from './queue/connection.js';
export * from './queue/queues.js';
export * from './queue/worker.js';

import dotenv from 'dotenv';
import { WorkflowWorkerService } from './queue/worker.js';
import { OutboxPollerService } from './outbox/poller.js';

dotenv.config();

// If run directly as worker process entrypoint
if (process.env.NODE_ENV !== 'test') {
  const workerService = new WorkflowWorkerService();
  const outboxPoller = new OutboxPollerService();

  console.log('🚀 Starting NodeX Workflow Worker & Outbox Poller...');
  workerService.start();
  outboxPoller.start();

  const handleShutdown = async () => {
    console.log('🛑 Shutting down worker...');
    outboxPoller.stop();
    await workerService.stop();
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

