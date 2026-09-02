import { SchedulePollerService, type SchedulePollerOptions } from './poller.js';
import { LeaseReclaimerService, type LeaseReclaimerOptions } from './lease-reclaimer.js';

export interface SchedulerDaemonOptions {
  readonly pollerOptions?: SchedulePollerOptions;
  readonly reclaimerOptions?: LeaseReclaimerOptions;
}

export class SchedulerDaemon {
  private readonly poller: SchedulePollerService;
  private readonly reclaimer: LeaseReclaimerService;

  constructor(options: SchedulerDaemonOptions = {}) {
    this.poller = new SchedulePollerService(options.pollerOptions);
    this.reclaimer = new LeaseReclaimerService(options.reclaimerOptions);
  }

  start(): void {
    console.log('Starting NodeX Scheduler Daemon...');
    this.poller.start();
    this.reclaimer.start();
    console.log('NodeX Scheduler Daemon active.');
  }

  stop(): void {
    console.log('Stopping NodeX Scheduler Daemon...');
    this.poller.stop();
    this.reclaimer.stop();
    console.log('NodeX Scheduler Daemon stopped.');
  }
}
