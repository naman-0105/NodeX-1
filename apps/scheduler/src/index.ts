import dotenv from 'dotenv';
import { SchedulerDaemon } from './scheduler.js';

dotenv.config();

export * from './poller.js';
export * from './lease-reclaimer.js';
export * from './scheduler.js';

const daemon = new SchedulerDaemon();

// If run directly as process entrypoint
if (process.env.NODE_ENV !== 'test') {
  daemon.start();

  process.on('SIGTERM', () => {
    daemon.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    daemon.stop();
    process.exit(0);
  });
}
