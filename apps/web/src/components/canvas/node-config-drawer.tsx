import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Hash,
  ExternalLink,
  RefreshCw,
  Check,
  LogOut,
  Sparkles,
  Zap,
  Globe,
  Code2,
  GitFork,
  UserCheck,
  Clock,
  Play,
  Copy,
  Variable,
  Loader2,
} from 'lucide-react';
import {
  fetchSlackChannels,
  fetchIntegrationStatus,
  saveSlackToken,
  disconnectIntegration,
  type SlackChannelOption,
  type IntegrationStatus,
} from '../../api/client.js';
import type { Node, Edge } from '@xyflow/react';

interface NodeConfigDrawerProps {
  readonly node: {
    id: string;
    type: string;
    data: {
      label?: string;
      config?: Record<string, any>;
    };
  } | null;
  readonly nodes?: Node[];
  readonly edges?: Edge[];
  readonly onClose: () => void;
  readonly onSave: (id: string, label: string, config: Record<string, any>) => void;
  readonly onDelete: (id: string) => void;
}

export const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  node,
  nodes = [],
  edges = [],
  onClose,
  onSave,
  onDelete,
}) => {
  if (!node) return null;

  const [activeTab, setActiveTab] = useState<'setup' | 'test'>('setup');
  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState<Record<string, any>>(node.data.config || {});

  // Variable picker state
  const [activeVariableField, setActiveVariableField] = useState<string | null>(null);

  // Slack integration state
  const [slackChannels, setSlackChannels] = useState<SlackChannelOption[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [customChannelMode, setCustomChannelMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [saveTokenSuccess, setSaveTokenSuccess] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Test Step state
  const [testInput, setTestInput] = useState('{\n  "amount": 250,\n  "userId": "usr_9921",\n  "status": "active"\n}');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
    setManualToken('');
    setSaveTokenSuccess(false);
    setTestResult(null);

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

  // Find upstream parent nodes for variable picker
  const upstreamNodeIds = edges
    .filter((e) => e.target === node.id)
    .map((e) => e.source);

  const upstreamNodes = nodes.filter((n) => upstreamNodeIds.includes(n.id));

  const insertVariable = (fieldName: string, varPath: string) => {
    const currentValue = config[fieldName] || '';
    const updated = typeof currentValue === 'string'
      ? `${currentValue}{{${varPath}}}`
      : `{{${varPath}}}`;
    setConfig({ ...config, [fieldName]: updated });
    setActiveVariableField(null);
  };

  const handleRunTestStep = async () => {
    setIsTesting(true);
    try {
      let parsedInput: any = {};
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        parsedInput = { raw: testInput };
      }

      // Simulate isolated node evaluation for test step
      if (node.type === 'http') {
        setTestResult({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: {
            url: config.url || 'https://api.example.com',
            method: config.method || 'GET',
            receivedInput: parsedInput,
            sampleResponse: { success: true, timestamp: new Date().toISOString() },
          },
        });
      } else if (node.type === 'transform') {
        try {
          const fn = new Function('input', 'steps', 'trigger', config.code || 'return input;');
          const res = fn(parsedInput, { sample_step: { output: { id: 101, name: 'Sample' } } }, parsedInput);
          setTestResult({ success: true, output: res });
        } catch (evalErr: any) {
          setTestResult({ success: false, error: evalErr.message });
        }
      } else if (node.type === 'if') {
        try {
          const fn = new Function('input', 'steps', `return Boolean(${config.condition || 'true'});`);
          const evaluation = fn(parsedInput, {});
          setTestResult({
            evaluated: evaluation,
            branch: evaluation ? 'True Branch' : 'False Branch',
            condition: config.condition || 'true',
          });
        } catch (err: any) {
          setTestResult({ success: false, error: err.message });
        }
      } else if (node.type === 'gemini') {
        setTestResult({
          model: config.model || 'gemini-3.6-flash',
          status: 'Sample Prompt Validated',
          generatedText: `[Simulated Gemini Output for: "${(config.prompt || '').substring(0, 40)}..."] Summary: Operations completed successfully without anomalies.`,
        });
      } else {
        setTestResult({
          nodeId: node.id,
          type: node.type,
          configSnapshot: config,
          evaluatedWithInput: parsedInput,
          status: 'READY_FOR_EXECUTION',
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'trigger':
        return <Zap size={16} color="#16a34a" />;
      case 'http':
        return <Globe size={16} color="#2563eb" />;
      case 'transform':
        return <Code2 size={16} color="#d97706" />;
      case 'if':
        return <GitFork size={16} color="#7c3aed" />;
      case 'approval':
        return <UserCheck size={16} color="#ea580c" />;
      case 'delay':
        return <Clock size={16} color="#0891b2" />;
      case 'slack':
        return <Hash size={16} color="#e01e5a" />;
      case 'gemini':
        return <Sparkles size={16} color="#6d28d9" />;
      default:
        return <Zap size={16} color="#0f172a" />;
    }
  };

  const renderVariablePickerDropdown = (fieldName: string) => {
    if (activeVariableField !== fieldName) return null;

    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: '32px',
          width: '280px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          zIndex: 100,
          padding: '8px',
          maxHeight: '260px',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', padding: '4px 6px', textTransform: 'uppercase' }}>
          Available Variables
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            type="button"
            onClick={() => insertVariable(fieldName, 'trigger.payload')}
            style={{
              padding: '6px 8px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontWeight: 600 }}>trigger.payload</span>
            <span style={{ fontSize: '10px', color: '#16a34a' }}>Trigger Data</span>
          </button>

          {upstreamNodes.map((uNode) => (
            <div key={uNode.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                type="button"
                onClick={() => insertVariable(fieldName, `steps.${uNode.id}.output`)}
                style={{
                  padding: '6px 8px',
                  textAlign: 'left',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontWeight: 600 }}>steps.{uNode.id}.output</span>
                <span style={{ fontSize: '10px', color: '#2563eb' }}>
                  {typeof uNode.data?.label === 'string' ? uNode.data.label : uNode.type}
                </span>
              </button>
            </div>
          ))}

          {upstreamNodes.length === 0 && (
            <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 8px' }}>
              Connect upstream nodes to reference their outputs.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case 'trigger':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                Trigger Type
              </label>
              <select
                value={config.triggerType || 'manual'}
                onChange={(e) => setConfig({ ...config, triggerType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              >
                <option value="manual">Manual / API Trigger</option>
                <option value="webhook">Inbound Webhook</option>
                <option value="schedule">Cron Schedule</option>
              </select>
            </div>

            {config.triggerType === 'webhook' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  Webhook URL
                </label>
                <input
                  type="text"
                  readOnly
                  value={`/api/webhooks/workflow_${node.id}`}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'http':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  Method
                </label>
                <select
                  value={config.method || 'GET'}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 600,
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>Endpoint URL</label>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setActiveVariableField(activeVariableField === 'url' ? null : 'url')}
                      style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        color: '#2563eb',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <Variable size={11} /> {'{ + }'}
                    </button>
                    {renderVariablePickerDropdown('url')}
                  </div>
                </div>
                <input
                  type="text"
                  value={config.url || ''}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/v1/resource"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            {/* Request Body */}
            {config.method !== 'GET' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                    Request Body (JSON / Template)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setActiveVariableField(activeVariableField === 'body' ? null : 'body')}
                      style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        color: '#2563eb',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <Variable size={11} /> {'{ + }'}
                    </button>
                    {renderVariablePickerDropdown('body')}
                  </div>
                </div>
                <textarea
                  value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : config.body || ''}
                  onChange={(e) => {
                    try {
                      setConfig({ ...config, body: JSON.parse(e.target.value) });
                    } catch {
                      setConfig({ ...config, body: e.target.value });
                    }
                  }}
                  rows={6}
                  placeholder='{\n  "userId": "{{trigger.userId}}"\n}'
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.4',
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'transform':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                  Sandbox JavaScript Function
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Deterministic V8 Sandbox</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Available in scope: <code>input</code>, <code>steps.&lt;nodeId&gt;.output</code>, and <code>trigger</code>.
              </div>
              <textarea
                value={config.code || 'return {\n  processed: true,\n  output: input\n};'}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                rows={10}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.4',
                }}
              />
            </div>
          </div>
        );

      case 'if':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                  Branch Condition Expression
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setActiveVariableField(activeVariableField === 'condition' ? null : 'condition')}
                    style={{
                      background: 'none',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#7c3aed',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <Variable size={11} /> {'{ + }'}
                  </button>
                  {renderVariablePickerDropdown('condition')}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Must evaluate to a boolean. e.g. <code>steps.http_fetch.output.status === 200 && input.amount &gt; 100</code>
              </div>
              <input
                type="text"
                value={config.condition || ''}
                onChange={(e) => setConfig({ ...config, condition: e.target.value })}
                placeholder="steps.step_1.output.valid === true"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        );

      case 'approval':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                Instructions for Approver
              </label>
              <textarea
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Please review transaction amount and confirm approval."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                Assigned Approvers (Comma-separated emails or roles)
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
                placeholder="finance-team@company.com, admin_lead"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                Pause Duration (Seconds)
              </label>
              <input
                type="number"
                value={config.durationSeconds || 60}
                onChange={(e) => setConfig({ ...config, durationSeconds: Number(e.target.value) })}
                min={1}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>
        );

      case 'slack':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Channel Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={13} color="#e01e5a" /> Target Channel
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCustomChannelMode(!customChannelMode)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    {customChannelMode ? 'Choose from list' : 'Custom / Variable'}
                  </button>
                  <button
                    type="button"
                    onClick={loadSlackDetails}
                    title="Refresh channel list"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <RefreshCw size={12} className={loadingChannels ? 'animate-spin' : ''} />
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
                    padding: '8px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
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
                    padding: '8px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>Message Content</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setActiveVariableField(activeVariableField === 'message' ? null : 'message')}
                    style={{
                      background: 'none',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#e01e5a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <Variable size={11} /> {'{ + }'}
                  </button>
                  {renderVariablePickerDropdown('message')}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Supports dynamic templates: <code>&#123;&#123;trigger.amount&#125;&#125;</code> or <code>steps.&lt;id&gt;.output</code>
              </div>
              <textarea
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Alert: New order received for ${{trigger.amount}}"
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
            </div>

            {/* Credential Vault Box */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                  Slack OAuth & Credentials
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: integrationStatus?.slack?.connected ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${integrationStatus?.slack?.connected ? '#bbf7d0' : '#fecaca'}`,
                    color: integrationStatus?.slack?.connected ? '#166534' : '#991b1b',
                    fontWeight: 600,
                  }}
                >
                  {integrationStatus?.slack?.connected
                    ? `Connected (${integrationStatus.slack.teamName || 'Active'})`
                    : 'Not Connected'}
                </span>
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
                        backgroundColor: '#ffffff',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
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
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#0f172a',
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
                      padding: '7px 12px',
                      backgroundColor: '#e01e5a',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <ExternalLink size={13} /> Connect via Slack OAuth
                  </button>
                )}
              </div>

              {/* Bot User Token Input */}
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
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
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualToken}
                    disabled={savingToken || !manualToken.trim()}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: saveTokenSuccess ? '#16a34a' : '#0f172a',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
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
          </div>
        );

      case 'gemini':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Sparkles size={13} color="#6d28d9" /> Gemini Model
              </label>
              <select
                value={config.model || 'gemini-3.6-flash'}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              >
                <option value="gemini-3.6-flash">gemini-3.6-flash (Fast & Lightweight - Recommended)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Advanced Reasoning & Multi-step Logic)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                System Instructions (Optional)
              </label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                placeholder="e.g. You are an expert data validator. Format responses as strict JSON."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>User Prompt</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setActiveVariableField(activeVariableField === 'prompt' ? null : 'prompt')}
                    style={{
                      background: 'none',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#6d28d9',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <Variable size={11} /> {'{ + }'}
                  </button>
                  {renderVariablePickerDropdown('prompt')}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Use variables like <code>&#123;&#123;steps.&lt;nodeId&gt;.output&#125;&#125;</code> or <code>&#123;&#123;trigger.&lt;key&gt;&#125;&#125;</code>.
              </div>
              <textarea
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Analyze this payload: {{steps.http_fetch.output}}"
                rows={5}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        );

      default:
        return (
          <div style={{ color: '#64748b', fontSize: '12px', padding: '12px 0' }}>
            No additional configuration options needed for this node.
          </div>
        );
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
          backgroundColor: 'rgba(15, 23, 42, 0.25)',
          zIndex: 900,
        }}
      />

      {/* Slide-Over Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
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
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getNodeIcon()}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {label || node.data.label || node.type}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                ID: {node.id}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {node.type}
            </span>
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
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '0 18px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: activeTab === 'setup' ? '#0f172a' : '#64748b',
              borderBottom: activeTab === 'setup' ? '2px solid #0f172a' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
          >
            Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: activeTab === 'test' ? '#0f172a' : '#64748b',
              borderBottom: activeTab === 'test' ? '2px solid #0f172a' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
          >
            Test Step
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '18px', flex: 1, overflowY: 'auto' }}>
          {activeTab === 'setup' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  Node Display Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Fetch Active Orders"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                  }}
                />
              </div>

              {renderConfigFields()}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  Sample Input Payload (JSON)
                </label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleRunTestStep}
                disabled={isTesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isTesting ? 'not-allowed' : 'pointer',
                }}
              >
                {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="#ffffff" />}
                {isTesting ? 'Testing Step...' : 'Test this step'}
              </button>

              {testResult && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>Test Output Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
                        setCopiedOutput(true);
                        setTimeout(() => setCopiedOutput(false), 2000);
                      }}
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
                      {copiedOutput ? 'Copied' : 'Copy Output'}
                    </button>
                  </div>
                  <pre
                    style={{
                      padding: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#0f172a',
                      fontFamily: 'monospace',
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <Trash2 size={14} /> Delete
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                backgroundColor: '#0f172a',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
