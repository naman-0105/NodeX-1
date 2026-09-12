import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2, XOctagon, AlertCircle, RotateCcw, Clock } from 'lucide-react';
import { fetchWorkflowExecutions } from '../../api/client.js';
import type { ExecutionStatus } from '@nodex/shared';

interface RunsHistoryDrawerProps {
  readonly workflowId: string | null;
  readonly isOpen: boolean;
  readonly activeExecutionId: string | null;
  readonly onClose: () => void;
  readonly onSelectExecution: (executionId: string) => void;
}

interface ExecutionItem {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType: string;
  status: ExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export const RunsHistoryDrawer: React.FC<RunsHistoryDrawerProps> = ({
  workflowId,
  isOpen,
  activeExecutionId,
  onClose,
  onSelectExecution,
}) => {
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && workflowId) {
      loadExecutions();
    }
  }, [isOpen, workflowId]);

  const loadExecutions = async () => {
    if (!workflowId) return;
    setIsLoading(true);
    try {
      const data = await fetchWorkflowExecutions(workflowId, 30);
      setExecutions(data.executions || []);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={14} color="#16a34a" />;
      case 'FAILED':
        return <XOctagon size={14} color="#dc2626" />;
      case 'WAITING':
        return <AlertCircle size={14} color="#d97706" />;
      case 'RUNNING':
        return <RotateCcw size={14} color="#2563eb" className="animate-spin" />;
      default:
        return <Clock size={14} color="#64748b" />;
    }
  };

  const getStatusStyle = (status: ExecutionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' };
      case 'FAILED':
        return { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' };
      case 'WAITING':
        return { bg: '#fffbeb', border: '#fde68a', color: '#92400e' };
      case 'RUNNING':
        return { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' };
      default:
        return { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.15)',
          zIndex: 900,
        }}
      />

      {/* Slide-over Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-4px 0 20px 0 rgb(0 0 0 / 0.08)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Execution History
            </span>
            <button
              type="button"
              onClick={loadExecutions}
              title="Refresh runs"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Executions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {executions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 10px', fontSize: '13px' }}>
              {isLoading ? 'Loading run history...' : 'No executions found for this workflow.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {executions.map((exec) => {
                const isSelected = activeExecutionId === exec.id;
                const statusStyle = getStatusStyle(exec.status);
                let durationStr = '';
                if (exec.startedAt && exec.finishedAt) {
                  const ms = new Date(exec.finishedAt).getTime() - new Date(exec.startedAt).getTime();
                  durationStr = `${ms}ms`;
                }

                return (
                  <button
                    key={exec.id}
                    type="button"
                    onClick={() => {
                      onSelectExecution(exec.id);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: isSelected ? '#f1f5f9' : '#ffffff',
                      border: `1px solid ${isSelected ? '#0f172a' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getStatusIcon(exec.status)}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: statusStyle.bg,
                            border: `1px solid ${statusStyle.border}`,
                            color: statusStyle.color,
                          }}
                        >
                          {exec.status}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                          {exec.triggerType} trigger
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        {exec.id.substring(0, 18)}...
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '11px', color: '#0f172a', fontWeight: 500 }}>
                        {new Date(exec.createdAt).toLocaleTimeString()}
                      </div>
                      {durationStr && (
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{durationStr}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
