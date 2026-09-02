import type {
  WorkflowDefinition,
  NodeResult,
  ExecutionContext,
} from '@nodex/shared';
import { buildExecutionGraph, type ExecutionGraph } from './dag.js';
import { resolveTemplate } from './evaluator.js';
import { NodeRegistry, defaultNodeRegistry } from '../nodes/registry.js';

export interface WorkflowExecutionOptions {
  readonly executionId?: string;
  readonly workflowId?: string;
  readonly workflowVersionId?: string;
  readonly triggerPayload?: Record<string, unknown>;
  readonly env?: Record<string, string>;
  readonly credentials?: Record<string, unknown>;
  readonly registry?: NodeRegistry;
  readonly signal?: AbortSignal;
}

export interface NodeExecutionRecord {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'WAITING';
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: unknown;
  readonly durationMs: number;
}

export interface WorkflowExecutionResult {
  readonly status: 'COMPLETED' | 'FAILED' | 'WAITING';
  readonly stepOutputs: Readonly<Record<string, unknown>>;
  readonly stepResults: Readonly<Record<string, NodeExecutionRecord>>;
  readonly totalDurationMs: number;
  readonly error?: {
    readonly nodeId?: string;
    readonly message: string;
    readonly code?: string;
  };
}

/**
 * Deterministic in-memory workflow execution runner.
 */
export async function executeWorkflow(
  definition: WorkflowDefinition,
  options: WorkflowExecutionOptions = {}
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const graph: ExecutionGraph = buildExecutionGraph(definition);
  const registry = options.registry || defaultNodeRegistry;

  const executionId = options.executionId || 'local-exec';
  const workflowId = options.workflowId || 'local-wf';
  const workflowVersionId = options.workflowVersionId || 'local-ver';
  const triggerPayload = options.triggerPayload || {};

  const stepOutputs: Record<string, unknown> = {};
  const stepResults: Record<string, NodeExecutionRecord> = {};
  const skippedNodes = new Set<string>();

  let overallStatus: 'COMPLETED' | 'FAILED' | 'WAITING' = 'COMPLETED';
  let failureError: { nodeId?: string; message: string; code?: string } | undefined;

  for (const nodeId of graph.executionOrder) {
    const nodeDef = graph.nodes.get(nodeId)!;
    const nodeStartTime = Date.now();

    // 1. Check if node is skipped
    if (skippedNodes.has(nodeId)) {
      stepResults[nodeId] = {
        nodeId,
        nodeType: nodeDef.type,
        status: 'SKIPPED',
        durationMs: 0,
      };
      // Propagate skip to outgoing edges
      const outEdges = graph.outgoingEdges.get(nodeId) || [];
      for (const edge of outEdges) {
        skippedNodes.add(edge.target);
      }
      continue;
    }

    // 2. Check incoming dependencies
    const inEdges = graph.incomingEdges.get(nodeId) || [];
    let hasFailedDependency = false;

    for (const inEdge of inEdges) {
      const parentResult = stepResults[inEdge.source];
      if (!parentResult || parentResult.status === 'FAILED') {
        hasFailedDependency = true;
        break;
      }
    }

    if (hasFailedDependency) {
      skippedNodes.add(nodeId);
      stepResults[nodeId] = {
        nodeId,
        nodeType: nodeDef.type,
        status: 'SKIPPED',
        durationMs: 0,
      };
      continue;
    }

    // 3. Resolve template expressions in node config
    const evaluationContext = {
      steps: Object.fromEntries(
        Object.entries(stepOutputs).map(([id, out]) => [id, { output: out }])
      ),
      trigger: triggerPayload,
      env: options.env || {},
    };

    let resolvedConfig: Record<string, unknown>;
    try {
      resolvedConfig = resolveTemplate(nodeDef.config, evaluationContext) as Record<string, unknown>;
    } catch (err: any) {
      const nodeDurationMs = Date.now() - nodeStartTime;
      stepResults[nodeId] = {
        nodeId,
        nodeType: nodeDef.type,
        status: 'FAILED',
        error: { message: err.message, code: 'CONFIG_TEMPLATE_ERROR' },
        durationMs: nodeDurationMs,
      };
      overallStatus = 'FAILED';
      failureError = { nodeId, message: err.message, code: 'CONFIG_TEMPLATE_ERROR' };
      break;
    }

    // 4. Instantiate and execute node
    let nodeExecutor;
    try {
      nodeExecutor = registry.get(nodeDef.type);
    } catch (err: any) {
      const nodeDurationMs = Date.now() - nodeStartTime;
      stepResults[nodeId] = {
        nodeId,
        nodeType: nodeDef.type,
        status: 'FAILED',
        error: { message: err.message, code: 'UNREGISTERED_NODE_TYPE' },
        durationMs: nodeDurationMs,
      };
      overallStatus = 'FAILED';
      failureError = { nodeId, message: err.message, code: 'UNREGISTERED_NODE_TYPE' };
      break;
    }

    const executionContext: ExecutionContext = {
      executionId,
      taskId: `${executionId}_${nodeId}`,
      nodeId,
      workflowId,
      workflowVersionId,
      attempt: 1,
      stepOutputs,
      triggerPayload,
      env: options.env,
      credentials: options.credentials,
      signal: options.signal,
    };

    let result: NodeResult;
    try {
      result = await nodeExecutor.execute(resolvedConfig, executionContext);
    } catch (err: any) {
      result = {
        status: 'FAILED',
        error: {
          message: err.message || 'Unknown node execution error',
          code: 'UNHANDLED_NODE_ERROR',
          details: String(err),
        },
      };
    }

    const nodeDurationMs = Date.now() - nodeStartTime;

    stepResults[nodeId] = {
      nodeId,
      nodeType: nodeDef.type,
      status: result.status,
      input: resolvedConfig,
      output: result.output,
      error: result.error,
      durationMs: nodeDurationMs,
    };

    if (result.status === 'SUCCEEDED') {
      stepOutputs[nodeId] = result.output;

      // Handle IF branching: prune the non-selected branch
      if (nodeDef.type === 'if' && result.output && typeof result.output === 'object') {
        const branchOutput = result.output as { branch?: 'true' | 'false' };
        const chosenBranch = branchOutput.branch;
        const outEdges = graph.outgoingEdges.get(nodeId) || [];

        for (const outEdge of outEdges) {
          // If edge specifies a sourceHandle (e.g. 'true' or 'false') that doesn't match chosen branch, skip target
          if (outEdge.sourceHandle && outEdge.sourceHandle !== chosenBranch) {
            skippedNodes.add(outEdge.target);
          }
        }
      }
    } else if (result.status === 'WAITING') {
      overallStatus = 'WAITING';
      break;
    } else if (result.status === 'FAILED') {
      overallStatus = 'FAILED';
      failureError = {
        nodeId,
        message: result.error?.message || 'Node failed',
        code: result.error?.code,
      };
      break;
    }
  }

  // Ensure all remaining unexecuted nodes are recorded as SKIPPED
  for (const nodeId of graph.executionOrder) {
    if (!stepResults[nodeId]) {
      const nodeDef = graph.nodes.get(nodeId)!;
      stepResults[nodeId] = {
        nodeId,
        nodeType: nodeDef.type,
        status: 'SKIPPED',
        durationMs: 0,
      };
    }
  }

  const totalDurationMs = Date.now() - startTime;

  return {
    status: overallStatus,
    stepOutputs,
    stepResults,
    totalDurationMs,
    error: failureError,
  };
}
