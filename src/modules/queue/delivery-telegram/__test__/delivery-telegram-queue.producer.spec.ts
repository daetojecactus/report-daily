import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_TELEGRAM_SEND_JOB } from '../constants/delivery-telegram-queue.constants';
import { DeliveryTelegramQueueProducer } from '../delivery-telegram-queue.producer';

describe('DeliveryTelegramQueueProducer', () => {
  it('adds one job per delivery with retries', async () => {
    const queue = { add: vi.fn<Queue['add']>() };

    await new DeliveryTelegramQueueProducer(queue as unknown as Queue).addDelivery('019a-1');

    expect(queue.add).toHaveBeenCalledWith(
      DELIVERY_TELEGRAM_SEND_JOB,
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
