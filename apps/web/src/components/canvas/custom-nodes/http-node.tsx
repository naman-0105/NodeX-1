import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface HttpNodeData {
  label?: string;
  config?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  executionStatus?: TaskStatus;
}

export const HttpNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as HttpNodeData;
  const method = nodeData.config?.method || 'GET';
  const url = nodeData.config?.url || 'https://...';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#3b82f6' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(59, 130, 246, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#3b82f6', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#3b82f6',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Globe size={16} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'HTTP Request'}</div>
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
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{method}</span> {url}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 8, height: 8 }}
      />
    </div>
  );
};
