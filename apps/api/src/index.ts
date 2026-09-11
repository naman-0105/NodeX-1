import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createApp } from './app.js';

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

const port = parseInt(process.env.API_PORT || '3000', 10);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`NodeX API Service running on http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

export { app, server };
