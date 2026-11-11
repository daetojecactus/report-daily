import { Logger } from '@nestjs/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { SYSTEM_HEALTH_TIMEOUT_MS } from '../constants/system.constants';
import { DependencyStatus, HealthStatus } from '../types/system.enums';
import { SystemService } from '../system.service';

function ping(isAvailable: boolean) {
  return () => (isAvailable ? Promise.resolve() : Promise.reject(new Error('unavailable')));
}

function createService(
  isDatabaseAvailable: boolean,
  isRedisAvailable: boolean,
  redisPing = ping(isRedisAvailable),
) {
  const databaseService = { ping: ping(isDatabaseAvailable) };
  const redisService = { ping: redisPing };

  return new SystemService(
    databaseService as unknown as DatabaseService,
    redisService as unknown as RedisService,
  );
}

describe('SystemService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports ok when database and redis respond', async () => {
    await expect(createService(true, true).getHealth()).resolves.toEqual({
      status: HealthStatus.OK,
      database: DependencyStatus.CONNECTED,
      redis: DependencyStatus.CONNECTED,
    });
  });

  it('reports degraded when a dependency fails', async () => {
    await expect(createService(true, false).getHealth()).resolves.toEqual({
      status: HealthStatus.DEGRADED,
      database: DependencyStatus.CONNECTED,
      redis: DependencyStatus.DISCONNECTED,
    });
    await expect(createService(false, true).getHealth()).resolves.toEqual({
      status: HealthStatus.DEGRADED,
      database: DependencyStatus.DISCONNECTED,
      redis: DependencyStatus.CONNECTED,
    });
  });

  it('reports a dependency that does not answer in time as disconnected', async () => {
    vi.useFakeTimers();
    const health = createService(true, true, () => new Promise(() => undefined)).getHealth();

    await vi.advanceTimersByTimeAsync(SYSTEM_HEALTH_TIMEOUT_MS);

    expect(await health).toEqual({
      status: HealthStatus.DEGRADED,
      database: DependencyStatus.CONNECTED,
      redis: DependencyStatus.DISCONNECTED,
    });
  });
});
