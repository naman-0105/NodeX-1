import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface TriggerNodeData {
  label?: string;
  config?: Record<string, unknown>;
  executionStatus?: TaskStatus;
}

export const TriggerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as TriggerNodeData;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#10b981' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '160px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(16, 185, 129, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Play size={16} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Trigger'}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Workflow Start</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#10b981', width: 8, height: 8 }}
      />
    </div>
  );
};
