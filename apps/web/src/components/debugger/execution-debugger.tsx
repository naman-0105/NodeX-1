import React, { useState, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { RotateCcw, AlertCircle, CheckCircle2, Clock, XOctagon, ArrowLeft } from 'lucide-react';
import { WorkflowCanvas } from '../canvas/workflow-canvas.js';
import { StepInspector } from './step-inspector.js';
import {
  fetchExecution,
  approveTask,
  rejectTask,
  type ExecutionDetails,
} from '../../api/client.js';

interface ExecutionDebuggerProps {
  readonly executionId: string;
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly onClose: () => void;
}

export const ExecutionDebugger: React.FC<ExecutionDebuggerProps> = ({
  executionId,
  nodes,
  edges,
  onClose,
}) => {
  const [details, setDetails] = useState<ExecutionDetails | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadExecution = async () => {
    try {
      const data = await fetchExecution(executionId);
      setDetails(data);
      // Auto-stop polling if in terminal state
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(data.execution.status)) {
        setAutoRefresh(false);
      }
    } catch (err) {
      console.error('Failed to load execution:', err);
    }
  };

  useEffect(() => {
    loadExecution();
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadExecution, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [executionId, autoRefresh]);

  const handleApprove = async (taskId: string, comments?: string) => {
    await approveTask(executionId, taskId, 'web_admin', comments);
    setAutoRefresh(true);
    await loadExecution();
  };

  const handleReject = async (taskId: string, comments?: string) => {
    await rejectTask(executionId, taskId, 'web_admin', comments);
    setAutoRefresh(true);
    await loadExecution();
  };

  const selectedTask = details?.tasks.find((t) => t.nodeId === selectedNodeId) || null;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          color: '#166534',
          icon: <CheckCircle2 size={15} color="#16a34a" />,
        };
      case 'FAILED':
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          color: '#991b1b',
          icon: <XOctagon size={15} color="#dc2626" />,
        };
      case 'WAITING':
        return {
          bg: '#fffbeb',
          border: '#fde68a',
          color: '#92400e',
          icon: <AlertCircle size={15} color="#d97706" />,
        };
      case 'RUNNING':
        return {
          bg: '#eff6ff',
          border: '#bfdbfe',
          color: '#1e40af',
          icon: <RotateCcw size={15} color="#2563eb" className="animate-spin" />,
        };
      default:
        return {
          bg: '#f8fafc',
          border: '#e2e8f0',
          color: '#64748b',
          icon: <Clock size={15} color="#64748b" />,
        };
    }
  };

  const statusBadge = getStatusBadge(details?.execution.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#f8fafc' }}>
      {/* Execution Top Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} /> Back to Editor
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: statusBadge.bg,
              border: `1px solid ${statusBadge.border}`,
              color: statusBadge.color,
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {statusBadge.icon}
            <span>Execution: {details?.execution.status || 'LOADING'}</span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            ID: {executionId}
          </div>

          {details?.execution.startedAt && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Started: {new Date(details.execution.startedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#64748b',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Live Polling
          </label>

          <button
            type="button"
            onClick={loadExecution}
            style={{
              padding: '5px 10px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Debugger Work Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Canvas in Read-Only Debug Mode */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
            tasks={details?.tasks || []}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            readOnly={true}
          />
        </div>

        {/* Step Inspector Drawer */}
        {selectedNodeId && (
          <StepInspector
            nodeId={selectedNodeId}
            task={selectedTask}
            onClose={() => setSelectedNodeId(null)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>

      {/* Bottom Chronological Audit Events Strip */}
      <div
        style={{
          height: '96px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '8px 16px',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Audit Trail Events ({details?.events.length || 0})
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center' }}>
          {details?.events.map((evt) => (
            <div
              key={evt.id}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  color: '#0f172a',
                  fontWeight: 700,
                  backgroundColor: '#e2e8f0',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                }}
              >
                #{evt.sequence}
              </span>
              <span style={{ color: '#0f172a', fontWeight: 500 }}>{evt.eventType}</span>
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                {new Date(evt.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
