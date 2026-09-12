import React, { useState } from 'react';
import {
  Zap,
  Globe,
  Code2,
  GitFork,
  UserCheck,
  Clock,
  Hash,
  Sparkles,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface NodePaletteProps {
  readonly onAddNode: (type: string, label: string) => void;
}

interface PaletteItem {
  type: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  desc: string;
  category: 'Triggers' | 'Integrations & AI' | 'Logic & Flow';
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'trigger',
    label: 'Webhook / Manual',
    icon: Zap,
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#dcfce7',
    desc: 'Workflow entry point',
    category: 'Triggers',
  },
  {
    type: 'http',
    label: 'HTTP Request',
    icon: Globe,
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#dbeafe',
    desc: 'Fetch REST API or webhook',
    category: 'Integrations & AI',
  },
  {
    type: 'slack',
    label: 'Slack Message',
    icon: Hash,
    color: '#e01e5a',
    bgColor: '#fdf2f8',
    borderColor: '#fce7f3',
    desc: 'Post to Slack channel',
    category: 'Integrations & AI',
  },
  {
    type: 'gemini',
    label: 'Gemini AI',
    icon: Sparkles,
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    borderColor: '#ede9fe',
    desc: 'Generate content with Gemini',
    category: 'Integrations & AI',
  },
  {
    type: 'transform',
    label: 'Transform (JS)',
    icon: Code2,
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fef3c7',
    desc: 'Isolated JS sandbox script',
    category: 'Logic & Flow',
  },
  {
    type: 'if',
    label: 'IF Condition',
    icon: GitFork,
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ede9fe',
    desc: 'Branch True / False path',
    category: 'Logic & Flow',
  },
  {
    type: 'approval',
    label: 'Human Approval',
    icon: UserCheck,
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#ffedd5',
    desc: 'Pause for human decision',
    category: 'Logic & Flow',
  },
  {
    type: 'delay',
    label: 'Delay / Wait',
    icon: Clock,
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#cffafe',
    desc: 'Non-blocking timer pause',
    category: 'Logic & Flow',
  },
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [search, setSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredItems = PALETTE_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.desc.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories: Array<'Triggers' | 'Integrations & AI' | 'Logic & Flow'> = [
    'Triggers',
    'Integrations & AI',
    'Logic & Flow',
  ];

  if (isCollapsed) {
    return (
      <div
        style={{
          width: '40px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '12px',
          height: '100%',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Expand Node Library"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        zIndex: 10,
        boxShadow: '1px 0 2px 0 rgb(0 0 0 / 0.02)',
      }}
    >
      {/* Header & Search */}
      <div
        style={{
          padding: '12px 14px 10px 14px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Node Library
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
            }}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Search Box */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={13}
            color="#94a3b8"
            style={{ position: 'absolute', left: '8px', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            style={{
              width: '100%',
              padding: '6px 8px 6px 26px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Categorized List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {categories.map((cat) => {
          const items = filteredItems.filter((i) => i.category === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  padding: '0 4px 4px 4px',
                }}
              >
                {cat}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => onAddNode(item.type, item.label)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid transparent',
                        borderRadius: '6px',
                        color: '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          backgroundColor: item.bgColor,
                          border: `1px solid ${item.borderColor}`,
                          color: item.color,
                          borderRadius: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={14} />
                      </div>

                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.desc}
                        </div>
                      </div>

                      <Plus size={13} color="#94a3b8" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '12px',
            }}
          >
            No nodes found matching "{search}"
          </div>
        )}
      </div>
    </aside>
  );
};
