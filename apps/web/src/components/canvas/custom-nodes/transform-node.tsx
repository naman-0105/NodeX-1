import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface TransformNodeData {
  label?: string;
  config?: {
    code?: string;
  };
  executionStatus?: TaskStatus;
}

export const TransformNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as TransformNodeData;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#f59e0b' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(245, 158, 11, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#f59e0b', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Code size={16} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Transform (JS)'}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Custom Sandbox Code</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#f59e0b', width: 8, height: 8 }}
      />
    </div>
  );
};
