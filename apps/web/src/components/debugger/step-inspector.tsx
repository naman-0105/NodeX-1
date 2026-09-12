import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
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
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // Section collapse states
  const [isInputOpen, setIsInputOpen] = useState(true);
  const [isOutputOpen, setIsOutputOpen] = useState(true);
  const [isMetricsOpen, setIsMetricsOpen] = useState(true);

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

  const copyToClipboard = (text: string, type: 'input' | 'output') => {
    navigator.clipboard.writeText(text);
    if (type === 'input') {
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } else {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', dot: '#16a34a' };
      case 'FAILED':
        return { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', dot: '#dc2626' };
      case 'WAITING':
        return { bg: '#fffbeb', border: '#fde68a', color: '#92400e', dot: '#d97706' };
      case 'RUNNING':
        return { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', dot: '#2563eb' };
      default:
        return { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b', dot: '#94a3b8' };
    }
  };

  const statusStyle = getStatusBadge(task?.status);

  // Calculate duration if timestamps exist
  let durationMs: number | null = null;
  if (task?.startedAt && task?.finishedAt) {
    durationMs = new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime();
  }

  const inputJson = (task as any)?.inputJson;

  return (
    <aside
      style={{
        width: '380px',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: '-2px 0 10px 0 rgb(0 0 0 / 0.04)',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Step Inspector</div>
          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Node: {nodeId}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
        {task ? (
          <>
            {/* Status & Attempt Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: statusStyle.bg,
                  border: `1px solid ${statusStyle.border}`,
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                  Status
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: statusStyle.color, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusStyle.dot }} />
                  {task.status}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                  Attempt
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Attempt #{task.attempt}
                </div>
              </div>
            </div>

            {/* Human Approval Required Action Banner */}
            {task.status === 'WAITING' && onApprove && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                  <AlertTriangle size={15} color="#d97706" /> Approval Required to Resume
                </div>

                <input
                  type="text"
                  placeholder="Optional approver notes or reason..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    color: '#0f172a',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('approve')}
                    style={{
                      flex: 1,
                      padding: '7px',
                      backgroundColor: '#16a34a',
                      border: '1px solid #16a34a',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('reject')}
                    style={{
                      flex: 1,
                      padding: '7px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#dc2626',
                      fontWeight: 600,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
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

            {/* Collapsible Section: Execution Metrics */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setIsMetricsOpen(!isMetricsOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                <span>Execution Metrics</span>
                {isMetricsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isMetricsOpen && (
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#64748b', backgroundColor: '#ffffff' }}>
                  {task.workerId && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Server size={12} /> Worker ID
                      </span>
                      <code style={{ color: '#0f172a', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                        {task.workerId}
                      </code>
                    </div>
                  )}
                  {durationMs !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> Duration
                      </span>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>{durationMs}ms</span>
                    </div>
                  )}
                  {task.startedAt && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Started At</span>
                      <span style={{ color: '#0f172a' }}>{new Date(task.startedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {task.finishedAt && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Finished At</span>
                      <span style={{ color: '#0f172a' }}>{new Date(task.finishedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Section: Input Payload (if present) */}
            {inputJson !== undefined && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsInputOpen(!isInputOpen)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {isInputOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Input Payload</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(inputJson, null, 2), 'input')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    {copiedInput ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    {copiedInput ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {isInputOpen && (
                  <pre
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#ffffff',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#0f172a',
                      overflowX: 'auto',
                      maxHeight: '200px',
                      borderTop: '1px solid #e2e8f0',
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(inputJson, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Collapsible Section: Output Payload */}
            {task.outputJson !== undefined && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsOutputOpen(!isOutputOpen)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {isOutputOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Output Payload</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(task.outputJson, null, 2), 'output')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    {copiedOutput ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    {copiedOutput ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {isOutputOpen && (
                  <pre
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#ffffff',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#0f172a',
                      overflowX: 'auto',
                      maxHeight: '220px',
                      borderTop: '1px solid #e2e8f0',
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(task.outputJson, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Error Payload if Present */}
            {task.errorJson !== undefined && (
              <div style={{ border: '1px solid #fecaca', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef2f2',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={14} color="#dc2626" /> Error Details
                </div>
                <pre
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#ffffff',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#dc2626',
                    overflowX: 'auto',
                    borderTop: '1px solid #fecaca',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(task.errorJson, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
            Click a node on the canvas to inspect its step results and execution data.
          </div>
        )}
      </div>
    </aside>
  );
};
