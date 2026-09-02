import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface IfNodeData {
  label?: string;
  config?: {
    condition?: string;
  };
  executionStatus?: TaskStatus;
}

export const IfNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as IfNodeData;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#a855f7' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(168, 85, 247, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#a855f7', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            color: '#a855f7',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <GitFork size={16} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'IF Condition'}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
            {nodeData.config?.condition ? nodeData.config.condition : 'Condition Branch'}
          </div>
        </div>
      </div>

      {/* Two branching handles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          fontSize: '10px',
          fontWeight: 700,
          marginTop: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
          <span>True</span>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{
              top: 'auto',
              bottom: '22px',
              background: '#10b981',
              width: 8,
              height: 8,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
          <span>False</span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{
              top: 'auto',
              bottom: '8px',
              background: '#ef4444',
              width: 8,
              height: 8,
            }}
          />
        </div>
      </div>
    </div>
  );
};
