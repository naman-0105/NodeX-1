import { Queue } from 'bullmq';
import { getRedisConnection } from './connection.js';

export const EXECUTION_QUEUE_NAME = 'nodex-executions';

export interface ExecutionJobData {
  readonly executionId: string;
  readonly workflowId?: string;
  readonly triggerType?: string;
}

let executionQueueInstance: Queue<ExecutionJobData> | null = null;

export function getExecutionQueue(): Queue<ExecutionJobData> {
  if (!executionQueueInstance) {
    executionQueueInstance = new Queue<ExecutionJobData>(EXECUTION_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1, // Retries are handled durably in PostgreSQL state machine
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return executionQueueInstance;
}

export async function closeExecutionQueue(): Promise<void> {
  if (executionQueueInstance) {
    await executionQueueInstance.close();
    executionQueueInstance = null;
  }
}

export async function enqueueExecutionJob(data: ExecutionJobData): Promise<string> {
  const queue = getExecutionQueue();
  const job = await queue.add(`exec_${data.executionId}`, data, {
    jobId: `exec_${data.executionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  });
  return job.id ?? data.executionId;
}
