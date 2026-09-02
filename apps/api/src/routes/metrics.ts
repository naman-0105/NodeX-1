import { Router, type Router as RouterType } from 'express';
import {
  db,
  checkHealth,
  executions,
  outboxEvents,
  deadLetterTasks,
  workflowSchedules,
  sql,
  eq,
} from '@nodex/db';

export const metricsRouter: RouterType = Router();

metricsRouter.get('/', async (_req, res, next) => {
  try {
    const isDbHealthy = await checkHealth();

    // 1. Unpublished outbox backlog
    const [outboxLag] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(sql`published_at IS NULL`);

    // 2. Pending dead letter tasks
    const [dlqCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterTasks)
      .where(eq(deadLetterTasks.replayStatus, 'PENDING'));

    // 3. Execution counts grouped by status
    const statusCounts = await db
      .select({
        status: executions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(executions)
      .groupBy(executions.status);

    // 4. Enabled schedules count
    const [enabledSchedules] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowSchedules)
      .where(eq(workflowSchedules.enabled, true));

    res.json({
      status: isDbHealthy ? 'healthy' : 'degraded',
      database: isDbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      metrics: {
        outboxUnpublishedCount: outboxLag?.count ?? 0,
        pendingDeadLettersCount: dlqCount?.count ?? 0,
        enabledSchedulesCount: enabledSchedules?.count ?? 0,
        executionsByStatus: Object.fromEntries(
          statusCounts.map((s) => [s.status, s.count])
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});
