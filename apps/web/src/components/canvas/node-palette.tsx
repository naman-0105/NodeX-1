import React from 'react';
import { Play, Globe, Code, GitFork, UserCheck, Clock, Hash, Plus } from 'lucide-react';

interface NodePaletteProps {
  readonly onAddNode: (type: string, label: string) => void;
}

const PALETTE_ITEMS = [
  { type: 'trigger', label: 'Trigger', icon: Play, color: '#10b981', desc: 'Workflow entry point' },
  { type: 'http', label: 'HTTP Request', icon: Globe, color: '#3b82f6', desc: 'Fetch API or webhook call' },
  { type: 'transform', label: 'Transform (JS)', icon: Code, color: '#f59e0b', desc: 'Isolated sandbox script' },
  { type: 'if', label: 'IF Condition', icon: GitFork, color: '#a855f7', desc: 'Branch True / False' },
  { type: 'approval', label: 'Human Approval', icon: UserCheck, color: '#f97316', desc: 'Pause for human decision' },
  { type: 'delay', label: 'Delay / Wait', icon: Clock, color: '#06b6d4', desc: 'Timer-based non-blocking pause' },
  { type: 'slack', label: 'Slack Message', icon: Hash, color: '#e01e5a', desc: 'Post message to channel' },
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  return (
    <div
      style={{
        width: '240px',
        backgroundColor: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '16px',
        gap: '12px',
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Node Library
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => onAddNode(item.type, item.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = item.color;
                e.currentTarget.style.backgroundColor = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.backgroundColor = '#0f172a';
              }}
            >
              <div
                style={{
                  backgroundColor: `${item.color}20`,
                  color: item.color,
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                }}
              >
                <Icon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.desc}</div>
              </div>
              <Plus size={14} color="#64748b" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
