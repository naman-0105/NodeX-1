export interface WorkflowNodeDefinition {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  readonly config: Record<string, unknown>;
  readonly position?: { readonly x: number; readonly y: number };
}

export interface WorkflowEdgeDefinition {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
}

export interface WorkflowDefinition {
  readonly nodes: readonly WorkflowNodeDefinition[];
  readonly edges: readonly WorkflowEdgeDefinition[];
}

export interface CreateWorkflowRequest {
  readonly name: string;
  readonly definition: WorkflowDefinition;
}

export interface UpdateWorkflowRequest {
  readonly name?: string;
  readonly active?: boolean;
  readonly definition?: WorkflowDefinition;
}

export interface WorkflowResponse {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly active: boolean;
  readonly currentVersionId?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowVersionResponse {
  readonly id: string;
  readonly workflowId: string;
  readonly version: number;
  readonly definition: WorkflowDefinition;
  readonly createdAt: string;
}
