import type { WorkflowNode } from '@nodex/shared';
import { TriggerNode } from './trigger.js';
import { HttpNode } from './http.js';
import { TransformNode } from './transform.js';
import { IfNode } from './if.js';
import { ApprovalNode } from './approval.js';
import { DelayNode } from './delay.js';
import { SlackNode } from './slack.js';

export class NodeRegistry {
  private readonly nodes = new Map<string, WorkflowNode>();

  register(node: WorkflowNode): void {
    if (this.nodes.has(node.type)) {
      throw new Error(`Node type already registered: ${node.type}`);
    }
    this.nodes.set(node.type, node);
  }

  get(type: string): WorkflowNode {
    const node = this.nodes.get(type);
    if (!node) {
      throw new Error(`Unrecognized node type: "${type}". Ensure it is registered in NodeRegistry.`);
    }
    return node;
  }

  has(type: string): boolean {
    return this.nodes.has(type);
  }

  list(): string[] {
    return Array.from(this.nodes.keys());
  }
}

export function createDefaultNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(new TriggerNode());
  registry.register(new HttpNode());
  registry.register(new TransformNode());
  registry.register(new IfNode());
  registry.register(new ApprovalNode());
  registry.register(new DelayNode());
  registry.register(new SlackNode());
  return registry;
}

export const defaultNodeRegistry = createDefaultNodeRegistry();
