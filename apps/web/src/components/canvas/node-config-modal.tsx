import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

interface NodeConfigModalProps {
  readonly node: {
    id: string;
    type: string;
    data: {
      label?: string;
      config?: Record<string, any>;
    };
  } | null;
  readonly onClose: () => void;
  readonly onSave: (id: string, label: string, config: Record<string, any>) => void;
  readonly onDelete: (id: string) => void;
}

export const NodeConfigModal: React.FC<NodeConfigModalProps> = ({
  node,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!node) return null;

  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState<Record<string, any>>(node.data.config || {});

  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
  }, [node]);

  const handleSave = () => {
    onSave(node.id, label, config);
    onClose();
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case 'http':
        return (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Method
              </label>
              <select
                value={config.method || 'GET'}
                onChange={(e) => setConfig({ ...config, method: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                URL
              </label>
              <input
                type="text"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://api.example.com/endpoint"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                }}
              />
            </div>
            {config.method !== 'GET' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Request Body (JSON / Template)
                </label>
                <textarea
                  value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : config.body || ''}
                  onChange={(e) => {
                    try {
                      setConfig({ ...config, body: JSON.parse(e.target.value) });
                    } catch {
                      setConfig({ ...config, body: e.target.value });
                    }
                  }}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
              </div>
            )}
          </>
        );

      case 'transform':
        return (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Sandbox JavaScript Code
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
              Access <code>input</code>, <code>steps.&lt;nodeId&gt;.output</code>, and <code>trigger</code>.
            </div>
            <textarea
              value={config.code || 'return input;'}
              onChange={(e) => setConfig({ ...config, code: e.target.value })}
              rows={8}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            />
          </div>
        );

      case 'if':
        return (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Condition Expression
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
              e.g. <code>steps.http_1.status === 200 && input.amount &gt; 100</code>
            </div>
            <input
              type="text"
              value={config.condition || ''}
              onChange={(e) => setConfig({ ...config, condition: e.target.value })}
              placeholder="steps.step_1.output.success === true"
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontFamily: 'monospace',
              }}
            />
          </div>
        );

      case 'approval':
        return (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Prompt / Instructions for Approver
              </label>
              <textarea
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Please review and approve this transaction"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Approvers (Comma-separated emails or roles)
              </label>
              <input
                type="text"
                value={(config.approvers || []).join(', ')}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    approvers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="manager@company.com, finance_lead"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                }}
              />
            </div>
          </>
        );

      case 'delay':
        return (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Duration (seconds)
            </label>
            <input
              type="number"
              value={config.durationSeconds || 60}
              onChange={(e) => setConfig({ ...config, durationSeconds: Number(e.target.value) })}
              min={1}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
              }}
            />
          </div>
        );

      default:
        return (
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>
            No additional configuration needed for this node type.
          </div>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '480px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Configure {node.data.label || node.type}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {node.id}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Node Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
              }}
            />
          </div>

          {renderConfigFields()}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderTop: '1px solid #334155',
            backgroundColor: '#0f172a',
          }}
        >
          <button
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Trash2 size={14} /> Delete
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
