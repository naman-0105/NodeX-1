import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisInstance: Redis | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

export function getRedisConnection(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    redisInstance.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }
  return redisInstance;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
