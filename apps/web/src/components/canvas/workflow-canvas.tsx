import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  BackgroundVariant,
} from '@xyflow/react';
import { nodeTypes } from './custom-nodes/index.js';
import { NodePalette } from './node-palette.js';
import { NodeConfigModal } from './node-config-modal.js';
import type { TaskInstanceSummary } from '../../api/client.js';

interface WorkflowCanvasProps {
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly onNodesChange: (nodes: Node[]) => void;
  readonly onEdgesChange: (edges: Edge[]) => void;
  readonly tasks?: TaskInstanceSummary[];
  readonly onSelectNode?: (nodeId: string | null) => void;
  readonly readOnly?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  tasks = [],
  onSelectNode,
  readOnly = false,
}) => {
  const [editingNode, setEditingNode] = useState<any | null>(null);

  // Map execution status onto nodes for real-time debugger
  const decoratedNodes = nodes.map((node) => {
    const matchingTask = tasks.find((t) => t.nodeId === node.id);
    return {
      ...node,
      data: {
        ...node.data,
        executionStatus: matchingTask?.status,
      },
    };
  });

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(applyNodeChanges(changes, nodes));
    },
    [nodes, onNodesChange]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(applyEdgeChanges(changes, edges));
    },
    [edges, onEdgesChange]
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      onEdgesChange(addEdge(connection, edges));
    },
    [edges, onEdgesChange]
  );

  const handleAddNode = (type: string, label: string) => {
    const id = `${type}_${Date.now().toString(36).substring(4)}`;
    const position = {
      x: 100 + nodes.length * 40,
      y: 100 + nodes.length * 40,
    };
    const newNode: Node = {
      id,
      type,
      position,
      data: { label, config: {} },
    };
    onNodesChange([...nodes, newNode]);
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (onSelectNode) {
      onSelectNode(node.id);
    }
  };

  const handleNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    if (!readOnly) {
      setEditingNode(node);
    }
  };

  const handleSaveNodeConfig = (id: string, label: string, config: Record<string, any>) => {
    const updated = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, label, config } } : n
    );
    onNodesChange(updated);
  };

  const handleDeleteNode = (id: string) => {
    onNodesChange(nodes.filter((n) => n.id !== id));
    onEdgesChange(edges.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
      {!readOnly && <NodePalette onAddNode={handleAddNode} />}

      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={decoratedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : handleConnect}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
          <Controls />
        </ReactFlow>
      </div>

      {editingNode && (
        <NodeConfigModal
          node={editingNode}
          onClose={() => setEditingNode(null)}
          onSave={handleSaveNodeConfig}
          onDelete={handleDeleteNode}
        />
      )}
    </div>
  );
};
