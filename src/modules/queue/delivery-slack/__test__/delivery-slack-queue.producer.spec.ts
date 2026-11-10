import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_SLACK_SEND_JOB } from '../constants/delivery-slack-queue.constants';
import { DeliverySlackQueueProducer } from '../delivery-slack-queue.producer';

describe('DeliverySlackQueueProducer', () => {
  it('adds one job per delivery with retries', async () => {
    const queue = { add: vi.fn<Queue['add']>() };

    await new DeliverySlackQueueProducer(queue as unknown as Queue).addDelivery('019a-1');

    expect(queue.add).toHaveBeenCalledWith(
      DELIVERY_SLACK_SEND_JOB,
      { deliveryId: '019a-1' },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: 'delivery-019a-1',
      },
    );
  });
});
