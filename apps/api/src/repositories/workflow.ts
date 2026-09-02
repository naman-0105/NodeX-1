import {
  db,
  withTransaction,
  workflows,
  workflowVersions,
  eq,
  desc,
  and,
  sql,
} from '@nodex/db';
import type { WorkflowDefinition } from '@nodex/shared';

export async function createWorkflowWithInitialVersion(
  ownerId: string,
  name: string,
  definition: WorkflowDefinition
) {
  return withTransaction(async (tx) => {
    // 1. Create workflow
    const [wf] = await tx
      .insert(workflows)
      .values({
        ownerId,
        name,
        active: true,
      })
      .returning();

    // 2. Create version 1
    const [ver] = await tx
      .insert(workflowVersions)
      .values({
        workflowId: wf.id,
        version: 1,
        definitionJson: definition,
      })
      .returning();

    // 3. Point current_version_id to version 1
    const [updatedWf] = await tx
      .update(workflows)
      .set({
        currentVersionId: ver.id,
        updatedAt: sql`NOW()`,
      })
      .where(eq(workflows.id, wf.id))
      .returning();

    return {
      workflow: updatedWf,
      version: ver,
    };
  });
}

export async function getWorkflowById(id: string) {
  const [wf] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);
  return wf || null;
}

export async function getWorkflowWithVersion(id: string) {
  const rows = await db
    .select({
      workflow: workflows,
      currentVersion: workflowVersions,
    })
    .from(workflows)
    .leftJoin(
      workflowVersions,
      eq(workflows.currentVersionId, workflowVersions.id)
    )
    .where(eq(workflows.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0];
}

export async function listWorkflows(ownerId?: string) {
  if (ownerId) {
    return db
      .select()
      .from(workflows)
      .where(eq(workflows.ownerId, ownerId))
      .orderBy(desc(workflows.createdAt));
  }
  return db
    .select()
    .from(workflows)
    .orderBy(desc(workflows.createdAt));
}

export async function updateWorkflowMetadata(
  id: string,
  updates: { name?: string; active?: boolean }
) {
  const setPayload: Record<string, unknown> = { updatedAt: sql`NOW()` };
  if (updates.name !== undefined) setPayload.name = updates.name;
  if (updates.active !== undefined) setPayload.active = updates.active;

  const [updated] = await db
    .update(workflows)
    .set(setPayload)
    .where(eq(workflows.id, id))
    .returning();

  return updated || null;
}

export async function createWorkflowVersion(
  workflowId: string,
  definition: WorkflowDefinition
) {
  return withTransaction(async (tx) => {
    // 1. Determine next version number
    const [latestVersionRow] = await tx
      .select({ version: workflowVersions.version })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.version))
      .limit(1);

    const nextVersionNumber = (latestVersionRow?.version ?? 0) + 1;

    // 2. Insert immutable workflow version
    const [newVersion] = await tx
      .insert(workflowVersions)
      .values({
        workflowId,
        version: nextVersionNumber,
        definitionJson: definition,
      })
      .returning();

    // 3. Update currentVersionId on workflows table
    const [updatedWf] = await tx
      .update(workflows)
      .set({
        currentVersionId: newVersion.id,
        updatedAt: sql`NOW()`,
      })
      .where(eq(workflows.id, workflowId))
      .returning();

    return {
      workflow: updatedWf,
      version: newVersion,
    };
  });
}

export async function listWorkflowVersions(workflowId: string) {
  return db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.version));
}

export async function getWorkflowVersion(workflowId: string, versionId: string) {
  const [ver] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.id, versionId)
      )
    )
    .limit(1);
  return ver || null;
}
