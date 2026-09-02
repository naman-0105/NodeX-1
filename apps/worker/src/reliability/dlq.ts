import { db, deadLetterTasks } from '@nodex/db';

export async function moveToDeadLetter(
  taskInstanceId: string,
  executionId: string,
  finalError: unknown
): Promise<string> {
  const [dlqEntry] = await db
    .insert(deadLetterTasks)
    .values({
      taskInstanceId,
      executionId,
      finalError,
      replayStatus: 'PENDING',
    })
    .returning({ id: deadLetterTasks.id });

  return dlqEntry.id;
}
