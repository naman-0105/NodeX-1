import React from 'react';
import { Play, UploadCloud, Plus, Bug } from 'lucide-react';
import type { WorkflowSummary } from '../../api/client.js';

interface NavbarProps {
  readonly workflows: WorkflowSummary[];
  readonly currentWorkflowId: string | null;
  readonly onSelectWorkflow: (id: string) => void;
  readonly onNewWorkflow: () => void;
  readonly onPublishVersion: () => void;
  readonly onTriggerExecution: () => void;
  readonly currentVersionNumber?: number;
  readonly isTriggering?: boolean;
  readonly activeExecutionId?: string | null;
  readonly onToggleDebugger?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  workflows,
  currentWorkflowId,
  onSelectWorkflow,
  onNewWorkflow,
  onPublishVersion,
  onTriggerExecution,
  currentVersionNumber,
  isTriggering = false,
  activeExecutionId,
  onToggleDebugger,
}) => {
  return (
    <header
      style={{
        height: '56px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100,
      }}
    >
      {/* Brand & Workflow Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: '#6366f1',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '14px',
            }}
          >
            NX
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em' }}>NodeX</span>
        </div>

        <div style={{ height: '20px', width: '1px', backgroundColor: '#334155' }} />

        {/* Workflow Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={currentWorkflowId || ''}
            onChange={(e) => onSelectWorkflow(e.target.value)}
            style={{
              padding: '6px 10px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>

          <button
            onClick={onNewWorkflow}
            title="Create New Workflow"
            style={{
              padding: '6px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {currentVersionNumber !== undefined && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              color: '#6366f1',
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
            v{currentVersionNumber}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {activeExecutionId && onToggleDebugger && (
          <button
            onClick={onToggleDebugger}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid #6366f1',
              borderRadius: '6px',
              color: '#818cf8',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Bug size={14} /> Open Debugger
          </button>
        )}

        <button
          onClick={onPublishVersion}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#f8fafc',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <UploadCloud size={14} /> Publish Version
        </button>

        <button
          onClick={onTriggerExecution}
          disabled={isTriggering}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 16px',
            backgroundColor: '#10b981',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            opacity: isTriggering ? 0.7 : 1,
          }}
        >
          <Play size={14} fill="#ffffff" />
          {isTriggering ? 'Triggering...' : 'Run Workflow'}
        </button>
      </div>
    </header>
  );
};
