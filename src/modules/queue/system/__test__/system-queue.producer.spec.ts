import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { SystemQueueProducer } from '../system-queue.producer';

describe('SystemQueueProducer', () => {
  it('keeps one tick every 15 minutes at the quarters of an hour', async () => {
    const queue = { upsertJobScheduler: vi.fn<Queue['upsertJobScheduler']>() };

    await new SystemQueueProducer(queue as unknown as Queue).scheduleTick();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'schedule-tick',
      { pattern: '*/15 * * * *' },
      { name: 'schedule-tick', opts: { removeOnComplete: true, removeOnFail: true } },
    );
  });
});
