import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import {
  DELIVERY_SLACK_BROADCAST_JOB,
  DELIVERY_SLACK_SEND_JOB,
} from '../constants/delivery-slack-queue.constants';
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

  it('adds one broadcast job per chat in one call', async () => {
    const queue = { addBulk: vi.fn<Queue['addBulk']>() };

    await new DeliverySlackQueueProducer(queue as unknown as Queue).addBroadcast('b-1', [
      { chatId: 'U0ANNA01', text: 'Standup' },
      { chatId: 'U0BORIS1', text: 'Standup' },
    ]);

    expect(queue.addBulk).toHaveBeenCalledWith(
      ['U0ANNA01', 'U0BORIS1'].map((chatId) => ({
        name: DELIVERY_SLACK_BROADCAST_JOB,
        data: { chatId, text: 'Standup' },
        opts: expect.objectContaining({ attempts: 5, jobId: `broadcast-b-1-${chatId}` }) as object,
      })),
    );
  });
});
