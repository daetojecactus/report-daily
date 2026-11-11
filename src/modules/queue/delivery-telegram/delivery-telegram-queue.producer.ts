import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DELIVERY_TELEGRAM_BROADCAST_ID_PREFIX,
  DELIVERY_TELEGRAM_BROADCAST_JOB,
  DELIVERY_TELEGRAM_JOB_ID_PREFIX,
  DELIVERY_TELEGRAM_JOB_ID_SEPARATOR,
  DELIVERY_TELEGRAM_JOB_OPTIONS,
  DELIVERY_TELEGRAM_QUEUE,
  DELIVERY_TELEGRAM_SEND_JOB,
} from './constants/delivery-telegram-queue.constants';
import type {
  DeliveryTelegramBroadcastData,
  DeliveryTelegramJobData,
} from './types/delivery-telegram-queue.interface';

@Injectable()
export class DeliveryTelegramQueueProducer {
  constructor(@InjectQueue(DELIVERY_TELEGRAM_QUEUE) private readonly deliveryQueue: Queue) {}

  async addDelivery(deliveryId: string) {
    const data: DeliveryTelegramJobData = { deliveryId };
    await this.deliveryQueue.add(DELIVERY_TELEGRAM_SEND_JOB, data, {
      ...DELIVERY_TELEGRAM_JOB_OPTIONS,
      jobId: `${DELIVERY_TELEGRAM_JOB_ID_PREFIX}${deliveryId}`,
    });
  }

  async addBroadcast(broadcastId: string, messages: DeliveryTelegramBroadcastData[]) {
    await this.deliveryQueue.addBulk(
      messages.map((data) => ({
        name: DELIVERY_TELEGRAM_BROADCAST_JOB,
        data,
        opts: {
          ...DELIVERY_TELEGRAM_JOB_OPTIONS,
          jobId: `${DELIVERY_TELEGRAM_BROADCAST_ID_PREFIX}${[broadcastId, data.chatId].join(DELIVERY_TELEGRAM_JOB_ID_SEPARATOR)}`,
        },
      })),
    );
  }
}
