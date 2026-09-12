import React from 'react';
import type { TaskStatus } from '@nodex/shared';
import { Loader2 } from 'lucide-react';

interface NodeStatusBadgeProps {
  readonly status?: TaskStatus;
}

export const NodeStatusBadge: React.FC<NodeStatusBadgeProps> = ({ status }) => {
  if (!status) return null;

  const getStyle = () => {
    switch (status) {
      case 'SUCCEEDED':
        return {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          dot: '#16a34a',
          text: '#166534',
          label: 'Success',
        };
      case 'FAILED':
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          dot: '#dc2626',
          text: '#991b1b',
          label: 'Failed',
        };
      case 'WAITING':
        return {
          bg: '#fffbeb',
          border: '#fde68a',
          dot: '#d97706',
          text: '#92400e',
          label: 'Waiting',
        };
      case 'RUNNING':
        return {
          bg: '#eff6ff',
          border: '#bfdbfe',
          dot: '#2563eb',
          text: '#1e40af',
          label: 'Running',
        };
      case 'SKIPPED':
        return {
          bg: '#f8fafc',
          border: '#e2e8f0',
          dot: '#94a3b8',
          text: '#64748b',
          label: 'Skipped',
        };
      default:
        return {
          bg: '#f8fafc',
          border: '#e2e8f0',
          dot: '#94a3b8',
          text: '#64748b',
          label: status,
        };
    }
  };

  const style = getStyle();

  return (
    <div
      style={{
        position: 'absolute',
        top: -9,
        right: 12,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 7px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        zIndex: 10,
      }}
    >
      {status === 'RUNNING' ? (
        <Loader2 size={9} className="animate-spin" color={style.dot} />
      ) : (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: style.dot,
          }}
        />
      )}
      <span>{style.label}</span>
    </div>
  );
};
