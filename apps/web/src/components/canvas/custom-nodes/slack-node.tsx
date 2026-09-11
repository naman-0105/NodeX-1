import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Hash } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface SlackNodeData {
  label?: string;
  config?: {
    channel?: string;
    message?: string;
  };
  executionStatus?: TaskStatus;
}

export const SlackNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as SlackNodeData;
  const channel = nodeData.config?.channel || '#general';
  const message = nodeData.config?.message || 'Send message to Slack';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#e01e5a' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(224, 30, 90, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#e01e5a', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(224, 30, 90, 0.2)',
            color: '#e01e5a',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Hash size={16} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Slack Message'}</div>
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
            <span style={{ color: '#f472b6', fontWeight: 700 }}>
              {channel.startsWith('#') || channel.startsWith('C') ? channel : `#${channel}`}
            </span>
            {message ? `: ${message}` : ''}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#e01e5a', width: 8, height: 8 }}
      />
    </div>
  );
};
