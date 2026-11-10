import { getQueueToken } from '@nestjs/bullmq';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from 'test/setup/test-app';
import {
  SYSTEM_QUEUE,
  SYSTEM_SCHEDULE_TICK_SCHEDULER_ID,
} from '../constants/system-queue.constants';
import { SystemQueueProducer } from '../system-queue.producer';

const QUARTER_MS = 15 * 60 * 1000;

describe('System queue', () => {
  let app: NestFastifyApplication;
  let queue: Queue;

  beforeAll(async () => {
    app = await createTestApp();
    queue = app.get<Queue>(getQueueToken(SYSTEM_QUEUE));
  });

  afterAll(async () => {
    await queue.removeJobScheduler(SYSTEM_SCHEDULE_TICK_SCHEDULER_ID);
    await app.close();
  });

  it('keeps one tick scheduler that fires at the next quarter of an hour', async () => {
    const producer = app.get(SystemQueueProducer);
    await producer.scheduleTick();
    await producer.scheduleTick();

    const schedulers = await queue.getJobSchedulers();
    expect(schedulers).toMatchObject([
      { key: SYSTEM_SCHEDULE_TICK_SCHEDULER_ID, pattern: '*/15 * * * *' },
    ]);
    expect((schedulers[0].next ?? 1) % QUARTER_MS).toBe(0);
  });
});
