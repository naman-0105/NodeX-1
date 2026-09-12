import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code2 } from 'lucide-react';
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
        width: '240px',
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        border: `1px solid ${selected ? '#0f172a' : '#e2e8f0'}`,
        boxShadow: selected
          ? '0 0 0 1px #0f172a, 0 2px 4px 0 rgb(0 0 0 / 0.06)'
          : '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        position: 'relative',
        transition: 'all 0.15s ease',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          backgroundColor: '#ffffff',
          border: '1.5px solid #94a3b8',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#d97706',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Code2 size={15} />
        </div>

        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nodeData.label || 'Transform (JS)'}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            JavaScript Sandbox Code
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          backgroundColor: '#ffffff',
          border: '1.5px solid #94a3b8',
        }}
      />
    </div>
  );
};
