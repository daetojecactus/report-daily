import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import type { DeliverySlackQueueProducer } from '../../delivery-slack/delivery-slack-queue.producer';
import type { DeliveryTelegramQueueProducer } from '../../delivery-telegram/delivery-telegram-queue.producer';
import { DeliveryQueueProducer } from '../delivery-queue.producer';

describe('DeliveryQueueProducer', () => {
  const telegram = {
    addDelivery: vi.fn<DeliveryTelegramQueueProducer['addDelivery']>(),
    addBroadcast: vi.fn<DeliveryTelegramQueueProducer['addBroadcast']>(),
  };
  const slack = {
    addDelivery: vi.fn<DeliverySlackQueueProducer['addDelivery']>(),
    addBroadcast: vi.fn<DeliverySlackQueueProducer['addBroadcast']>(),
  };
  const producer = new DeliveryQueueProducer(
    telegram as unknown as DeliveryTelegramQueueProducer,
    slack as unknown as DeliverySlackQueueProducer,
  );
  const messages = [{ chatId: '1', text: 'Standup' }];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('puts a delivery into the queue of its channel', async () => {
    await producer.addDelivery(Channel.TELEGRAM, 'delivery-1');
    await producer.addDelivery(Channel.SLACK, 'delivery-2');

    expect(telegram.addDelivery).toHaveBeenCalledExactlyOnceWith('delivery-1');
    expect(slack.addDelivery).toHaveBeenCalledExactlyOnceWith('delivery-2');
  });

  it('puts a broadcast into the queue of its channel', async () => {
    await producer.addBroadcast(Channel.SLACK, 'b-1', messages);

    expect(slack.addBroadcast).toHaveBeenCalledExactlyOnceWith('b-1', messages);
    expect(telegram.addBroadcast).not.toHaveBeenCalled();
  });
});
