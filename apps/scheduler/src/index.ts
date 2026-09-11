import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { SchedulerDaemon } from './scheduler.js';

// Load .env from current directory and parent workspace roots
let currentDir = process.cwd();
for (let i = 0; i < 4; i++) {
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  const parent = path.dirname(currentDir);
  if (parent === currentDir) break;
  currentDir = parent;
}

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
