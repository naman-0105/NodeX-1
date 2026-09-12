import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { NodeStatusBadge } from './node-badge.js';
import type { TaskStatus } from '@nodex/shared';

export interface GeminiNodeData {
  label?: string;
  config?: {
    model?: string;
    prompt?: string;
    systemPrompt?: string;
  };
  executionStatus?: TaskStatus;
}

export const GeminiNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data || {}) as GeminiNodeData;
  const model = nodeData.config?.model || 'gemini-3.6-flash';
  const prompt = nodeData.config?.prompt || 'Generate content with Gemini...';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#1e293b',
        border: `2px solid ${selected ? '#8b5cf6' : '#334155'}`,
        color: '#f8fafc',
        minWidth: '180px',
        position: 'relative',
        boxShadow: selected ? '0 0 12px rgba(139, 92, 246, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
    >
      <NodeStatusBadge status={nodeData.executionStatus} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#8b5cf6', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
          }}
        >
          <Sparkles size={16} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{nodeData.label || 'Gemini AI'}</div>
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
            <span style={{ color: '#c084fc', fontWeight: 700 }}>{model}</span>: {prompt}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#8b5cf6', width: 8, height: 8 }}
      />
    </div>
  );
};
