import dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config();

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
