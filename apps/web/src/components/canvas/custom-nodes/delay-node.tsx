import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface DelayNodeData {
  label?: string;
  config?: {
    durationSeconds?: number;
    until?: string;
  };
  executionStatus?: TaskStatus;
}

export const DelayNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as DelayNodeData;
  const duration = nodeData.config?.durationSeconds ? `${nodeData.config.durationSeconds}s` : 'Delay Timer';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#06b6d4' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(6, 182, 212, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#06b6d4', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(6, 182, 212, 0.2)',
            color: '#06b6d4',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Clock size={16} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Delay / Wait'}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{duration}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#06b6d4', width: 8, height: 8 }}
      />
    </div>
  );
};
