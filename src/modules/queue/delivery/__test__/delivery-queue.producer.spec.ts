import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DELIVERY_BROADCAST_JOB, DELIVERY_SEND_JOB } from '../constants/delivery-queue.constants';
import { DeliveryQueueProducer } from '../delivery-queue.producer';

describe('DeliveryQueueProducer', () => {
  const telegram = { add: vi.fn<Queue['add']>(), addBulk: vi.fn<Queue['addBulk']>() };
  const slack = { add: vi.fn<Queue['add']>(), addBulk: vi.fn<Queue['addBulk']>() };
  const producer = new DeliveryQueueProducer(
    telegram as unknown as Queue,
    slack as unknown as Queue,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('adds one job per delivery with retries to the queue of its channel', async () => {
    await producer.addDelivery(Channel.TELEGRAM, '019a-1');
    await producer.addDelivery(Channel.SLACK, '019a-2');

    expect(telegram.add).toHaveBeenCalledExactlyOnceWith(
      DELIVERY_SEND_JOB,
      { deliveryId: '019a-1' },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: 'delivery-019a-1',
      },
    );
    expect(slack.add).toHaveBeenCalledExactlyOnceWith(
      DELIVERY_SEND_JOB,
      { deliveryId: '019a-2' },
      expect.objectContaining({ jobId: 'delivery-019a-2' }) as object,
    );
  });

  it('adds one broadcast job per chat in one call to the queue of its channel', async () => {
    await producer.addBroadcast(Channel.SLACK, 'b-1', [
      { chatId: 'U0EMPLOY1', text: 'Standup' },
      { chatId: 'U0EMPLOY2', text: 'Standup' },
    ]);

    expect(slack.addBulk).toHaveBeenCalledExactlyOnceWith(
      ['U0EMPLOY1', 'U0EMPLOY2'].map((chatId) => ({
        name: DELIVERY_BROADCAST_JOB,
        data: { chatId, text: 'Standup', broadcastId: 'b-1' },
        opts: expect.objectContaining({ attempts: 5, jobId: `broadcast-b-1-${chatId}` }) as object,
      })),
    );
    expect(telegram.addBulk).not.toHaveBeenCalled();
  });
});
