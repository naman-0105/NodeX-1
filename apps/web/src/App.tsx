import { useState, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowDefinition } from '@nodex/shared';
import { Navbar } from './components/common/navbar.js';
import { WorkflowCanvas } from './components/canvas/workflow-canvas.js';
import { ExecutionDebugger } from './components/debugger/execution-debugger.js';
import { RunsHistoryDrawer } from './components/debugger/runs-history-drawer.js';
import {
  fetchWorkflows,
  fetchWorkflow,
  createWorkflow,
  updateWorkflow,
  publishWorkflowVersion,
  triggerWorkflow,
  type WorkflowSummary,
} from './api/client.js';

const DEFAULT_STARTER_DEFINITION: WorkflowDefinition = {
  nodes: [
    {
      id: 'start',
      type: 'trigger',
      config: { triggerType: 'manual' },
      position: { x: 100, y: 180 },
    },
    {
      id: 'http_fetch',
      type: 'http',
      config: { url: 'https://httpbin.org/get', method: 'GET' },
      position: { x: 380, y: 180 },
    },
    {
      id: 'transform_json',
      type: 'transform',
      config: { code: 'return {\n  processed: true,\n  origin: steps.http_fetch.output?.origin || "unknown",\n  timestamp: new Date().toISOString()\n};' },
      position: { x: 660, y: 180 },
    },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http_fetch' },
    { id: 'e2', source: 'http_fetch', target: 'transform_json' },
  ],
};

export function App() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | undefined>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);
  const [isRunsHistoryOpen, setIsRunsHistoryOpen] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  // 1. Initial load of workflows from API
  useEffect(() => {
    async function loadWorkflows() {
      try {
        const list = await fetchWorkflows();
        if (list.length > 0) {
          setWorkflows(list);
          setCurrentWorkflowId(list[0].id);
        } else {
          // Create initial starter workflow
          const created = await createWorkflow('Order Ingestion Pipeline', DEFAULT_STARTER_DEFINITION);
          setWorkflows([created.workflow]);
          setCurrentWorkflowId(created.workflow.id);
        }
      } catch (err) {
        console.warn('Could not fetch workflows from API. Using local starter workflow.', err);
        setNodes(
          DEFAULT_STARTER_DEFINITION.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position ? { x: n.position.x, y: n.position.y } : { x: 200, y: 200 },
            data: { label: n.id, config: n.config },
          }))
        );
        setEdges(DEFAULT_STARTER_DEFINITION.edges.map((e) => ({ ...e })));
      }
    }
    loadWorkflows();
  }, []);

  // 2. Load workflow details when currentWorkflowId changes
  useEffect(() => {
    if (!currentWorkflowId) return;

    async function loadCurrentWorkflow() {
      try {
        const details = await fetchWorkflow(currentWorkflowId!);
        setCurrentVersionNumber(details.currentVersion?.version);
        const def = details.currentVersion?.definitionJson;
        if (def) {
          setNodes(
            def.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position ? { x: n.position.x, y: n.position.y } : { x: 200, y: 200 },
              data: { label: n.id, config: n.config || {} },
            }))
          );
          setEdges(def.edges.map((e) => ({ ...e })));
        }
      } catch (err) {
        console.error('Failed to load workflow details:', err);
      }
    }

    loadCurrentWorkflow();
  }, [currentWorkflowId]);

  const handleNewWorkflow = async () => {
    const name = prompt('Enter new workflow name:', `Workflow ${workflows.length + 1}`);
    if (!name) return;

    try {
      const created = await createWorkflow(name, DEFAULT_STARTER_DEFINITION);
      setWorkflows([created.workflow, ...workflows]);
      setCurrentWorkflowId(created.workflow.id);
    } catch (err: any) {
      alert(`Error creating workflow: ${err.message}`);
    }
  };

  const handleRenameWorkflow = async (id: string, newName: string) => {
    const updated = await updateWorkflow(id, { name: newName });
    setWorkflows(workflows.map((w) => (w.id === id ? { ...w, name: updated.name } : w)));
  };

  const handlePublishVersion = async () => {
    if (!currentWorkflowId) return;

    const definition: WorkflowDefinition = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'transform',
        config: ((n.data?.config as Record<string, unknown>) || {}),
        position: n.position ? { x: n.position.x, y: n.position.y } : undefined,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
      })),
    };

    try {
      const updated = await publishWorkflowVersion(currentWorkflowId, definition);
      const versionNum = updated.currentVersion?.version ?? (updated as any).version?.version ?? 1;
      setCurrentVersionNumber(versionNum);
      alert(`Successfully published version v${versionNum}!`);
    } catch (err: any) {
      alert(`Error publishing version: ${err.message}`);
    }
  };

  const handleTriggerExecution = async () => {
    if (!currentWorkflowId) return;

    setIsTriggering(true);
    try {
      const res = await triggerWorkflow(currentWorkflowId, 'manual', {});
      setActiveExecutionId(res.executionId);
      setIsDebuggerOpen(true);
    } catch (err: any) {
      alert(`Error triggering execution: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      <Navbar
        workflows={workflows}
        currentWorkflowId={currentWorkflowId}
        onSelectWorkflow={(id) => {
          setCurrentWorkflowId(id);
          setIsDebuggerOpen(false);
        }}
        onNewWorkflow={handleNewWorkflow}
        onRenameWorkflow={handleRenameWorkflow}
        onPublishVersion={handlePublishVersion}
        onTriggerExecution={handleTriggerExecution}
        currentVersionNumber={currentVersionNumber}
        isTriggering={isTriggering}
        activeExecutionId={activeExecutionId}
        onToggleDebugger={() => setIsDebuggerOpen(!isDebuggerOpen)}
        onToggleRunsHistory={() => setIsRunsHistoryOpen(!isRunsHistoryOpen)}
        isRunsHistoryOpen={isRunsHistoryOpen}
      />

      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isDebuggerOpen && activeExecutionId ? (
          <ExecutionDebugger
            executionId={activeExecutionId}
            nodes={nodes}
            edges={edges}
            onClose={() => setIsDebuggerOpen(false)}
          />
        ) : (
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
          />
        )}
      </main>

      {/* Runs History Drawer */}
      <RunsHistoryDrawer
        workflowId={currentWorkflowId}
        isOpen={isRunsHistoryOpen}
        activeExecutionId={activeExecutionId}
        onClose={() => setIsRunsHistoryOpen(false)}
        onSelectExecution={(execId) => {
          setActiveExecutionId(execId);
          setIsDebuggerOpen(true);
        }}
      />
    </div>
  );
}
