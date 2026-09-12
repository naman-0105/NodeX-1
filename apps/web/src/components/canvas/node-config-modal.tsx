import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Hash, ExternalLink, RefreshCw, Check, LogOut, Sparkles } from 'lucide-react';
import {
  fetchSlackChannels,
  fetchIntegrationStatus,
  saveSlackToken,
  disconnectIntegration,
  type SlackChannelOption,
  type IntegrationStatus,
} from '../../api/client.js';

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

  // Slack-specific state
  const [slackChannels, setSlackChannels] = useState<SlackChannelOption[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [customChannelMode, setCustomChannelMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [saveTokenSuccess, setSaveTokenSuccess] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
    setManualToken('');
    setSaveTokenSuccess(false);

    if (node.type === 'slack') {
      loadSlackDetails();
    }
  }, [node]);

  const loadSlackDetails = async () => {
    setLoadingChannels(true);
    try {
      const [channels, status] = await Promise.all([
        fetchSlackChannels().catch(() => []),
        fetchIntegrationStatus().catch(() => null),
      ]);
      setSlackChannels(channels);
      if (status) setIntegrationStatus(status);
      if (!config.channel && channels.length > 0) {
        setConfig((prev) => ({ ...prev, channel: channels[0].name || channels[0].id }));
      }
    } catch {
      // Ignore
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) return;
    setSavingToken(true);
    try {
      await saveSlackToken(manualToken.trim());
      setSaveTokenSuccess(true);
      setManualToken('');
      await loadSlackDetails();
      setTimeout(() => setSaveTokenSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save Slack token: ${err.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to sign out and disconnect Slack?')) return;
    setDisconnecting(true);
    try {
      await disconnectIntegration('slack');
      await loadSlackDetails();
    } catch (err: any) {
      alert(`Failed to disconnect: ${err.message}`);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOpenOAuthPopup = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/api/integrations/slack/authorize',
      'Slack OAuth',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    const messageListener = (event: MessageEvent) => {
      if (event.data?.type === 'SLACK_AUTH_SUCCESS') {
        loadSlackDetails();
        window.removeEventListener('message', messageListener);
      }
    };

    window.addEventListener('message', messageListener);

    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        loadSlackDetails();
        window.removeEventListener('message', messageListener);
      }
    }, 1000);
  };

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

      case 'slack':
        return (
          <>
            {/* Channel Selection */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={13} color="#e01e5a" /> Target Channel
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCustomChannelMode(!customChannelMode)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    {customChannelMode ? 'Choose from list' : 'Custom / Expression'}
                  </button>
                  <button
                    type="button"
                    onClick={loadSlackDetails}
                    title="Refresh channel list"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                  >
                    <RefreshCw size={12} className={loadingChannels ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {customChannelMode ? (
                <input
                  type="text"
                  value={config.channel || ''}
                  onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                  placeholder="#general, C01234567, or {{trigger.channel}}"
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
              ) : (
                <select
                  value={config.channel || (slackChannels[0]?.name ?? '')}
                  onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                  disabled={loadingChannels}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                  }}
                >
                  {loadingChannels && <option>Loading channels...</option>}
                  {!loadingChannels && slackChannels.length === 0 && (
                    <option value="">No channels found (Connect Slack below)</option>
                  )}
                  {slackChannels.map((ch) => (
                    <option key={ch.id} value={ch.name || ch.id}>
                      #{ch.name} {ch.isPrivate ? '(Private)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Message Textarea */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Message Content
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Supports dynamic templates: <code>&#123;&#123;trigger.amount&#125;&#125;</code> or <code>steps.&lt;id&gt;.output</code>
              </div>
              <textarea
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Hello team! A new alert was triggered: {{trigger.message}}"
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

            {/* Credential Vault Box */}
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
                  Slack OAuth & Credentials
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: integrationStatus?.slack?.connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: integrationStatus?.slack?.connected ? '#10b981' : '#f87171',
                    fontWeight: 600,
                  }}
                >
                  {integrationStatus?.slack?.connected
                    ? `Connected (${integrationStatus.slack.teamName || 'Active'})`
                    : 'Not Connected'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {integrationStatus?.slack?.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDisconnectSlack}
                      disabled={disconnecting}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <LogOut size={13} /> {disconnecting ? 'Signing out...' : 'Sign Out / Disconnect'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenOAuthPopup}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        backgroundColor: '#334155',
                        border: '1px solid #475569',
                        color: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={12} /> Reconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenOAuthPopup}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#e01e5a',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <ExternalLink size={13} /> Connect via OAuth
                  </button>
                )}
              </div>

              {/* Direct Token Input Option */}
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Or paste Bot User Token (<code>xoxb-...</code>):
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="xoxb-your-slack-bot-token"
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualToken}
                    disabled={savingToken || !manualToken.trim()}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: saveTokenSuccess ? '#10b981' : '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: manualToken.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {saveTokenSuccess ? <Check size={12} /> : null}
                    {savingToken ? 'Saving...' : saveTokenSuccess ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 'gemini':
        return (
          <>
            {/* Model Selector */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Sparkles size={13} color="#8b5cf6" /> Gemini Model
              </label>
              <select
                value={config.model || 'gemini-3.6-flash'}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                }}
              >
                <option value="gemini-3.6-flash">gemini-3.6-flash (Fast & Lightweight - Recommended)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Advanced Reasoning & Complex Tasks)</option>
              </select>
            </div>

            {/* System Prompt (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                System Instructions (Optional)
              </label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                placeholder="e.g. You are a helpful AI assistant that summarizes data into concise bullet points."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
            </div>

            {/* Prompt (Required) */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                User Prompt
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                You can use dynamic template variables like <code>&#123;&#123;steps.&lt;nodeId&gt;.output&#125;&#125;</code> or <code>&#123;&#123;trigger.&lt;field&gt;&#125;&#125;</code>.
              </div>
              <textarea
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="e.g. Please analyze the following customer message and determine the sentiment: {{trigger.message}}"
                rows={5}
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
          </>
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
