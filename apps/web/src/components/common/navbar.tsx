import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  UploadCloud,
  Plus,
  History,
  Pencil,
  Check,
  X,
  Loader2,
  LogOut,
} from 'lucide-react';
import type { WorkflowSummary } from '../../api/client.js';
import { useAuth } from '../../context/auth-context.js';

interface NavbarProps {
  readonly workflows: WorkflowSummary[];
  readonly currentWorkflowId: string | null;
  readonly onSelectWorkflow: (id: string) => void;
  readonly onNewWorkflow: () => void;
  readonly onRenameWorkflow?: (id: string, newName: string) => Promise<void>;
  readonly onPublishVersion: () => void;
  readonly onTriggerExecution: () => void;
  readonly currentVersionNumber?: number;
  readonly isTriggering?: boolean;
  readonly activeExecutionId?: string | null;
  readonly onToggleDebugger?: () => void;
  readonly onToggleRunsHistory?: () => void;
  readonly isRunsHistoryOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  workflows,
  currentWorkflowId,
  onSelectWorkflow,
  onNewWorkflow,
  onRenameWorkflow,
  onPublishVersion,
  onTriggerExecution,
  currentVersionNumber,
  isTriggering = false,
  activeExecutionId,
  onToggleDebugger,
  onToggleRunsHistory,
  isRunsHistoryOpen = false,
}) => {
  const { user, logout } = useAuth();
  const currentWorkflow = workflows.find((w) => w.id === currentWorkflowId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentWorkflow) {
      setNameInput(currentWorkflow.name);
    }
  }, [currentWorkflow]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartEditing = () => {
    if (currentWorkflow) {
      setNameInput(currentWorkflow.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!currentWorkflowId || !nameInput.trim() || !onRenameWorkflow) {
      setIsEditingName(false);
      return;
    }
    if (nameInput.trim() === currentWorkflow?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      await onRenameWorkflow(currentWorkflowId, nameInput.trim());
      setIsEditingName(false);
    } catch (err: any) {
      alert(`Failed to rename workflow: ${err.message}`);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setNameInput(currentWorkflow?.name || '');
    }
  };

  const getInitials = () => {
    if (!user) return 'U';
    if (user.name) {
      const parts = user.name.split(' ');
      return parts.map((p) => p[0]).join('').substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
      }}
    >
      {/* Left: Brand, Workflow Switcher & Editable Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#0f172a',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            NX
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', letterSpacing: '-0.02em' }}>
            NodeX
          </span>
        </div>

        <div style={{ height: '16px', width: '1px', backgroundColor: '#e2e8f0' }} />

        {/* Workflow Switcher & Inline Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                disabled={isSavingName}
                style={{
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #0f172a',
                  borderRadius: '4px',
                  outline: 'none',
                  minWidth: '180px',
                }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={isSavingName}
                title="Save name"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#16a34a',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                title="Cancel"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={currentWorkflowId || ''}
                onChange={(e) => onSelectWorkflow(e.target.value)}
                style={{
                  padding: '5px 8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '220px',
                }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleStartEditing}
                title="Rename current workflow"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
              >
                <Pencil size={13} />
              </button>

              <button
                onClick={onNewWorkflow}
                title="Create New Workflow"
                style={{
                  padding: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Status Tag Pill */}
          {currentVersionNumber !== undefined ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                padding: '2px 7px',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            >
              v{currentVersionNumber}
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '2px 7px',
                borderRadius: '4px',
              }}
            >
              Draft
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Runs History Toggle */}
        {onToggleRunsHistory && (
          <button
            type="button"
            onClick={onToggleRunsHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: isRunsHistoryOpen ? '#f1f5f9' : '#ffffff',
              border: `1px solid ${isRunsHistoryOpen ? '#0f172a' : '#e2e8f0'}`,
              borderRadius: '6px',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <History size={14} color="#64748b" /> Executions
          </button>
        )}

        {/* Debugger Active Button */}
        {activeExecutionId && onToggleDebugger && (
          <button
            type="button"
            onClick={onToggleDebugger}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              color: '#1d4ed8',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
              }}
            />
            Debugger Active
          </button>
        )}

        {/* Publish Version Button */}
        <button
          type="button"
          onClick={onPublishVersion}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            color: '#0f172a',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.backgroundColor = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          <UploadCloud size={14} color="#64748b" /> Publish Version
        </button>

        {/* Run / Test Button */}
        <button
          type="button"
          onClick={onTriggerExecution}
          disabled={isTriggering}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: '#0f172a',
            border: '1px solid #0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            cursor: isTriggering ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            opacity: isTriggering ? 0.8 : 1,
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isTriggering) e.currentTarget.style.backgroundColor = '#1e293b';
          }}
          onMouseLeave={(e) => {
            if (!isTriggering) e.currentTarget.style.backgroundColor = '#0f172a';
          }}
        >
          {isTriggering ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} fill="#ffffff" />
          )}
          {isTriggering ? 'Running...' : 'Test Step / Run'}
        </button>

        {/* User Profile / Sign Out Dropdown */}
        {user && (
          <div ref={userMenuRef} style={{ position: 'relative', marginLeft: '4px' }}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              title={user.email}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                overflow: 'hidden',
                padding: 0,
              }}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{getInitials()}</span>
              )}
            </button>

            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '40px',
                  width: '220px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  zIndex: 200,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name || 'NodeX User'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', textTransform: 'capitalize' }}>
                    Provider: {user.authProvider}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
