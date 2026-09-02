import type {
  WorkflowDefinition,
  WorkflowNodeDefinition,
  WorkflowEdgeDefinition,
} from '@nodex/shared';

export interface ExecutionGraph {
  readonly nodes: ReadonlyMap<string, WorkflowNodeDefinition>;
  readonly edges: readonly WorkflowEdgeDefinition[];
  readonly incomingEdges: ReadonlyMap<string, readonly WorkflowEdgeDefinition[]>;
  readonly outgoingEdges: ReadonlyMap<string, readonly WorkflowEdgeDefinition[]>;
  readonly executionOrder: readonly string[];
  readonly rootNodeId: string;
}

export class WorkflowGraphError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WorkflowGraphError';
  }
}

/**
 * Builds, validates, and topologically sorts a workflow DAG.
 */
export function buildExecutionGraph(definition: WorkflowDefinition): ExecutionGraph {
  if (!definition.nodes || definition.nodes.length === 0) {
    throw new WorkflowGraphError('Workflow definition contains no nodes', 'EMPTY_WORKFLOW');
  }

  const nodeMap = new Map<string, WorkflowNodeDefinition>();
  const incoming = new Map<string, WorkflowEdgeDefinition[]>();
  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();

  for (const node of definition.nodes) {
    if (nodeMap.has(node.id)) {
      throw new WorkflowGraphError(`Duplicate node ID detected: ${node.id}`, 'DUPLICATE_NODE_ID');
    }
    nodeMap.set(node.id, node);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  const edges = definition.edges || [];
  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      throw new WorkflowGraphError(
        `Edge source node does not exist: ${edge.source}`,
        'INVALID_EDGE_SOURCE'
      );
    }
    if (!nodeMap.has(edge.target)) {
      throw new WorkflowGraphError(
        `Edge target node does not exist: ${edge.target}`,
        'INVALID_EDGE_TARGET'
      );
    }
    incoming.get(edge.target)!.push(edge);
    outgoing.get(edge.source)!.push(edge);
  }

  // Detect cycle using DFS with 3-color marks (0: unvisited, 1: visiting, 2: visited)
  const visitState = new Map<string, number>();
  for (const nodeId of nodeMap.keys()) {
    visitState.set(nodeId, 0);
  }

  function detectCycle(nodeId: string, path: string[]): void {
    visitState.set(nodeId, 1);
    path.push(nodeId);

    const outEdges = outgoing.get(nodeId) || [];
    for (const edge of outEdges) {
      const neighbor = edge.target;
      const state = visitState.get(neighbor);
      if (state === 1) {
        const cyclePath = [...path, neighbor].join(' -> ');
        throw new WorkflowGraphError(
          `Cycle detected in workflow graph: ${cyclePath}`,
          'CYCLE_DETECTED'
        );
      }
      if (state === 0) {
        detectCycle(neighbor, path);
      }
    }

    path.pop();
    visitState.set(nodeId, 2);
  }

  for (const nodeId of nodeMap.keys()) {
    if (visitState.get(nodeId) === 0) {
      detectCycle(nodeId, []);
    }
  }

  // Topological sorting via Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const [nodeId, inc] of incoming.entries()) {
    inDegree.set(nodeId, inc.length);
  }

  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(nodeId);
    }
  }

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    executionOrder.push(current);

    const outEdges = outgoing.get(current) || [];
    for (const edge of outEdges) {
      const target = edge.target;
      const newDeg = (inDegree.get(target) || 0) - 1;
      inDegree.set(target, newDeg);
      if (newDeg === 0) {
        queue.push(target);
      }
    }
  }

  if (executionOrder.length !== nodeMap.size) {
    throw new WorkflowGraphError(
      'Failed to compute topological order. Possible disconnected cycle or malformed graph.',
      'TOPOLOGICAL_SORT_FAILED'
    );
  }

  // Find root node (prefer node with type === 'trigger' or first 0 in-degree node)
  let rootNodeId = executionOrder[0];
  for (const nodeId of executionOrder) {
    const node = nodeMap.get(nodeId);
    if (node && node.type === 'trigger') {
      rootNodeId = nodeId;
      break;
    }
  }

  return {
    nodes: nodeMap,
    edges,
    incomingEdges: incoming,
    outgoingEdges: outgoing,
    executionOrder,
    rootNodeId,
  };
}
