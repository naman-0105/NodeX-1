import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCheck } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface ApprovalNodeData {
  label?: string;
  config?: {
    prompt?: string;
    approvers?: string[];
  };
  executionStatus?: TaskStatus;
}

export const ApprovalNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as ApprovalNodeData;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#f97316' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(249, 115, 22, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#f97316', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(249, 115, 22, 0.2)',
            color: '#f97316',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <UserCheck size={16} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Human Approval'}</div>
          <div
            style={{
              fontSize: '10px',
              color: '#94a3b8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '130px',
            }}
          >
            {nodeData.config?.prompt || 'Requires Approval'}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#f97316', width: 8, height: 8 }}
      />
    </div>
  );
};
