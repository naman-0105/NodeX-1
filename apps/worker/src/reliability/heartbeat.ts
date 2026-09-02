import { renewTaskLease } from './lease.js';

export interface HeartbeatManagerOptions {
  readonly taskInstanceId: string;
  readonly workerId: string;
  readonly leaseTtlSeconds?: number;
  readonly onRenewalFailed?: (err: unknown) => void;
}

export class HeartbeatManager {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly options: HeartbeatManagerOptions) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const ttl = this.options.leaseTtlSeconds ?? 30;
    // Renew at 50% of TTL (in milliseconds)
    const intervalMs = Math.max(1000, Math.floor((ttl * 1000) / 2));

    this.timer = setInterval(async () => {
      try {
        const renewed = await renewTaskLease(
          this.options.taskInstanceId,
          this.options.workerId,
          { durationSeconds: ttl }
        );
        if (!renewed && this.options.onRenewalFailed) {
          this.options.onRenewalFailed(
            new Error(`Failed to renew lease for task ${this.options.taskInstanceId}`)
          );
        }
      } catch (err) {
        if (this.options.onRenewalFailed) {
          this.options.onRenewalFailed(err);
        }
      }
    }, intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
