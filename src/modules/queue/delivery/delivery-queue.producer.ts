import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Channel } from 'src/common/channel/types/channel.enums';
import {
  DELIVERY_BROADCAST_ID_PREFIX,
  DELIVERY_BROADCAST_JOB,
  DELIVERY_JOB_ID_PREFIX,
  DELIVERY_JOB_ID_SEPARATOR,
  DELIVERY_JOB_OPTIONS,
  DELIVERY_SEND_JOB,
  DELIVERY_SLACK_QUEUE,
  DELIVERY_TELEGRAM_QUEUE,
} from './constants/delivery-queue.constants';
import type { DeliveryBroadcastMessage, DeliveryJobData } from './types/delivery-queue.interface';

@Injectable()
export class DeliveryQueueProducer {
  private readonly queues: Record<Channel, Queue>;

  constructor(
    @InjectQueue(DELIVERY_TELEGRAM_QUEUE) telegramQueue: Queue,
    @InjectQueue(DELIVERY_SLACK_QUEUE) slackQueue: Queue,
  ) {
    this.queues = { [Channel.TELEGRAM]: telegramQueue, [Channel.SLACK]: slackQueue };
  }

  async addDelivery(channel: Channel, deliveryId: string) {
    const data: DeliveryJobData = { deliveryId };
    await this.queues[channel].add(DELIVERY_SEND_JOB, data, {
      ...DELIVERY_JOB_OPTIONS,
      jobId: `${DELIVERY_JOB_ID_PREFIX}${deliveryId}`,
    });
  }

  async addBroadcast(channel: Channel, broadcastId: string, messages: DeliveryBroadcastMessage[]) {
    await this.queues[channel].addBulk(
      messages.map((data) => ({
        name: DELIVERY_BROADCAST_JOB,
        data,
        opts: {
          ...DELIVERY_JOB_OPTIONS,
          jobId: `${DELIVERY_BROADCAST_ID_PREFIX}${[broadcastId, data.chatId].join(DELIVERY_JOB_ID_SEPARATOR)}`,
        },
      })),
    );
  }
}
