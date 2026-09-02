import { describe, it, expect } from 'vitest';
import { buildExecutionGraph, WorkflowGraphError } from '../src/engine/dag.js';
import type { WorkflowDefinition } from '@nodex/shared';

describe('DAG Graph Builder & Cycle Detector', () => {
  it('correctly orders a linear workflow', () => {
    const workflow: WorkflowDefinition = {
      nodes: [
        { id: 'node_1', type: 'trigger', config: {} },
        { id: 'node_2', type: 'http', config: { url: 'https://example.com' } },
        { id: 'node_3', type: 'transform', config: { code: 'return input;' } },
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' },
      ],
    };

    const graph = buildExecutionGraph(workflow);
    expect(graph.executionOrder).toEqual(['node_1', 'node_2', 'node_3']);
    expect(graph.rootNodeId).toBe('node_1');
  });

  it('correctly orders a branching/diamond workflow', () => {
    const workflow: WorkflowDefinition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        { id: 'branch_a', type: 'transform', config: { code: 'return 1;' } },
        { id: 'branch_b', type: 'transform', config: { code: 'return 2;' } },
        { id: 'end', type: 'transform', config: { code: 'return 3;' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'branch_a' },
        { id: 'e2', source: 'start', target: 'branch_b' },
        { id: 'e3', source: 'branch_a', target: 'end' },
        { id: 'e4', source: 'branch_b', target: 'end' },
      ],
    };

    const graph = buildExecutionGraph(workflow);
    expect(graph.executionOrder[0]).toBe('start');
    expect(graph.executionOrder[3]).toBe('end');
    expect(new Set([graph.executionOrder[1], graph.executionOrder[2]])).toEqual(
      new Set(['branch_a', 'branch_b'])
    );
  });

  it('detects cycles and throws WorkflowGraphError with CYCLE_DETECTED', () => {
    const cyclicWorkflow: WorkflowDefinition = {
      nodes: [
        { id: 'a', type: 'trigger', config: {} },
        { id: 'b', type: 'transform', config: { code: '' } },
        { id: 'c', type: 'transform', config: { code: '' } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' }, // cycle!
      ],
    };

    expect(() => buildExecutionGraph(cyclicWorkflow)).toThrow(WorkflowGraphError);
    expect(() => buildExecutionGraph(cyclicWorkflow)).toThrow(/Cycle detected/);
  });

  it('detects self-loop cycle', () => {
    const selfLoopWorkflow: WorkflowDefinition = {
      nodes: [{ id: 'a', type: 'transform', config: { code: '' } }],
      edges: [{ id: 'e1', source: 'a', target: 'a' }],
    };

    expect(() => buildExecutionGraph(selfLoopWorkflow)).toThrow(/Cycle detected/);
  });

  it('throws on duplicate node IDs', () => {
    const invalidWorkflow: WorkflowDefinition = {
      nodes: [
        { id: 'dup', type: 'trigger', config: {} },
        { id: 'dup', type: 'transform', config: { code: '' } },
      ],
      edges: [],
    };

    expect(() => buildExecutionGraph(invalidWorkflow)).toThrow(/Duplicate node ID/);
  });

  it('throws on missing edge endpoints', () => {
    const invalidWorkflow: WorkflowDefinition = {
      nodes: [{ id: 'a', type: 'trigger', config: {} }],
      edges: [{ id: 'e1', source: 'a', target: 'non_existent' }],
    };

    expect(() => buildExecutionGraph(invalidWorkflow)).toThrow(/Edge target node does not exist/);
  });
});
