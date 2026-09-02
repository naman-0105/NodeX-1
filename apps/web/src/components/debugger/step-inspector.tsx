import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Clock, Server } from 'lucide-react';
import type { TaskInstanceSummary } from '../../api/client.js';

interface StepInspectorProps {
  readonly task: TaskInstanceSummary | null;
  readonly nodeId: string | null;
  readonly onClose: () => void;
  readonly onApprove?: (taskId: string, comments?: string) => Promise<void>;
  readonly onReject?: (taskId: string, comments?: string) => Promise<void>;
}

export const StepInspector: React.FC<StepInspectorProps> = ({
  task,
  nodeId,
  onClose,
  onApprove,
  onReject,
}) => {
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!nodeId) return null;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!task) return;
    setIsSubmitting(true);
    try {
      if (action === 'approve' && onApprove) {
        await onApprove(task.id, comments);
      } else if (action === 'reject' && onReject) {
        await onReject(task.id, comments);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        width: '380px',
        backgroundColor: '#1e293b',
        borderLeft: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #334155',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Step Inspector</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Node: {nodeId}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
        {task ? (
          <>
            {/* Status & Attempt Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Status</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: task.status === 'SUCCEEDED' ? '#10b981' : task.status === 'FAILED' ? '#ef4444' : task.status === 'WAITING' ? '#f59e0b' : '#3b82f6' }}>
                  {task.status}
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Attempts</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                  Attempt #{task.attempt}
                </div>
              </div>
            </div>

            {/* Timing & Worker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              {task.workerId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={12} /> Worker: <code>{task.workerId}</code>
                </div>
              )}
              {task.startedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} /> Started: {new Date(task.startedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Human Approval Action Box */}
            {task.status === 'WAITING' && onApprove && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>
                  Human Approval Required
                </div>
                <input
                  type="text"
                  placeholder="Optional approver comment..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('approve')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('reject')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#ef4444',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            )}

            {/* Output Payload */}
            {task.outputJson !== undefined && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                  Output Payload
                </div>
                <pre
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    color: '#34d399',
                  }}
                >
                  {JSON.stringify(task.outputJson, null, 2)}
                </pre>
              </div>
            )}

            {/* Error Payload */}
            {task.errorJson !== undefined && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>
                  Error Details
                </div>
                <pre
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    color: '#f87171',
                  }}
                >
                  {JSON.stringify(task.errorJson, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginTop: '30px' }}>
            This step has not been executed yet in this run.
          </div>
        )}
      </div>
    </div>
  );
};
