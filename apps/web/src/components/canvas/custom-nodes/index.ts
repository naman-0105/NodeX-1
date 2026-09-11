import type { NodeTypes } from '@xyflow/react';
import { TriggerNode } from './trigger-node.js';
import { HttpNode } from './http-node.js';
import { TransformNode } from './transform-node.js';
import { IfNode } from './if-node.js';
import { ApprovalNode } from './approval-node.js';
import { DelayNode } from './delay-node.js';
import { SlackNode } from './slack-node.js';

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  http: HttpNode,
  transform: TransformNode,
  if: IfNode,
  approval: ApprovalNode,
  delay: DelayNode,
  slack: SlackNode,
};

export * from './trigger-node.js';
export * from './http-node.js';
export * from './transform-node.js';
export * from './if-node.js';
export * from './approval-node.js';
export * from './delay-node.js';
export * from './slack-node.js';
export * from './node-badge.js';
