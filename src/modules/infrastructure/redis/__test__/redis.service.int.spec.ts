import { setTimeout as sleep } from 'node:timers/promises';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from 'test/setup/test-app';
import { RedisClient } from '../redis.client';
import { RedisService } from '../redis.service';

const SHORT_TTL_MS = 300;
const EXPIRY_WAIT_MS = 400;
const LOCK_TTL_MS = 10_000;
const EXTENDED_LOCK_TTL_MS = 60_000;
const OWNER_TOKEN = 'owner-token';
const OTHER_TOKEN = 'other-token';

let nextKeyId = 400_000_000;

describe('RedisService', () => {
  let app: NestFastifyApplication;
  let redisService: RedisService;
  let redisClient: RedisClient;

  beforeAll(async () => {
    app = await createTestApp();
    redisService = app.get(RedisService);
    redisClient = app.get(RedisClient);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueKey() {
    return `test:redis:${nextKeyId++}`;
  }

  function ttlOf(key: string) {
    return redisClient.instance.pttl(key);
  }

  it('stores a value without expiry until it is deleted', async () => {
    const key = uniqueKey();

    await redisService.set(key, 'value');

    expect(await redisService.get(key)).toBe('value');
    expect(await ttlOf(key)).toBe(-1);

    await redisService.delete(key);

    expect(await redisService.get(key)).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await redisService.get(uniqueKey())).toBeNull();
  });

  it('expires a value after its ttl', async () => {
    const key = uniqueKey();

    await redisService.set(key, 'value', SHORT_TTL_MS);

    expect(await redisService.get(key)).toBe('value');
    const ttl = await ttlOf(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(SHORT_TTL_MS);

    await sleep(EXPIRY_WAIT_MS);

    expect(await redisService.get(key)).toBeNull();
  });

  it('acquires a free lock with its ttl', async () => {
    const key = uniqueKey();

    expect(await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS)).toBe(
      true,
    );

    expect(await redisService.get(key)).toBe(OWNER_TOKEN);
    const ttl = await ttlOf(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(LOCK_TTL_MS);
  });

  it('refuses a lock held by another token', async () => {
    const key = uniqueKey();
    await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS);

    expect(
      await redisService.acquireLock(key, OTHER_TOKEN, EXTENDED_LOCK_TTL_MS),
    ).toBe(false);

    expect(await redisService.get(key)).toBe(OWNER_TOKEN);
    expect(await ttlOf(key)).toBeLessThanOrEqual(LOCK_TTL_MS);
  });

  it('extends the lock of its owner and refreshes the ttl', async () => {
    const key = uniqueKey();
    await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS);

    expect(
      await redisService.acquireLock(key, OWNER_TOKEN, EXTENDED_LOCK_TTL_MS),
    ).toBe(true);

    expect(await redisService.get(key)).toBe(OWNER_TOKEN);
    const ttl = await ttlOf(key);
    expect(ttl).toBeGreaterThan(LOCK_TTL_MS);
    expect(ttl).toBeLessThanOrEqual(EXTENDED_LOCK_TTL_MS);
  });

  it('keeps a lock released with another token', async () => {
    const key = uniqueKey();
    await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS);

    await redisService.releaseLock(key, OTHER_TOKEN);

    expect(await redisService.get(key)).toBe(OWNER_TOKEN);
    expect(await redisService.acquireLock(key, OTHER_TOKEN, LOCK_TTL_MS)).toBe(
      false,
    );
  });

  it('deletes a lock released by its owner', async () => {
    const key = uniqueKey();
    await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS);

    await redisService.releaseLock(key, OWNER_TOKEN);

    expect(await redisService.get(key)).toBeNull();
    expect(await redisService.acquireLock(key, OTHER_TOKEN, LOCK_TTL_MS)).toBe(
      true,
    );
  });

  it('hands an expired lock to another token', async () => {
    const key = uniqueKey();
    await redisService.acquireLock(key, OWNER_TOKEN, SHORT_TTL_MS);

    await sleep(EXPIRY_WAIT_MS);

    expect(await redisService.acquireLock(key, OTHER_TOKEN, LOCK_TTL_MS)).toBe(
      true,
    );
    expect(await redisService.acquireLock(key, OWNER_TOKEN, LOCK_TTL_MS)).toBe(
      false,
    );
    expect(await redisService.get(key)).toBe(OTHER_TOKEN);
  });
});
