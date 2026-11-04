import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';
import { DatabaseClient } from 'src/modules/infrastructure/database/database.client';
import { startFakeBotApi } from './fake-bot-api';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    telegramApiUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const [postgres, redis, botApi] = await Promise.all([
    new PostgreSqlContainer('postgres:18-alpine').start(),
    new RedisContainer('redis:8-alpine').start(),
    startFakeBotApi(),
  ]);

  const databaseUrl = postgres.getConnectionUri();
  await DatabaseClient.runMigrations(databaseUrl);

  project.provide('databaseUrl', databaseUrl);
  project.provide('redisUrl', redis.getConnectionUrl());
  project.provide('telegramApiUrl', botApi.url);

  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), botApi.close()]);
  };
}
