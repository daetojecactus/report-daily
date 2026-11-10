import { Injectable } from '@nestjs/common';
import {
  REDIS_ACQUIRE_LOCK_SCRIPT,
  REDIS_INCREMENT_SCRIPT,
  REDIS_RELEASE_LOCK_SCRIPT,
} from './constants/redis.constants';
import { RedisClient } from './redis.client';

@Injectable()
export class RedisService {
  constructor(private readonly redisClient: RedisClient) {}

  ping() {
    return this.redisClient.instance.ping();
  }

  get(key: string) {
    return this.redisClient.instance.get(key);
  }

  async set(key: string, value: string, ttlMs?: number) {
    if (ttlMs === undefined) {
      await this.redisClient.instance.set(key, value);
      return;
    }
    await this.redisClient.instance.set(key, value, 'PX', ttlMs);
  }

  async claim(key: string, ttlMs: number) {
    return (await this.redisClient.instance.set(key, '1', 'PX', ttlMs, 'NX')) !== null;
  }

  async increment(key: string, ttlMs: number) {
    return Number(await this.redisClient.instance.eval(REDIS_INCREMENT_SCRIPT, 1, key, ttlMs));
  }

  getTtlMs(key: string) {
    return this.redisClient.instance.pttl(key);
  }

  async delete(key: string) {
    await this.redisClient.instance.del(key);
  }

  async acquireLock(key: string, token: string, ttlMs: number) {
    const result = await this.redisClient.instance.eval(
      REDIS_ACQUIRE_LOCK_SCRIPT,
      1,
      key,
      token,
      ttlMs,
    );
    return result === 1;
  }

  async releaseLock(key: string, token: string) {
    await this.redisClient.instance.eval(REDIS_RELEASE_LOCK_SCRIPT, 1, key, token);
  }
}
