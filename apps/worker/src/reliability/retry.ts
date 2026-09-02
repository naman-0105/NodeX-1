export interface RetryPolicy {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * Calculates exponential backoff with full jitter to avoid retry storms.
 */
export function calculateBackoffWithJitter(
  attempt: number,
  policy: RetryPolicy = {}
): number {
  const baseDelay = policy.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs;
  const maxDelay = policy.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs;

  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  // Full jitter: random duration between 0 and exponentialDelay
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Determines whether a failed task is eligible for retry.
 */
export function shouldRetryTask(
  attempt: number,
  errorDetails?: { retriable?: boolean },
  policy: RetryPolicy = {}
): boolean {
  const maxAttempts = policy.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts;

  // Non-retriable errors fail immediately
  if (errorDetails?.retriable === false) {
    return false;
  }

  return attempt < maxAttempts;
}
