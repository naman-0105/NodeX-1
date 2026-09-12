import { Worker, type Job } from 'bullmq';
import {
  db,
  executions,
  workflows,
  workflowVersions,
  taskInstances,
  executionEvents,
  credentials,
  decrypt,
  eq,
  inArray,
  sql,
  desc,
} from '@nodex/db';
import { TaskStatus, type WorkflowDefinition, type NodeResult, type ExecutionContext } from '@nodex/shared';
import { EXECUTION_QUEUE_NAME, type ExecutionJobData } from './queues.js';
import { getRedisConnection } from './connection.js';
import { buildExecutionGraph } from '../engine/dag.js';
import { resolveTemplate } from '../engine/evaluator.js';
import { defaultNodeRegistry, NodeRegistry } from '../nodes/registry.js';
import { acquireTaskLease, releaseTaskLease } from '../reliability/lease.js';
import { HeartbeatManager } from '../reliability/heartbeat.js';
import { checkIdempotency, recordIdempotency } from '../reliability/idempotency.js';
import { shouldRetryTask } from '../reliability/retry.js';
import { moveToDeadLetter } from '../reliability/dlq.js';

export interface WorkflowWorkerOptions {
  readonly workerId?: string;
  readonly concurrency?: number;
  readonly registry?: NodeRegistry;
}

/**
 * Durable execution processor for a single workflow execution.
 */
export async function processWorkflowExecution(
  executionId: string,
  workerId: string,
  registry: NodeRegistry = defaultNodeRegistry
): Promise<void> {
  // 1. Fetch execution pinned to its immutable workflow version
  const [execRow] = await db
    .select({
      id: executions.id,
      workflowId: executions.workflowId,
      ownerId: workflows.ownerId,
      workflowVersionId: executions.workflowVersionId,
      triggerType: executions.triggerType,
      status: executions.status,
      definitionJson: workflowVersions.definitionJson,
    })
    .from(executions)
    .innerJoin(
      workflows,
      eq(executions.workflowId, workflows.id)
    )
    .innerJoin(
      workflowVersions,
      eq(executions.workflowVersionId, workflowVersions.id)
    )
    .where(eq(executions.id, executionId))
    .limit(1);

  if (!execRow) {
    console.error(`Execution not found: ${executionId}`);
    return;
  }

  // If already in a terminal state, ignore
  if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(execRow.status)) {
    return;
  }

  // 2. Mark execution as RUNNING
  await db
    .update(executions)
    .set({
      status: 'RUNNING',
      startedAt: sql`COALESCE(started_at, NOW())`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(executions.id, executionId));

  const definition = execRow.definitionJson as WorkflowDefinition;
  const graph = buildExecutionGraph(definition);

  // 3. Load existing task instances from DB to support resumption / checkpoints
  const existingTasks = await db
    .select()
    .from(taskInstances)
    .where(eq(taskInstances.executionId, executionId));

  const taskMap = new Map<string, any>(existingTasks.map((t) => [t.nodeId, t]));
  const stepOutputs: Record<string, unknown> = {};
  const skippedNodes = new Set<string>();

  for (const t of existingTasks) {
    if (t.status === 'SUCCEEDED' && t.outputJson !== null) {
      stepOutputs[t.nodeId] = t.outputJson;
    } else if (t.status === 'SKIPPED') {
      skippedNodes.add(t.nodeId);
    }
  }

  // Helper for atomic sequence counter in execution_events
  const appendEvent = async (eventType: string, payloadJson: unknown) => {
    try {
      await db.execute(sql`
        INSERT INTO execution_events (id, execution_id, sequence, event_type, payload_json, created_at)
        VALUES (
          gen_random_uuid(),
          ${executionId}::uuid,
          COALESCE((SELECT MAX(sequence) FROM execution_events WHERE execution_id = ${executionId}::uuid), 0) + 1,
          ${eventType},
          ${JSON.stringify(payloadJson)}::jsonb,
          NOW()
        )
      `);
    } catch {
      // Ignore non-fatal audit log collision
    }
  };

  const isResuming = execRow.status === 'WAITING' || existingTasks.length > 0;
  await appendEvent(isResuming ? 'execution.resumed' : 'execution.started', {
    executionId,
    workflowId: execRow.workflowId,
    workflowVersionId: execRow.workflowVersionId,
  });

  // 4. Traverse DAG in topological order
  for (const nodeId of graph.executionOrder) {
    const nodeDef = graph.nodes.get(nodeId)!;

    // Check if already succeeded
    if (taskMap.get(nodeId)?.status === TaskStatus.SUCCEEDED) {
      continue;
    }

    // Check if skipped
    if (skippedNodes.has(nodeId)) {
      if (!taskMap.has(nodeId)) {
        const [skippedTask] = await db
          .insert(taskInstances)
          .values({
            executionId,
            nodeId,
            status: TaskStatus.SKIPPED,
          })
          .returning();
        taskMap.set(nodeId, skippedTask);
      }
      // Propagate skip to downstream
      const outEdges = graph.outgoingEdges.get(nodeId) || [];
      for (const edge of outEdges) {
        skippedNodes.add(edge.target);
      }
      continue;
    }

    // Check incoming dependencies
    const inEdges = graph.incomingEdges.get(nodeId) || [];
    let shouldSkip = false;
    for (const inEdge of inEdges) {
      const parentTask = taskMap.get(inEdge.source);
      if (!parentTask || parentTask.status !== TaskStatus.SUCCEEDED) {
        shouldSkip = true;
        break;
      }
    }

    if (shouldSkip) {
      skippedNodes.add(nodeId);
      continue;
    }

    // 5. Ensure task instance exists in DB
    let currentTask = taskMap.get(nodeId);
    if (!currentTask) {
      const [newTask] = await db
        .insert(taskInstances)
        .values({
          executionId,
          nodeId,
          status: TaskStatus.PENDING,
          attempt: 1,
        })
        .returning();
      currentTask = newTask;
      taskMap.set(nodeId, currentTask);
    } else {
      // Increment attempt for retry
      const [updated] = await db
        .update(taskInstances)
        .set({ attempt: currentTask.attempt + 1 })
        .where(eq(taskInstances.id, currentTask.id))
        .returning();
      currentTask = updated;
      taskMap.set(nodeId, currentTask);
    }

    // 6. Acquire lease
    const leaseAcquired = await acquireTaskLease(currentTask.id, workerId, { durationSeconds: 30 });
    if (!leaseAcquired) {
      console.warn(`Could not acquire lease for task ${currentTask.id}. Already owned by another worker.`);
      return;
    }

    // Start heartbeat
    const heartbeat = new HeartbeatManager({
      taskInstanceId: currentTask.id,
      workerId,
      leaseTtlSeconds: 30,
    });
    heartbeat.start();

    // 7. Resolve expressions and execute
    const evaluationContext = {
      steps: Object.fromEntries(
        Object.entries(stepOutputs).map(([id, out]) => [id, { output: out }])
      ),
      trigger: {},
      env: {},
    };

    let resolvedConfig: Record<string, unknown>;
    try {
      resolvedConfig = resolveTemplate(nodeDef.config, evaluationContext) as Record<string, unknown>;
    } catch (err: any) {
      heartbeat.stop();
      await releaseTaskLease(currentTask.id, workerId, TaskStatus.FAILED, {
        error: { message: err.message, code: 'CONFIG_TEMPLATE_ERROR' },
      });
      taskMap.set(nodeId, { ...currentTask, status: TaskStatus.FAILED });
      await db
        .update(executions)
        .set({ status: 'FAILED', finishedAt: sql`NOW()` })
        .where(eq(executions.id, executionId));
      return;
    }

    // Check Idempotency if operation ID present
    const logicalOpId = resolvedConfig.logicalOperationId as string | undefined;
    if (logicalOpId) {
      const idempCheck = await checkIdempotency(executionId, nodeId, logicalOpId);
      if (idempCheck.alreadyExecuted) {
        heartbeat.stop();
        await releaseTaskLease(currentTask.id, workerId, TaskStatus.SUCCEEDED, {
          output: idempCheck.resultSnapshot,
        });
        taskMap.set(nodeId, { ...currentTask, status: TaskStatus.SUCCEEDED, outputJson: idempCheck.resultSnapshot });
        stepOutputs[nodeId] = idempCheck.resultSnapshot;
        continue;
      }
    }

    // Load decrypted credentials for workflow owner (and fallback to default dev user)
    const ownerCredentials: Record<string, any> = {};
    const ownerIdsToTry = [
      execRow.ownerId,
      '00000000-0000-0000-0000-000000000001',
    ].filter(Boolean) as string[];

    if (ownerIdsToTry.length > 0) {
      try {
        const credRows = await db
          .select()
          .from(credentials)
          .where(inArray(credentials.ownerId, ownerIdsToTry));

        // Sort so the workflow owner's credentials take precedence over default dev user
        credRows.sort((a, b) => (a.ownerId === execRow.ownerId ? 1 : -1));

        for (const cred of credRows) {
          try {
            const decryptedStr = decrypt(cred.encryptedData);
            let parsedData: any;
            try {
              parsedData = JSON.parse(decryptedStr);
            } catch {
              parsedData = { accessToken: decryptedStr };
            }
            ownerCredentials[cred.provider] = parsedData;
          } catch (err) {
            console.warn(`Failed to decrypt credential for provider ${cred.provider}:`, err);
          }
        }
      } catch (err) {
        console.warn('Failed to query credentials for execution owner:', err);
      }
    }

    const nodeExecutor = registry.get(nodeDef.type);
    const executionContext: ExecutionContext = {
      executionId,
      taskId: currentTask.id,
      nodeId,
      workflowId: execRow.workflowId,
      workflowVersionId: execRow.workflowVersionId,
      attempt: currentTask.attempt,
      stepOutputs,
      triggerPayload: {},
      credentials: ownerCredentials,
      env: process.env as Record<string, string>,
      heartbeat: async () => {},
    };

    let result: NodeResult;
    try {
      result = await nodeExecutor.execute(resolvedConfig, executionContext);
    } catch (err: any) {
      result = {
        status: 'FAILED',
        error: { message: err.message || 'Execution error', retriable: true },
      };
    }

    heartbeat.stop();

    if (result.status === 'SUCCEEDED') {
      await releaseTaskLease(currentTask.id, workerId, TaskStatus.SUCCEEDED, { output: result.output });
      taskMap.set(nodeId, { ...currentTask, status: TaskStatus.SUCCEEDED, outputJson: result.output });
      stepOutputs[nodeId] = result.output;

      if (logicalOpId) {
        await recordIdempotency(executionId, nodeId, logicalOpId, result.output);
      }

      await appendEvent('task.succeeded', { nodeId, output: result.output });

      // Handle IF branch pruning
      if (nodeDef.type === 'if' && result.output && typeof result.output === 'object') {
        const branchOutput = result.output as { branch?: 'true' | 'false' };
        const chosenBranch = branchOutput.branch;
        const outEdges = graph.outgoingEdges.get(nodeId) || [];
        for (const outEdge of outEdges) {
          if (outEdge.sourceHandle && outEdge.sourceHandle !== chosenBranch) {
            skippedNodes.add(outEdge.target);
          }
        }
      }
    } else if (result.status === 'WAITING') {
      // Release worker lease immediately for human-in-the-loop / delay waiting
      await releaseTaskLease(currentTask.id, workerId, TaskStatus.WAITING, {
        output: { waitingReason: result.waitingReason },
      });
      taskMap.set(nodeId, { ...currentTask, status: TaskStatus.WAITING });
      await db
        .update(executions)
        .set({ status: 'WAITING', updatedAt: sql`NOW()` })
        .where(eq(executions.id, executionId));
      await appendEvent('execution.waiting', { nodeId, reason: result.waitingReason });
      return; // Free worker!
    } else if (result.status === 'FAILED') {
      const canRetry = shouldRetryTask(currentTask.attempt, result.error);

      if (canRetry) {
        await releaseTaskLease(currentTask.id, workerId, TaskStatus.RETRYING, { error: result.error });
        taskMap.set(nodeId, { ...currentTask, status: TaskStatus.RETRYING });
        await appendEvent('task.retrying', { nodeId, attempt: currentTask.attempt });
        // Future queue worker retry can re-enqueue
      } else {
        await releaseTaskLease(currentTask.id, workerId, TaskStatus.FAILED, { error: result.error });
        taskMap.set(nodeId, { ...currentTask, status: TaskStatus.FAILED });
        await moveToDeadLetter(currentTask.id, executionId, result.error);
        await appendEvent('task.failed', { nodeId, error: result.error });

        await db
          .update(executions)
          .set({ status: 'FAILED', finishedAt: sql`NOW()` })
          .where(eq(executions.id, executionId));
        return;
      }
    }
  }

  // 8. All nodes completed successfully
  await db
    .update(executions)
    .set({
      status: 'COMPLETED',
      finishedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(executions.id, executionId));

  await appendEvent('execution.completed', { executionId });
}

export class WorkflowWorkerService {
  private worker: Worker<ExecutionJobData> | null = null;
  private readonly workerId: string;

  constructor(private readonly options: WorkflowWorkerOptions = {}) {
    this.workerId = options.workerId || `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
  }

  start(): void {
    if (this.worker) return;

    this.worker = new Worker<ExecutionJobData>(
      EXECUTION_QUEUE_NAME,
      async (job: Job<ExecutionJobData>) => {
        await processWorkflowExecution(
          job.data.executionId,
          this.workerId,
          this.options.registry
        );
      },
      {
        connection: getRedisConnection(),
        concurrency: this.options.concurrency || 5,
      }
    );

    this.worker.on('error', (err) => {
      console.error('BullMQ Worker error:', err);
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
