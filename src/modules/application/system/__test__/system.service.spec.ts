import { Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { DependencyStatus, HealthStatus } from '../system.enums';
import { SystemService } from '../system.service';

function ping(isAvailable: boolean) {
  return () => (isAvailable ? Promise.resolve() : Promise.reject(new Error('unavailable')));
}

function createService(isDatabaseAvailable: boolean, isRedisAvailable: boolean) {
  const databaseService = { ping: ping(isDatabaseAvailable) };
  const redisService = { ping: ping(isRedisAvailable) };

  return new SystemService(
    databaseService as unknown as DatabaseService,
    redisService as unknown as RedisService,
  );
}

describe('SystemService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
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
});
