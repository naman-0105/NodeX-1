import React from 'react';
import type { TaskStatus } from '@nodex/shared';

interface NodeStatusBadgeProps {
  readonly status?: TaskStatus;
}

export const NodeStatusBadge: React.FC<NodeStatusBadgeProps> = ({ status }) => {
  if (!status) return null;

  const getStyle = () => {
    switch (status) {
      case 'SUCCEEDED':
        return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', text: '#34d399' };
      case 'FAILED':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#f87171' };
      case 'WAITING':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#fbbf24' };
      case 'RUNNING':
        return { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#60a5fa' };
      case 'SKIPPED':
        return { bg: 'rgba(148, 163, 184, 0.2)', border: '#64748b', text: '#94a3b8' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.2)', border: '#64748b', text: '#cbd5e1' };
    }
  };

  const style = getStyle();

  return (
    <div
      style={{
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '12px',
        textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        zIndex: 10,
      }}
    >
      {status}
    </div>
  );
};
