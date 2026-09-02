import React, { useState, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { RotateCcw, AlertCircle, CheckCircle2, Clock, XOctagon } from 'lucide-react';
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
      // Auto-stop polling if terminal
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={16} color="#10b981" />;
      case 'FAILED':
        return <XOctagon size={16} color="#ef4444" />;
      case 'WAITING':
        return <AlertCircle size={16} color="#f59e0b" />;
      case 'RUNNING':
        return <RotateCcw size={16} color="#3b82f6" className="animate-spin" />;
      default:
        return <Clock size={16} color="#94a3b8" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0f172a' }}>
      {/* Execution Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {getStatusIcon(details?.execution.status)}
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              Execution: {details?.execution.status || 'LOADING'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: <code>{executionId}</code></div>
          {details?.execution.startedAt && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Started: {new Date(details.execution.startedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Live Polling
          </label>
          <button
            onClick={loadExecution}
            style={{
              padding: '6px 12px',
              backgroundColor: '#334155',
              border: 'none',
              borderRadius: '6px',
              color: '#f8fafc',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={12} /> Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Exit Debugger
          </button>
        </div>
      </div>

      {/* Main Debugger Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* React Flow Canvas in Read-Only Debug Mode with Status Badges */}
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

      {/* Chronological Audit Events Bar */}
      <div
        style={{
          height: '110px',
          backgroundColor: '#0b0f19',
          borderTop: '1px solid #334155',
          padding: '10px 20px',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Execution Audit Trail ({details?.events.length || 0} events)
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', alignItems: 'center' }}>
          {details?.events.map((evt) => (
            <div
              key={evt.id}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ color: '#6366f1', fontWeight: 700 }}>#{evt.sequence}</span>
              <span style={{ color: '#f8fafc' }}>{evt.eventType}</span>
              <span style={{ color: '#64748b', fontSize: '10px' }}>
                {new Date(evt.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
