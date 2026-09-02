import { db, idempotencyKeys, eq, and } from '@nodex/db';

export interface IdempotencyCheckResult {
  readonly alreadyExecuted: boolean;
  readonly resultSnapshot?: unknown;
}

/**
 * Checks if a composite operation (executionId + nodeId + logicalOperationId) has already been performed.
 */
export async function checkIdempotency(
  executionId: string,
  nodeId: string,
  logicalOperationId: string
): Promise<IdempotencyCheckResult> {
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.executionId, executionId),
        eq(idempotencyKeys.nodeId, nodeId),
        eq(idempotencyKeys.logicalOperationId, logicalOperationId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      alreadyExecuted: true,
      resultSnapshot: existing[0].resultSnapshot,
    };
  }

  return {
    alreadyExecuted: false,
  };
}

/**
 * Records an idempotency snapshot atomically in PostgreSQL.
 */
export async function recordIdempotency(
  executionId: string,
  nodeId: string,
  logicalOperationId: string,
  resultSnapshot: unknown
): Promise<void> {
  await db.insert(idempotencyKeys).values({
    executionId,
    nodeId,
    logicalOperationId,
    resultSnapshot,
  });
}
