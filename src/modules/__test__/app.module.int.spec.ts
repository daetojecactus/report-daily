import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { RedisClient } from 'src/modules/infrastructure/redis/redis.client';
import { createTestApp } from 'test/setup/test-app';

describe('AppModule', () => {
  it('closes database and redis connections on shutdown', async () => {
    const app = await createTestApp();
    const databaseService = app.get(DatabaseService);
    const redisClient = app.get(RedisClient);

    await app.close();

    await vi.waitFor(() => expect(redisClient.instance.status).toBe('end'));
    await expect(databaseService.ping()).rejects.toThrow();
  });
});
