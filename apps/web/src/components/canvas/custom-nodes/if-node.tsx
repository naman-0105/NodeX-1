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
  const condition = nodeData.config?.condition || 'Evaluate condition';

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: '#f5f3ff',
            border: '1px solid #ede9fe',
            color: '#7c3aed',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GitFork size={15} />
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
            {nodeData.label || 'IF Condition'}
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
            {condition}
          </div>
        </div>
      </div>

      {/* Clean Branching Handles Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '14px',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '6px',
          marginTop: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>
          <span>True</span>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{
              top: 'auto',
              bottom: '22px',
              width: 8,
              height: 8,
              backgroundColor: '#ffffff',
              border: '1.5px solid #16a34a',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#dc2626' }}>
          <span>False</span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{
              top: 'auto',
              bottom: '8px',
              width: 8,
              height: 8,
              backgroundColor: '#ffffff',
              border: '1.5px solid #dc2626',
            }}
          />
        </div>
      </div>
    </div>
  );
};
